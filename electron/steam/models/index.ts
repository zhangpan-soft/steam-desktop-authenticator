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
import runtimeContext from "../../utils/runtime-context.ts";
import windowManager from "../../window-manager.ts";

class SteamMobileDeviceModel {
    deviceId?: string
    flag: boolean = false

    session: SteamSessionModel

    constructor(session: SteamSessionModel) {
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
    session: SteamSessionModel

    phoneNumber?: string
    phoneCountryCode?: string
    stoken?: string
    language?: string

    constructor(session: SteamSessionModel) {
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
            .param(ACCESS_TOKEN_NAME, this.session.access_token || '')
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
            .param(ACCESS_TOKEN_NAME, this.session.access_token || '')
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
    session: SteamSessionModel

    constructor(session: SteamSessionModel) {
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
            .param(ACCESS_TOKEN_NAME, this.session.access_token || '')
            .params(params)
            .requestConfig({timeout: settingsDb.data.timeout, proxies: settingsDb.data.proxy})
            .userAgent(DEFAULT_USER_AGENT)
            .perform()
            .then(res => parseSteamResult<GetNotificationsResponse>(res))
            .catch(reason => parseErrorResult<GetNotificationsResponse>(reason))
    }
}

class SteamSessionModel implements SteamSession{
    access_token: string = ''
    refresh_token: string = ''
    SteamID: string = '0'
    account_name: string
    cookies: string = ''
    at: number = -1
    rt: number = -1
    session_id: string = ''
    lastSessionError?: string

    private _session?: LoginSession
    private readonly _onSessionUpdated?: () => void

    constructor(
        account_name: string,
        session?: SteamSession,
        onSessionUpdated?: () => void
    ) {
        this.account_name = account_name
        this._onSessionUpdated = onSessionUpdated
        this.reload(session)
    }

    private _sessionNumber(value: any, fallback = -1) {
        if (value === undefined || value === null || value === '') {
            return fallback
        }
        const num = Number(value)
        return Number.isFinite(num) ? num : fallback
    }

    private _sessionString(value: any, fallback = '') {
        if (value === undefined || value === null) {
            return fallback
        }
        return String(value)
    }

    reload(session?: Partial<SteamSession> & Record<string, any>){
        if (!session) {
            return
        }
        this.access_token = this._sessionString(session.access_token || session.accessToken, this.access_token)
        this.refresh_token = this._sessionString(session.refresh_token || session.refreshToken, this.refresh_token)
        this.SteamID = this._sessionString(session.SteamID || session.steamid || session.steam_id, this.SteamID)
        this.account_name = this._sessionString(session.account_name || session.accountName, this.account_name)
        this.cookies = this._sessionString(session.cookies, this.cookies)
        this.at = this._sessionNumber(session.at, this.at)
        this.rt = this._sessionNumber(session.rt, this.rt)
        this.session_id = this._sessionString(session.session_id || session.sessionid || session.sessionId, this.session_id)
    }

    toSteamSession(): SteamSession {
        return {
            access_token: this.access_token,
            refresh_token: this.refresh_token,
            SteamID: this.SteamID,
            account_name: this.account_name,
            cookies: this.cookies,
            at: this.at,
            rt: this.rt,
            session_id: this.session_id,
        }
    }

    async getWebCookies() {
        if (!await this.checkSession()) return undefined
        if (settingsDb.data.language === 'zh') {
            return this.cookies.replace(`${STEAM_LANGUAGE_NAME}=${DEFAULT_LANGUAGE}`, `${STEAM_LANGUAGE_NAME}=schinese`)
        }
        return this.cookies
    }

    async cancelLogin() {
        if (this._session) {
            this._session.cancelLoginAttempt()
            this._session.removeAllListeners()
        }
    }

    async login(options: LoginOptions): Promise<SteamLoginEvent> {
        try {
            await this.cancelLogin()
            this._session = new LoginSession(EAuthTokenPlatformType.MobileApp, this._handleSessionOptions())
            this._session.loginTimeout = 120_000

            // 既避免死锁，又让外部(如 checkSession) 能够阻塞等待 token 刷新成功
            return new Promise<SteamLoginEvent>((resolve) => {
                const finish = (evt: SteamLoginEvent) => {
                    this._sendEvent(evt);
                    resolve(evt);
                };

                this._session!.on('authenticated', async () => {
                    finish(await this._handleSession());
                });

                this._session!.on('error', (err) => {
                    if (err.eresult === EResult.InvalidPassword || err.eresult === EResult.AccountLogonDenied) {
                        this.cancelLogin().then();
                    }
                    finish({
                        account_name: this.account_name || 'unknown',
                        result: err.eresult || EResult.Fail,
                        status: 'Failed',
                        error_message: err.message
                    });
                });

                this._session!.on('timeout', () => {
                    this.cancelLogin().then();
                    finish({
                        account_name: this.account_name || 'unknown',
                        result: EResult.Timeout,
                        status: 'Timeout',
                    });
                });

                if (options.refresh_token) {
                    this._session!.refreshToken = options.refresh_token;
                    this._session!.refreshAccessToken().then(async () => {
                        finish(await this._handleSession());
                    }).catch(e => {
                        finish({
                            account_name: this.account_name || 'unknown',
                            result: EResult.Fail,
                            status: 'Failed',
                            error_message: e.message
                        });
                    });
                } else if (options.password) {
                    this._session!.startWithCredentials({
                        accountName: this.account_name,
                        password: options.password,
                        steamGuardCode: options.steamGuardCode
                    }).then(startResult => {
                        if (startResult.actionRequired) {
                            finish({
                                account_name: this.account_name,
                                result: EResult.AccountLogonDenied,
                                status: 'Need2FA',
                                valid_actions: startResult.validActions
                            });
                        }
                    }).catch(e => {
                        if (e.eresult === EResult.InvalidPassword || e.eresult === EResult.AccountLogonDenied) {
                            this.cancelLogin().then();
                        }
                        finish({
                            account_name: this.account_name || 'unknown',
                            result: e.eresult || EResult.Fail,
                            status: 'Failed',
                            error_message: e.message
                        });
                    });
                } else {
                    finish({
                        account_name: this.account_name,
                        result: EResult.InvalidParam,
                        status: 'Failed',
                    });
                }
            });
        } catch (e: any) {
            console.error(`[SteamExecutor] Login Error for ${this.account_name}:`, e);
            const evt: SteamLoginEvent = {
                account_name: this.account_name,
                result: e.eresult || EResult.Fail,
                status: 'Failed',
                error_message: e.message
            }
            this._sendEvent(evt)
            return evt
        }
    }

    async refreshLogin() {
        return this.login({ refresh_token: this.refresh_token });
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

    async submitAuthCode(auth_code: string) {
        if (!this._session) {
            return this._sendEvent({
                account_name: this.account_name || 'unknown',
                result: EResult.Fail,
                error_message: 'Session expired or not found'
            })
        }

        await this._session.submitSteamGuardCode(auth_code).then(() => {
            this._sendEvent({
                account_name: this.account_name || 'unknown',
                status: 'Converting',
                result: EResult.OK
            })
        }).catch((e: any) => {
            console.error(`[SteamExecutor] 2FA Error for ${this.account_name}:`, e);
            this._sendEvent({
                account_name: this.account_name || 'unknown',
                result: EResult.InvalidPassword,
                status: 'Failed',
                error_message: e.message
            })
        })
    }

    private _notifySessionUpdated() {
        try {
            this._onSessionUpdated?.()
        } catch (e) {
            console.error(`[${this.account_name}] Failed to persist session:`, e)
        }
    }

    private async _handleSession(): Promise<SteamLoginEvent> {
        try {
            if (!this._session) {
                await this.cancelLogin()
                return {
                    account_name: this.account_name,
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
            this.access_token = this._session.accessToken
            this.refresh_token = this._session.refreshToken
            this.account_name = this._session.accountName || this.account_name
            this.SteamID = this._session.steamID.getSteamID64()
            this.cookies = cookies.join(";")
            this.session_id = _s?.trim().replace('sessionid=', '') || ''
            this.at = parseToken(this._session.accessToken).payload.exp
            this.rt = parseToken(this._session.refreshToken).payload.exp
            this._notifySessionUpdated()
            return {
                account_name: this.account_name,
                result: EResult.OK,
                status: 'LoginSuccess',
                data: {
                    access_token: this.access_token,
                    refresh_token: this.refresh_token,
                    account_name: this.account_name,
                    SteamID: this.SteamID,
                    cookies: this.cookies,
                    session_id: this.session_id,
                    at: this.at,
                    rt: this.rt
                }
            }
        } catch (e: any) {
            return {
                account_name: this.account_name || 'unknown',
                result: e.eresult || EResult.Fail,
                status: 'Failed',
                error_message: 'Failed to retrieve cookies'
            }
        }
    }

    private _sendEvent(event: SteamLoginEvent){
        windowManager.sendEvent('/', 'steam:message:login-status-changed', event)
        windowManager.sendEvent(`steam-login:${event.account_name}`, 'steam:message:login-status-changed', event)
    }

    public async checkSession(): Promise<boolean> {
        try {
            this.lastSessionError = undefined
            if (!this.refresh_token) {
                this.lastSessionError = 'missingRefreshToken'
                return false
            }
            const time = await SteamTimeSync.instance.getTime()
            if (!this.access_token || time > (this.at - 5 * 60)) {
                if (time > this.rt) {
                    this.lastSessionError = 'refreshTokenExpired'
                    return false
                }
                const evt = await this.login({refresh_token: this.refresh_token})
                if (evt.result !== EResult.OK) {
                    this.lastSessionError = evt.error_message || 'sessionRefreshFailed'
                }
                return evt.result === EResult.OK
            }
            return true
        } catch (e) {
            this.lastSessionError = e instanceof Error ? e.message : 'sessionRefreshFailed'
            return false
        }
    }

}

class SteamAccountModel implements SteamAccount {
    guard?: SteamGuard
    state?: TwoFactorState
    smsCode?: string

    mobileDevice: SteamMobileDeviceModel

    phone: SteamPhoneModel

    notification: SteamNotificationModel

    econ: SteamEconModel

    session: SteamSessionModel

    private db: SteamAccountDb

    constructor(account_name: string, passkey?: string) {
        this.db = new SteamAccountDb(path.join(settingsDb.data.maFilesDir, `${account_name}.maFile`), passkey)
        this.guard = this.db.data.guard

        this.session = new SteamSessionModel(account_name, this.db.data.session, () => this.save())
        this.mobileDevice = new SteamMobileDeviceModel(this.session)
        this.phone = new SteamPhoneModel(this.session)
        this.notification = new SteamNotificationModel(this.session)
        this.econ = new SteamEconModel(this.session)
    }



    setPasskey(passkey?: string) {
        this.db.setPasskey(passkey)
    }

    save() {
        if (this.session) {
            this.db.data.session = this.session.toSteamSession()
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
        if (!this.guard || !await this.session.checkSession()) {
            return undefined
        }

        const ret = await this.generateConfirmationQueryParamsAsNVC({
            identitySecret: this.guard.identity_secret,
            tag: 'detail',
            p: this.guard.device_id,
            a: this.session.SteamID
        })
        return GotHttpApiRequest.get(`${COMMUNITY_ENDPOINTS.confirmationDetail}${confirmationId}`)
            .params(ret)
            .userAgent(DEFAULT_USER_AGENT)
            .requestConfig({
                timeout: settingsDb.data.timeout,
                proxies: settingsDb.data.proxy
            })
            .referer(STEAM_COMMUNITY_BASE)
            .cookie(await this.session.getWebCookies() || '')
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
        if (!this.guard) {
            return {
                eresult: EResult.AccessDenied,
                response: undefined,
                status: 0,
                message: 'noGuard'
            } as SteamResponse<ConfirmationsResponse>
        }
        if (!await this.session.checkSession()) {
            return {
                eresult: EResult.AccessDenied,
                response: undefined,
                status: 0,
                message: this.session.lastSessionError || 'sessionExpired'
            } as SteamResponse<ConfirmationsResponse>
        }

        const params = await this.generateConfirmationQueryParamsAsNVC({
            tag: 'list',
            identitySecret: this.guard.identity_secret,
            p: this.guard.device_id,
            a: this.session.SteamID || '0'
        })
        return GotHttpApiRequest.get(COMMUNITY_ENDPOINTS.confirmations)
            .params(params)
            .userAgent(DEFAULT_USER_AGENT)
            .requestConfig({
                timeout: settingsDb.data.timeout,
                proxies: settingsDb.data.proxy
            })
            .referer(STEAM_COMMUNITY_BASE)
            .cookie(await this.session.getWebCookies() || '')
            .perform()
            .then(res => parseSteamCommunityResult<ConfirmationsResponse>(res))
            .catch(reason => parseErrorResult<ConfirmationsResponse>(reason))
    }

    private async _challengeAuthenticatorStart(): Promise<void> {
        if (!await this.session.checkSession()) {
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
        if (!await this.session.checkSession()) {
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
        if (!await this.session.checkSession()) {
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
        if (!await this.session.checkSession()) {
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
        if (!await this.session.checkSession()) {
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
            a: this.session.SteamID
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
            .cookie(await this.session.getWebCookies()||'')
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
    session: SteamSessionModel

    constructor(session: SteamSessionModel) {
        this.session = session
    }

    async getCs2Inventory() {
        if (!this.session || !await this.session.checkSession()) {
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

    private async _getInventory(contextid: string, appid: string) {
        if (!this.session) {
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
            .then(res => {
                if (res.eresult !== EResult.OK) {
                    return undefined
                }
                if (!res.response) {
                    return undefined
                }
                const dp: Map<string, InventoryDescription> = new Map<string, InventoryDescription>()
                for (let description of res.response.descriptions) {
                    dp.set(description.classid + "$" + description.instanceid, description)
                }
                const ap: Map<string, InventoryAssetProperty> = new Map<string, InventoryAssetProperty>()
                for (let property of res.response.asset_properties) {
                    ap.set(property.assetid, property)
                }
                return res.response.assets.flatMap(asset => {
                    const item: InventoryItem = {} as InventoryItem
                    item.appid = asset.appid
                    item.contextid = asset.contextid
                    item.assetid = asset.assetid
                    item.classid = asset.classid
                    item.instanceid = asset.instanceid
                    item.amount = asset.amount
                    const d = dp.get(item.classid + "$" + item.instanceid)
                    if (d) {
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
                    if (a) {
                        const paintSeed = a.asset_properties.find(value => value.propertyid == 1)
                        const paintIndex = a.asset_properties.find(value => value.propertyid == 7)
                        const floatValue = a.asset_properties.find(value => value.propertyid == 2)
                        item.paint_seed = String(paintSeed?.int_value || '')
                        item.paint_index = String(paintIndex?.int_value || '')
                        item.float_value = String(floatValue?.float_value || '')
                        if (floatValue && !paintIndex) {
                            item.paint_index = paintIndexDb.get(item.name.replace(/(^(Normal|StatTrak™|★ StatTrak™|★|Souvenir))|(\(Factory New\)|\(Minimal Wear\)|\(Field-Tested\)|\(Well-Worn\)|\(Battle-Scarred\)|\(Gold\)\s|\(Foil\)\s|\(Glitter\)\s|\(Holo\)\s|\(Normal\)\s)/g, ''))
                        }
                        const templateIndex = a.asset_properties.find(value => value.propertyid == 3)
                        item.templateIndex = String(templateIndex?.int_value || '')
                        if (a.asset_accessories) {
                            const ss = []
                            for (let assetAccessory of a.asset_accessories) {
                                for (let parentRelationshipProperty of assetAccessory.parent_relationship_properties) {
                                    if (parentRelationshipProperty.propertyid == 4) {
                                        let f = parentRelationshipProperty.float_value
                                        if (!f) {
                                            f = '0'
                                        }
                                        f = (1 - Number(f)).toFixed(2).toString() + '%'
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

    private _getCdDate(destription: InventoryDescription) {
        if (!destription) return undefined
        if (destription.tradable) return undefined
        if (!destription.owner_descriptions) return undefined
        for (let ownerDescription of destription.owner_descriptions) {
            if (!ownerDescription.value) {
                continue
            }
            const cdDate = parseToLocalTime(ownerDescription.value)
            if (cdDate) {
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
