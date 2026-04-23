import {EAuthTokenPlatformType, EResult, LoginSession} from "steam-session";
import {ConstructorOptions} from "steam-session/dist/interfaces-external";
import {paintIndexDb, settingsDb, SteamAccountDb} from "../../db";
import {
    ACCESS_TOKEN_NAME,
    APP_VERSION_NAME,
    DATA_ACTIVATION_CODE_NAME,
    DATA_AUTHENTICATOR_CODE_NAME,
    DATA_AUTHENTICATOR_TIME_NAME,
    DATA_AUTHENTICATOR_TYPE_NAME,
    DATA_DEVICE_IDENTIFIER_NAME,
    DATA_GENERATE_NEW_TOKEN_NAME,
    DATA_SMS_CODE_NAME,
    DATA_SMS_PHONE_ID_NAME,
    DEFAULT_APP_VERSION,
    DEFAULT_CLIENT_PLATFORM,
    DEFAULT_DATA_AUTHENTICATOR_TYPE_VALUE,
    DEFAULT_DATA_SMS_PHONE_ID_VALUE,
    DEFAULT_LANGUAGE,
    DEFAULT_TIME_ZONE_OFFSET,
    DEFAULT_USER_AGENT,
    DEVICEID_NAME,
    LANGUAGE_NAME,
    MOBILE_CLIENT_VERSION_NAME,
    STEAM_ID_NAME,
    STEAM_LANGUAGE_NAME,
    TIME_ZONE_OFFSET_NAME
} from "../constants.ts";
import {parseErrorResult, parseSteamCommunityResult, parseSteamResult, parseToken} from "../index.ts";
import crypto from "node:crypto";
import {GotHttpApiRequest} from "../../utils/requests.ts";
import getEndpoints, {COMMUNITY_ENDPOINTS, STEAM_COMMUNITY_BASE} from "../endpoints.ts";
import * as SteamTotp from "steam-totp";
import path from "node:path";
import {util} from "protobufjs";
import runtimeContext from "../../utils/runtime-context.ts";
import windowManager from "../../window-manager.ts";
import EventEmitter = util.EventEmitter;
import {toJson} from "../../utils/json-util.ts";

class SteamLoginModel extends EventEmitter {
    private _session?: LoginSession

    account_name: string

    constructor(account_name: string) {
        super()
        this.account_name = account_name
    }

    async cancelLogin() {
        if (this._session) {
            this._session.cancelLoginAttempt()
            this._session.removeAllListeners()
        }
    }

    async login(options: LoginOptions) {
        const event = await new Promise<SteamLoginEvent>(async resolve => {
            if (!options.account_name) {
                const event = {
                    account_name: 'unknown',
                    result: EResult.InvalidParam,
                    error_message: 'Account name is required'
                }
                return resolve(event)
            }

            this.account_name = options.account_name

            try {
                await this.cancelLogin()
                this._session = new LoginSession(EAuthTokenPlatformType.MobileApp, this._handleSessionOptions())
                this._session.loginTimeout = 120_000

                this._session.on('authenticated', async () => {
                    const event = await this._handleSession()
                    resolve(event)
                })

                this._session.on('error', (err) => {
                    const event: SteamLoginEvent = {
                        account_name: this.account_name || 'unknown',
                        result: err.eresult || EResult.Fail,
                        status: 'Failed',
                        error_message: err.message
                    }
                    resolve(event);
                });

                // 超时事件
                this._session.on('timeout', () => {
                    resolve({
                        account_name: this.account_name || 'unknown',
                        result: EResult.Timeout,
                        status: 'Timeout',
                        error_message: 'Connection timed out'
                    });
                    // 超时通常清理掉比较好
                    this.cancelLogin().then();
                });

                if (options.refresh_token) {
                    this._session.refreshToken = options.refresh_token
                    return resolve(await this.refreshLogin(this._session.refreshToken))
                } else if (options.password) {
                    // 6b. 账号密码登录
                    const startResult = await this._session.startWithCredentials({
                        accountName: this.account_name,
                        password: options.password,
                        steamGuardCode: options.steamGuardCode // 如果是第二次调用（带了验证码），这里传入
                    });

                    // 7. 处理同步返回结果 (关键：判断是否需要 2FA)
                    if (startResult.actionRequired) {
                        return resolve({
                            account_name: this.account_name,
                            result: EResult.AccountLogonDenied, // 通常用这个码表示需要验证
                            status: 'Need2FA',
                            valid_actions: startResult.validActions // 告诉前端是 email 还是 app 验证码
                        });
                    }
                } else {
                    return resolve({
                        account_name: this.account_name,
                        result: EResult.InvalidParam,
                        status: 'Failed',
                    })
                }

            } catch (e: any) {
                console.error(`[SteamExecutor] Login Error for ${this.account_name}:`, e);
                // 出错后是否清理 Session 取决于业务，如果是密码错，建议清理；如果是 2FA 错，保留 Session
                if (e.eresult === EResult.InvalidPassword || e.eresult === EResult.AccountLogonDenied) {
                    this.cancelLogin().then();
                }
                return resolve({
                    account_name: this.account_name,
                    result: e.eresult || EResult.Fail,
                    status: 'Failed',
                    error_message: e.message
                });
            }

        })
        this.emit('login-status', event)
        return event
    }

    private _handleSessionOptions() {
        // 3. 准备代理配置
        const sessionOptions: ConstructorOptions = {};
        if (settingsDb.data.proxy) {
            const proxy = settingsDb.data.proxy.trim();
            if (proxy.startsWith('http')) {
                sessionOptions.httpProxy = proxy;
            } else if (proxy.startsWith('socks')) {
                sessionOptions.socksProxy = proxy;
            }
        }
        return sessionOptions
    }

    async refreshLogin(refresh_token: string): Promise<SteamLoginEvent> {
        if (!this._session) {
            this._session = new LoginSession(EAuthTokenPlatformType.MobileApp, this._handleSessionOptions());
        }
        this._session.refreshToken = refresh_token;
        await this._session.refreshAccessToken()
        return await this._handleSession()
    }

    async submitAuthCode(auth_code: string): Promise<SteamLoginEvent> {
        if (!this._session) {
            return {
                account_name: this.account_name || 'unknown',
                result: EResult.Fail,
                error_message: 'Session expired or not found'
            }
        }

        try {
            // 提交验证码
            await this._session.submitSteamGuardCode(auth_code);

            // 注意：submitSteamGuardCode 成功后，steam-session 会自动触发 'authenticated' 事件
            // 所以这里不需要手动发送成功消息，监听器会处理
            return {
                account_name: this.account_name || 'unknown',
                status: 'Converting',
                result: EResult.OK
            }
        } catch (e: any) {
            console.error(`[SteamExecutor] 2FA Error for ${this.account_name}:`, e);
            return {
                account_name: this.account_name || 'unknown',
                result: EResult.InvalidPassword, // 这里复用 InvalidPassword 表示验证码错
                status: 'Failed',
                error_message: e.message
            }
            // 验证码输错不要销毁 Session，允许用户重试
        }
    }

    private async _handleSession(): Promise<SteamLoginEvent> {
        try {

            if (!this._session) {
                await this.cancelLogin()
                return {
                    account_name: this.account_name || 'unknown',
                    result: EResult.Fail,
                    status: 'Failed',
                }
            }

            const cookies = await this._session.getWebCookies();
            cookies.push(`${STEAM_LANGUAGE_NAME}=${DEFAULT_LANGUAGE}`)
            cookies.push(`${MOBILE_CLIENT_VERSION_NAME}=${DEFAULT_APP_VERSION}`)
            cookies.push(`${TIME_ZONE_OFFSET_NAME}=${DEFAULT_TIME_ZONE_OFFSET}`)
            cookies.push(`${STEAM_ID_NAME}=${this._session.steamID.getSteamID64()}`)
            const _s = cookies.find(value => value.startsWith("sessionid="))
            const event: SteamLoginEvent = {
                account_name: this.account_name || 'unknown',
                result: EResult.OK,
                status: 'LoginSuccess',
                data: {
                    access_token: this._session.accessToken,
                    refresh_token: this._session.refreshToken,
                    account_name: this._session.accountName,
                    SteamID: this._session.steamID.getSteamID64(),
                    cookies: cookies.join(";"),
                    session_id: _s?.trim().replace('sessionid=', '') as string,
                    at: parseToken(this._session.accessToken).payload.exp,
                    rt: parseToken(this._session.refreshToken).payload.exp
                }
            }
            console.log('steamLoginEvent:', event)
            this.emit('login-status', event)
            return event
        } catch (e: any) {
            const event: SteamLoginEvent = {
                account_name: this.account_name || 'unknown',
                result: e.eresult || EResult.Fail,
                status: 'Failed',
                error_message: 'Failed to retrieve cookies'
            }
            console.log('steamLoginEvent:', event)
            this.emit('login-status', event)
            return event
        }
    }
}

class SteamMobileDeviceModel {
    deviceId?: string
    flag: boolean = false

    session?: SteamSession

    constructor(session?: SteamSession) {
        this.session = session
    }

    async registerMobileDevice(): Promise<void> {
        if (!this.deviceId) {
            this.deviceId = `${DEFAULT_CLIENT_PLATFORM}:${crypto.randomUUID().toLowerCase()}`
        }
        if (!this.session) {
            return
        }
        return await GotHttpApiRequest.post(getEndpoints('MobileDevice', 'RegisterMobileDevice', 1))
            .param(ACCESS_TOKEN_NAME, this.session.access_token)
            .data(LANGUAGE_NAME, DEFAULT_LANGUAGE)
            .data(APP_VERSION_NAME, DEFAULT_APP_VERSION)
            .data(DEVICEID_NAME, this.deviceId)
            .data()
            .userAgent(DEFAULT_USER_AGENT)
            .requestConfig({timeout: settingsDb.data.timeout, proxies: settingsDb.data.proxy})
            .perform()
            .then(res => {
                const response: SteamResponse<string> = parseSteamResult(res)
                response.response = this.deviceId
                return response
            })
            .catch(reason => parseErrorResult<string>(reason))
            .then(res => {
                this.flag = res.eresult === EResult.OK
            })
    }
}

export class SteamTimeSync {
    private timeOffset = 0
    private timeNextSyncTime = -1

    public static instance: SteamTimeSync = new SteamTimeSync()

    private constructor() {
        this.scheduleNextSync().then()
    }

    private async scheduleNextSync() {
        try {
            // The original code had an `isFirst` flag that was never updated, making the retry logic dead code.
            // This simplified version maintains the actual behavior in a safer way.
            await this.syncTime()
        } catch (e) {
            console.error('Error during time sync:', e)
        } finally {
            setTimeout(() => this.scheduleNextSync(), 30000)
        }
    }

    private async syncTime() {
        if (Date.now() > this.timeNextSyncTime) {
            const res = await GotHttpApiRequest.post(getEndpoints('TwoFactor', 'QueryTime', 1))
                .data(STEAM_ID_NAME, '0')
                .data()
                .requestConfig({
                    timeout: settingsDb.data.timeout,
                    proxies: settingsDb.data.proxy
                })
                .userAgent(DEFAULT_USER_AGENT)
                .perform()
                .then(res => parseSteamResult<QueryTimeResponse>(res))
                .catch(res => parseErrorResult<QueryTimeResponse>(res))

            if (res.eresult === EResult.OK && res.response && res.response.server_time) {
                const cacheDuration = parseInt((res.response.try_again_seconds || 600) + '') * 1000
                this.timeNextSyncTime = Date.now() + cacheDuration
                const serverTimeSec = parseInt(res.response.server_time, 10)
                this.timeOffset = serverTimeSec - Math.floor(Date.now() / 1000)
            }
        }
    }

    async getTime() {
        await this.syncTime()
        return SteamTotp.time(this.timeOffset)
    }

    async getTimeOffset() {
        await this.syncTime()
        return this.timeOffset
    }
}

class SteamPhoneModel {
    session?: SteamSession

    phoneNumber?: string
    phoneCountryCode?: string
    stoken?: string
    language?: string

    constructor(session?: SteamSession) {
        this.session = session
    }

    async ConfirmAddPhoneToAccount() {
        return GotHttpApiRequest.post(getEndpoints('Phone', 'ConfirmAddPhoneToAccount', 1))
            .param(ACCESS_TOKEN_NAME, this.session?.access_token || '')
            .data(STEAM_ID_NAME, this.session?.SteamID || '0')
            .data('stoken', this.stoken as string)
            .data()
            .userAgent(DEFAULT_USER_AGENT)
            .requestConfig({
                timeout: settingsDb.data.timeout,
                proxies: settingsDb.data.proxy
            })
            .perform()
            .then(res => parseSteamResult<any>(res))
            .catch(err => parseErrorResult<any>(err))
    }

    async IsAccountWaitingForEmailConfirmation() {
        return GotHttpApiRequest.post(getEndpoints('Phone', 'IsAccountWaitingForEmailConfirmation', 1))
            .param(ACCESS_TOKEN_NAME, this.session?.access_token || '')
            .data()
            .userAgent(DEFAULT_USER_AGENT)
            .requestConfig({
                timeout: settingsDb.data.timeout,
                proxies: settingsDb.data.proxy
            })
            .perform()
            .then(res => parseSteamResult<IsAccountWaitingForEmailConfirmationResponse>(res))
            .catch(err => parseErrorResult<IsAccountWaitingForEmailConfirmationResponse>(err))
    }

    async SendPhoneVerificationCode() {
        return GotHttpApiRequest.post(getEndpoints('Phone', 'SendPhoneVerificationCode', 1))
            .param(ACCESS_TOKEN_NAME, this.session?.access_token || '')
            .data(LANGUAGE_NAME, this.language || DEFAULT_LANGUAGE)
            .data()
            .userAgent(DEFAULT_USER_AGENT)
            .requestConfig({
                timeout: settingsDb.data.timeout,
                proxies: settingsDb.data.proxy
            })
            .perform()
            .then(res => parseSteamResult<any>(res))
            .catch(err => parseErrorResult<any>(err))
    }


    async SetAccountPhoneNumber() {
        return GotHttpApiRequest.post(getEndpoints('Phone', 'SetAccountPhoneNumber', 1))
            .param(ACCESS_TOKEN_NAME, this.session?.access_token || '')
            .data('phone_number', this.phoneNumber)
            .data('phone_country_code', this.phoneCountryCode)
            .data()
            .userAgent(DEFAULT_USER_AGENT)
            .requestConfig({
                timeout: settingsDb.data.timeout,
                proxies: settingsDb.data.proxy
            })
            .perform()
            .then(res => parseSteamResult<SetAccountPhoneNumberResponse>(res))
            .catch(err => parseErrorResult<SetAccountPhoneNumberResponse>(err))
    }

    async VerifyAccountPhoneWithCode(code: string) {
        return GotHttpApiRequest.post(getEndpoints('Phone', 'VerifyAccountPhoneWithCode', 1))
            .param(ACCESS_TOKEN_NAME, this.session?.access_token || '')
            .data('code', code)
            .data()
            .userAgent(DEFAULT_USER_AGENT)
            .requestConfig({
                timeout: settingsDb.data.timeout,
                proxies: settingsDb.data.proxy
            })
            .perform()
            .then(res => parseSteamResult<any>(res))
            .catch(err => parseErrorResult<any>(err))
    }
}

class SteamNotificationModel {
    session?: SteamSession

    constructor(session?: SteamSession) {
        this.session = session
    }

    async getNotifications(params: GetNotificationsParams): Promise<SteamResponse<GetNotificationsResponse>> {
        if (!this.session) {
            return {
                eresult: EResult.AccessDenied,
                response: {
                    notifications: [],
                    confirmation_count: 0,
                    pending_gift_count: 0,
                    pending_family_invite_count: 0,
                    unread_count: 0,
                    pending_friend_count: 0
                },
                status: 0
            }
        }

        if (!params.language) {
            params.language = DEFAULT_LANGUAGE
        }

        return GotHttpApiRequest.get(getEndpoints('SteamNotification', 'GetSteamNotifications', 1))
            .params(params)
            .requestConfig({timeout: settingsDb.data.timeout, proxies: settingsDb.data.proxy})
            .userAgent(DEFAULT_USER_AGENT)
            .perform()
            .then(res => parseSteamResult<GetNotificationsResponse>(res))
            .catch(reason => parseErrorResult<GetNotificationsResponse>(reason))

    }
}

class SteamAccountModel implements SteamAccount {
    session?: SteamSession
    guard?: SteamGuard
    state?: TwoFactorState
    smsCode?: string

    login: SteamLoginModel

    mobileDevice: SteamMobileDeviceModel

    phone: SteamPhoneModel

    notification: SteamNotificationModel

    econ: SteamEconModel

    private db: SteamAccountDb

    constructor(account_name: string, passkey?: string) {

        console.log(`account_name:${account_name}`)

        this.db = new SteamAccountDb(path.join(settingsDb.data.maFilesDir, `${account_name}.maFile`), passkey)
        this.session = this.db.data.session
        this.guard = this.db.data.guard

        this.login = new SteamLoginModel(account_name)
        this.mobileDevice = new SteamMobileDeviceModel(this.session)
        this.phone = new SteamPhoneModel(this.session)
        this.notification = new SteamNotificationModel(this.session)
        this.econ = new SteamEconModel(this.session)

        this.login.on('login-status', (event: SteamLoginEvent) => {

            console.log('login-status', event)

            if (event.status === 'LoginSuccess' && event.data) {
                this.session = {...event.data}
                this.save()
                this.mobileDevice.session = this.session
                this.phone.session = this.session
            }

            windowManager.sendEvent('/', 'steam:message:login-status-changed', event)

        })

        this.checkSession().then()

        console.log(`session:${toJson(this.session)},guard:${toJson(this.guard)}`)

        this.scheduleSessionCheck().then()
    }

    private async scheduleSessionCheck() {
        try {
            await this.checkSession()
        } catch (e) {
            const accountName = this.session?.account_name || this.login.account_name || 'unknown'
            console.error(`[${accountName}] Error during session check:`, e)
        } finally {
            setTimeout(() => this.scheduleSessionCheck(), 5 * 60 * 1000)
        }
    }

    private async checkSession(): Promise<boolean> {
        if (!this.session) {
            return false
        }
        const time = await SteamTimeSync.instance.getTime()
        if (time > (this.session.at - 5 * 60)) {
            if (!this.session.refresh_token) {
                return false
            }
            if (time > this.session.rt) {
                return false
            }
            const event = await this.login.refreshLogin(this.session.refresh_token)
            if (event.data) {
                this.session = {...event.data}
                return true
            } else {
                return false
            }
        }
        return true
    }

    setPasskey(passkey?: string) {
        this.db.setPasskey(passkey)
    }

    save() {
        if (this.session) {
            this.db.data.session = this.session
        }
        if (this.guard) {
            this.db.data.guard = this.guard
        }
        this.db.update()
    }

    async generateAuthCode(shared_secret?: string) {
        if (shared_secret) {
            return SteamTotp.generateAuthCode(shared_secret, await SteamTimeSync.instance.getTimeOffset())
        }
        if (this.guard) {
            return SteamTotp.generateAuthCode(this.guard.shared_secret, await SteamTimeSync.instance.getTimeOffset())
        }
        return undefined
    }

    async getConfirmation(confirmationId: string) {
        if (!this.guard || !await this.checkSession()) {
            return undefined
        }

        const ret = await this.generateConfirmationQueryParamsAsNVC({
            identitySecret: this.guard.identity_secret,
            tag: 'detail',
            p: this.guard.device_id,
            a: this.session?.SteamID || '0'
        })
        return GotHttpApiRequest.get(`${COMMUNITY_ENDPOINTS.confirmationDetail}${confirmationId}`)
            .params(ret)
            .userAgent(DEFAULT_USER_AGENT)
            .requestConfig({
                timeout: settingsDb.data.timeout,
                proxies: settingsDb.data.proxy
            })
            .referer(STEAM_COMMUNITY_BASE)
            .cookie(this.session?.cookies as string)
            .perform()
            .then(res => parseSteamCommunityResult<any>(res))
            .catch(reason => parseErrorResult<any>(reason))
    }

    async acceptConfirmation(confirmation: Confirmation) {
        return this.ajaxop(confirmation, 'allow', 'accept')
    }

    async cancelConfirmation(confirmation: Confirmation) {
        return this.ajaxop(confirmation, 'cancel', 'reject')
    }

    async getConfirmations() {
        console.log(this.session, this.guard)
        if (!this.guard || !await this.checkSession()) {
            return {
                eresult: EResult.Fail,
                response: undefined,
                status: 0,
            } as SteamResponse<ConfirmationsResponse>
        }

        const params = await this.generateConfirmationQueryParamsAsNVC({
            tag: 'list',
            identitySecret: this.guard.identity_secret,
            p: this.guard.device_id,
            a: this.session?.SteamID || '0'
        })
        return GotHttpApiRequest.get(COMMUNITY_ENDPOINTS.confirmations)
            .params(params)
            .userAgent(DEFAULT_USER_AGENT)
            .requestConfig({
                timeout: settingsDb.data.timeout,
                proxies: settingsDb.data.proxy
            })
            .referer(STEAM_COMMUNITY_BASE)
            .cookie(this.session?.cookies || '')
            .perform()
            .then(res => parseSteamCommunityResult<ConfirmationsResponse>(res))
            .catch(reason => parseErrorResult<ConfirmationsResponse>(reason))
    }

    private async _challengeAuthenticatorStart(): Promise<void> {
        if (!this.session || !await this.checkSession()) {
            this.state = 'SessionExpired'
            return
        }
        const removeStartRes = await GotHttpApiRequest.post(getEndpoints('TwoFactor', 'RemoveAuthenticatorViaChallengeStart', 1))
            .param(ACCESS_TOKEN_NAME, this.session.access_token)
            .data(STEAM_ID_NAME, parseToken(this.session.access_token).payload.sub)
            .data()
            .requestConfig({timeout: settingsDb.data.timeout, proxies: settingsDb.data.proxy})
            .userAgent(DEFAULT_USER_AGENT)
            .perform()
            .then(res => parseSteamResult<any>(res))
            .catch(reason => parseErrorResult(reason))

        if (!removeStartRes.response || removeStartRes.eresult !== EResult.OK) {
            this.state = 'GeneralFailure'
            return
        }
        this.state = 'AwaitingRemoveChallengeContinue'
        return
    }

    private async _challengeAuthenticatorContinue(): Promise<void> {
        if (!this.session || !await this.checkSession()) {
            this.state = 'SessionExpired'
            return
        }
        if (!this.smsCode) {
            this.state = 'NeedChallengeSmsCode'
            return
        }

        const removeAuthenticatorViaChallengeContinueRes = await GotHttpApiRequest.post(getEndpoints('TwoFactor', 'RemoveAuthenticatorViaChallengeContinue', 1))
            .param(ACCESS_TOKEN_NAME, this.session.access_token)
            .data(STEAM_ID_NAME, parseToken(this.session.access_token).payload.sub)
            .data(DATA_SMS_CODE_NAME, this.smsCode)
            .data(DATA_GENERATE_NEW_TOKEN_NAME, true)
            .data()
            .requestConfig({timeout: settingsDb.data.timeout, proxies: settingsDb.data.proxy})
            .userAgent(DEFAULT_USER_AGENT)
            .perform()
            .then(res => parseSteamResult<RemoveAuthenticatorViaChallengeContinueResponse>(res))
            .catch(reason => parseErrorResult<RemoveAuthenticatorViaChallengeContinueResponse>(reason))

        if (!removeAuthenticatorViaChallengeContinueRes.response) {
            this.state = 'GeneralFailure'
            return
        }

        if (removeAuthenticatorViaChallengeContinueRes.eresult === EResult.SMSCodeFailed || removeAuthenticatorViaChallengeContinueRes.eresult === EResult.TwoFactorActivationCodeMismatch) {
            this.state = 'BadChallengeSmsCode'
            return
        }

        if (removeAuthenticatorViaChallengeContinueRes.eresult !== EResult.OK) {
            this.state = 'GeneralFailure'
            return
        }

        if (!removeAuthenticatorViaChallengeContinueRes.response.success || !removeAuthenticatorViaChallengeContinueRes.response.replacement_token) {
            this.state = 'GeneralFailure'
            return
        }

        if (!removeAuthenticatorViaChallengeContinueRes.response.replacement_token.shared_secret) {
            this.state = 'GeneralFailure'
            return
        }

        this.guard = {...removeAuthenticatorViaChallengeContinueRes.response.replacement_token}
        if (!this.guard.device_id) {
            this.guard.device_id = this.mobileDevice.deviceId as string
        }
        this.save()
        this.state = 'Success'
        return
    }

    private async _addPhoneNumber(): Promise<void> {
        if (!this.phone.phoneNumber || !this.phone.phoneCountryCode) {
            this.state = 'NeedPhoneNumber'
            return
        }
        const res = await this.phone.SetAccountPhoneNumber()
        if (res.eresult !== EResult.OK) {
            this.state = 'FailureAddingPhone'
            return
        } else {
            this.state = 'AwaitingConfirmEmail'
            return
        }
    }

    private async _finalizeAddAuthenticator() {
        if (!this.session || !await this.checkSession()) {
            this.state = 'SessionExpired'
            return
        }
        let tries = 0
        while (tries <= 10) {
            if (!this.smsCode) {
                this.state = 'AwaitingFinalizeAddAuthenticatorBadSmsCode'
                return
            }
            const res = await GotHttpApiRequest.post(getEndpoints('TwoFactor', 'FinalizeAddAuthenticator', 1))
                .param(ACCESS_TOKEN_NAME, this.session.access_token)
                .data(STEAM_ID_NAME, parseToken(this.session.access_token).payload.sub)
                .data(DATA_ACTIVATION_CODE_NAME, this.smsCode)
                .data(DATA_AUTHENTICATOR_CODE_NAME, await this.generateAuthCode())
                .data(DATA_AUTHENTICATOR_TIME_NAME, await SteamTimeSync.instance.getTime() + '')
                .data()
                .requestConfig({timeout: settingsDb.data.timeout, proxies: settingsDb.data.proxy})
                .userAgent(DEFAULT_USER_AGENT)
                .perform()
                .then(res => parseSteamResult<FinalizeAuthenticatorResponse>(res))
                .catch(reason => parseErrorResult<FinalizeAuthenticatorResponse>(reason))
            if (!res.response) {
                this.state = 'GeneralFailure'
                return
            }
            if (res.response.status == EResult.TwoFactorActivationCodeMismatch) {
                this.state = 'AwaitingFinalizeAddAuthenticatorBadSmsCode'
                return
            }
            if (res.response.status == EResult.TwoFactorCodeMismatch) {
                if (tries >= 10) {
                    this.state = 'UnableToGenerateCorrectCodes'
                    return
                }
            }
            if (!res.response.success) {
                this.state = 'GeneralFailure'
                return
            }
            if (res.response.want_more) {
                tries++
                continue
            }
            if (this.guard) {
                this.guard.fully_enrolled = true
            }
            this.state = 'Success'
            this.save()
            return
        }
        return
    }

    private async _addAuthenticator() {
        if (!this.session || !await this.checkSession()) {
            this.state = 'SessionExpired'
            return
        }
        const res = await GotHttpApiRequest.post(getEndpoints('TwoFactor', 'AddAuthenticator', 1))
            .param(ACCESS_TOKEN_NAME, this.session.access_token)
            .data(STEAM_ID_NAME, parseToken(this.session.access_token).payload.sub)
            .data(DATA_AUTHENTICATOR_TYPE_NAME, DEFAULT_DATA_AUTHENTICATOR_TYPE_VALUE)
            .data(DATA_SMS_PHONE_ID_NAME, DEFAULT_DATA_SMS_PHONE_ID_VALUE)
            .data(DATA_DEVICE_IDENTIFIER_NAME, this.mobileDevice.deviceId)
            .data()
            .requestConfig({timeout: settingsDb.data.timeout, proxies: settingsDb.data.proxy})
            .userAgent(DEFAULT_USER_AGENT)
            .perform()
            .then(res => parseSteamResult<SteamGuard>(res))
            .catch(reason => parseErrorResult<SteamGuard>(reason))

        if (!res.response) {
            this.state = 'GeneralFailure'
            return
        }

        switch (res.eresult) {
            case EResult.DuplicateRequest: {
                this.state = 'AuthenticatorPresent'
                return this._challengeAuthenticatorStart()
            }
            case EResult.InvalidParam: {
                if (res.response.status == EResult.Fail) {
                    if (!this.phone.phoneNumber || !this.phone.phoneCountryCode) {
                        this.state = 'NeedPhoneNumber'
                        return
                    }
                }
                this.state = 'GeneralFailure'
                return
            }
            case EResult.OK: {
                this.guard = {...res.response}
                this.state = 'AwaitingFinalizeAddAuthenticator'
                this.save()
                return
            }
            default: {
                this.state = 'GeneralFailure'
            }
        }
    }

    async addAuthenticator(): Promise<void> {

        // 检查session
        if (!this.session || !await this.checkSession()) {
            this.state = 'SessionExpired'
            return
        }

        // 检查设备号是否注册
        if (!this.mobileDevice.flag) {
            await this.mobileDevice.registerMobileDevice()
            if (!this.mobileDevice.flag) {
                this.state = 'FailureRegisterDevice'
                return
            }
        }

        // 继续移动
        if (this.state === 'AwaitingRemoveChallengeContinue' || this.state === 'NeedChallengeSmsCode' || this.state === 'BadChallengeSmsCode') {
            return this._challengeAuthenticatorContinue()
        }

        // 添加手机号
        if (this.state === 'NeedPhoneNumber') {
            return this._addPhoneNumber()
        }

        // 检查是否邮箱确认
        if (this.state === 'AwaitingConfirmEmail') {
            const res = await this.phone.IsAccountWaitingForEmailConfirmation()
            if (res.eresult !== EResult.OK) {
                this.state = 'AwaitingConfirmEmail'
                return
            }
            if (!res.response || res.response.awaiting_email_confirmation) {
                this.state = 'AwaitingConfirmEmail'
                return
            }
        }

        // 最终添加
        if (this.state === 'AwaitingFinalizeAddAuthenticator' || this.state === 'AwaitingFinalizeAddAuthenticatorBadSmsCode') {
            return this._finalizeAddAuthenticator()
        }

        // 已添加, 移动令牌
        if (this.state === 'AuthenticatorPresent') {
            return this._challengeAuthenticatorStart()
        }

        // 添加令牌
        return this._addAuthenticator()
    }


    private async ajaxop(confirmation: Confirmation, op: string, tag: string): Promise<SteamResponse<ConfirmationAjaxOpResponse>> {
        if (!this.guard) {
            throw new Error('guard empty')
        }
        const ret = await this.generateConfirmationQueryParamsAsNVC({
            identitySecret: this.guard.identity_secret,
            tag: tag,
            p: this.guard.device_id,
            a: this.session?.SteamID || '0'
        })
        ret.cid = confirmation.id
        ret.op = op
        ret.ck = confirmation.nonce
        return GotHttpApiRequest.post(COMMUNITY_ENDPOINTS.ajaxop)
            .data(ret)
            .userAgent(DEFAULT_USER_AGENT)
            .requestConfig({
                timeout: settingsDb.data.timeout,
                proxies: settingsDb.data.proxy
            })
            .referer(COMMUNITY_ENDPOINTS.confirmationDetail + confirmation.id)
            .cookie(this.session?.cookies as string)
            .perform()
            .then(res => parseSteamCommunityResult<ConfirmationAjaxOpResponse>(res))
            .catch(reason => parseErrorResult<ConfirmationAjaxOpResponse>(reason))
    }

    private async generateConfirmationQueryParamsAsNVC(options: {
        identitySecret: string,
        tag: string,
        p: string,
        a: string
    }): Promise<Record<string, string>> {
        const time = await SteamTimeSync.instance.getTime()
        const k = SteamTotp.generateConfirmationKey(options.identitySecret, time, options.tag)
        return {
            p: options.p,
            a: options.a,
            k: k,
            t: time + '',
            m: 'android',
            tag: options.tag
        }
    }

}

class SteamEconModel {
    session?: SteamSession
    constructor(session?: SteamSession) {
        this.session = session
    }

    async getCs2Inventory() {
        if (!this.session) {
            return undefined; // 保持你原有的未登录拦截逻辑
        }

        const [r1, r2] = await Promise.allSettled([
            this._getInventory('2', '730'),
            this._getInventory('16', '730')
        ]);

        // 提取数据：如果成功且有值，则取其值；否则统一赋值为空数组 []
        const inv1 = (r1.status === 'fulfilled' && r1.value) ? r1.value : [];
        const inv2 = (r2.status === 'fulfilled' && r2.value) ? r2.value : [];

        return inv1.concat(inv2);
    }

    private async _getInventory(contextid: string, appid: string){
        if (!this.session){
            return undefined
        }
        return GotHttpApiRequest.get(getEndpoints('Econ', 'GetInventoryItemsWithDescriptions', 1))
            .param(ACCESS_TOKEN_NAME, this.session.access_token)
            .param(STEAM_ID_NAME, this.session.SteamID)
            .param('contextid', contextid)
            .param('appid', appid)
            .param('get_descriptions', true)
            .param('for_trade_offer_verification', false)
            .param('language', DEFAULT_LANGUAGE)
            .param('start_assetid', 0)
            .param('count', 5000)
            .param('get_asset_properties', true)
            .param()
            .userAgent(DEFAULT_USER_AGENT)
            .requestConfig({
                timeout: settingsDb.data.timeout,
                proxies: settingsDb.data.proxy
            })
            .referer(STEAM_COMMUNITY_BASE)
            .perform()
            .then(res => parseSteamCommunityResult<InventoryResponse>(res))
            .catch(reason => parseErrorResult<InventoryResponse>(reason))
            .then(res=>{
                if (res.eresult !== EResult.OK){
                    return undefined
                }
                if (!res.response){
                    return undefined
                }
                const dp:Map<string, InventoryDescription> = new Map<string, InventoryDescription>()
                for (let description of res.response.descriptions) {
                    dp.set(description.classid+"$"+description.instanceid, description)
                }
                const ap:Map<string, InventoryAssetProperty> = new Map<string, InventoryAssetProperty>()
                for (let property of res.response.asset_properties) {
                    ap.set(property.assetid, property)
                }
                return res.response.assets.flatMap(asset=>{
                    const item:InventoryItem = {} as InventoryItem
                    item.appid = asset.appid
                    item.contextid = asset.contextid
                    item.assetid = asset.assetid
                    item.classid = asset.classid
                    item.instanceid = asset.instanceid
                    item.amount = asset.amount
                    const d = dp.get(item.classid+"$"+item.instanceid)
                    if (d){
                        item.currency = d.currency
                        item.background_color = d.background_color
                        item.icon_url = d.icon_url
                        item.icon_url_large = d.icon_url_large
                        item.descriptions = d.descriptions
                        item.tradable = d.tradable
                        item.actions = d.actions
                        item.name = d.name
                        item.name_color = d.name_color
                        item.type = d.type
                        item.market_name = d.market_name
                        item.market_hash_name = d.market_hash_name
                        item.market_actions = d.market_actions
                        item.commodity = d.commodity
                        item.market_tradable_restriction = d.market_tradable_restriction
                        item.market_marketable_restriction = d.market_marketable_restriction
                        item.marketable = d.marketable
                        item.sealed = d.sealed
                        item.market_bucket_group_name = d.market_bucket_group_name
                        item.market_bucket_group_id = d.market_bucket_group_id
                        item.sealed_type = d.sealed_type
                        item.owner_descriptions = d.owner_descriptions
                        item.cd_date = this._getCdDate(d)?.getTime()
                    }
                    const a = ap.get(item.assetid)
                    if (a){
                        const paintSeed = a.asset_properties.find(value => value.propertyid == 1)
                        const paintIndex = a.asset_properties.find(value => value.propertyid == 7)
                        const floatValue = a.asset_properties.find(value => value.propertyid == 2)
                        item.paint_seed = String(paintSeed?.int_value || '')
                        item.paint_index = String(paintIndex?.int_value || '')
                        item.float_value = String(floatValue?.float_value || '')
                        if (floatValue && !paintIndex){
                            item.paint_index = paintIndexDb.get(item.name.replace(/(^(Normal|StatTrak™|★ StatTrak™|★|Souvenir))|(\(Factory New\)|\(Minimal Wear\)|\(Field-Tested\)|\(Well-Worn\)|\(Battle-Scarred\)|\(Gold\)\s|\(Foil\)\s|\(Glitter\)\s|\(Holo\)\s|\(Normal\)\s)/g, ''))
                        }
                        const templateIndex = a.asset_properties.find(value => value.propertyid == 3)
                        item.templateIndex = String(templateIndex?.int_value || '')
                        if (a.asset_accessories){
                            const ss = []
                            for (let assetAccessory of a.asset_accessories) {
                                for (let parentRelationshipProperty of assetAccessory.parent_relationship_properties) {
                                    if (parentRelationshipProperty.propertyid == 4){
                                        let f = parentRelationshipProperty.float_value
                                        if (!f){
                                            f = '0'
                                        }
                                        f = (1-Number(f)).toFixed(2).toString() + '%'
                                        ss.push(f)
                                    }
                                }
                            }
                            item.stickerFloatValues = ss
                        }
                    }

                    return item
                })
            })
    }

    private _getCdDate(destription: InventoryDescription){
        if (!destription) return undefined
        if (destription.tradable) return undefined
        if (!destription.owner_descriptions) return undefined
        for (let ownerDescription of destription.owner_descriptions) {
            if (!ownerDescription.value){
                continue
            }
            const cdDate = parseToLocalTime(ownerDescription.value)
            if (cdDate){
                return cdDate
            }
        }
    }
}

const models: Map<string, SteamAccountModel> = new Map<string, SteamAccountModel>()

export function getSteamModel(account_name: string, passkey?: string) {
    let model = models.get(account_name)
    if (model) {
        return model
    }
    model = new SteamAccountModel(account_name, passkey || runtimeContext.passkey)
    models.set(account_name, model)
    return model
}
