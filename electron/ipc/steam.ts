import ipcMainHandler from "./index.ts";
import {generateAuthCode, getConfirmations, acceptConfirmation, cancelConfirmation} from "../steam/steam-community.ts";
import steamLoginExecutor from "../steam/login.ts";
import runtimeContext from "../utils/runtime-context.ts";
import {EResult} from "steam-session";
import {settingsDb, SteamAccountDb, steamAccountDbs} from "../db";
import {RegisterMobileDevice} from "../steam/mobile-device.ts";
import {
    AddAuthenticator,
    FinalizeAddAuthenticator,
    QueryStatus,
    RemoveAuthenticatorViaChallengeContinue,
    RemoveAuthenticatorViaChallengeStart
} from "../steam/two-factor.ts";
import {
    ConfirmAddPhoneToAccount,
    IsAccountWaitingForEmailConfirmation,
    SendPhoneVerificationCode, SetAccountPhoneNumber, VerifyAccountPhoneWithCode
} from "../steam/phone.ts";

ipcMainHandler
    .handle('steam:login', async (event, args) => {
        const loginOptions: LoginOptions = {...args}
        if (args.shared_secret) {
            loginOptions.steamGuardCode = await generateAuthCode(args.shared_secret)
        }
        const settings = settingsDb.data
        if (settings.entries) {
            const item = settings.entries.find(s => s.account_name === args.account_name)
            if (item) {
                const steamAccount = steamAccountDbs.db(args.account_name, runtimeContext.passkey)
                loginOptions.steamGuardCode = await generateAuthCode(steamAccount.data.shared_secret)
            }
        }
        return steamLoginExecutor.login(loginOptions)
    })
    .handle('steam:RefreshLogin', async (event, args)=>{
        try {
            const steamAccount = steamAccountDbs.db(args.account_name, runtimeContext.passkey).data
            if (!steamAccount || !steamAccount.Session || !steamAccount.Session.refresh_token) {
                return false
            }
            const steamLoginEvent = await steamLoginExecutor.refreshLogin(args.account_name, steamAccount.Session.refresh_token)
            if (!steamLoginEvent || steamLoginEvent.status !== 'LoginSuccess') {
                return false
            }
            steamAccount.Session = {...steamLoginEvent.data} as SteamSession
            steamAccountDbs.db(args.account_name, runtimeContext.passkey).update()
            return true
        } catch (e) {
            return false
        }
    })
    .handle('steam:submitSteamGuard', (event, args) => {
        return steamLoginExecutor.submitSteamGuardCode(args.account_name, args.steamGuardCode)
    })
    .handle('steam:cancelLogin', (event, args) => {
        if (!args.account_name) {
            return
        }
        return steamLoginExecutor.cancelLogin(args.account_name)
    })
    .handle('steam:getConfirmations', async (event, args) => {
        const steamAccountDb = steamAccountDbs.db(args.account_name, runtimeContext.passkey)
        const response: SteamResponse<ConfirmationsResponse> = {eresult: EResult.Fail, status: 0}
        if (!steamAccountDb.data.Session) {
            response.eresult = EResult.AccessDenied
            response.message = 'Session not found'
            return response
        }
        if (!steamAccountDb.data.Session.access_token && !steamAccountDb.data.Session.refresh_token) {
            response.eresult = EResult.AccessDenied
            response.message = 'Session not found'
            return response
        }
        if (steamAccountDb.data.Session.rt < Date.now() / 1000) {
            response.eresult = EResult.Expired
            response.message = 'Session Expired'
            return response
        }
        if (steamAccountDb.data.Session.at < Date.now() / 1000) {
            const loginEvent = await steamLoginExecutor.refreshLogin(args.account_name, steamAccountDb.data.Session.refresh_token)
            if (!(loginEvent.result === EResult.OK && loginEvent.status === 'LoginSuccess')) {
                response.eresult = loginEvent.result || EResult.Fail
                response.message = loginEvent.error_message
                return response
            } else {
                steamAccountDb.data.Session = {...loginEvent.data} as SteamSession
                steamAccountDb.update()
            }
        }
        return getConfirmations({
            identitySecret: steamAccountDb.data.identity_secret,
            deviceid: steamAccountDb.data.device_id,
            steamid: steamAccountDb.data.Session.SteamID,
            cookies: steamAccountDb.data.Session.cookies
        })
    })
    .handle('steam:confirmations:respond', async (event, args) => {
        const { account_name, confId, confKey, action } = args
        const steamAccountDb = steamAccountDbs.db(account_name, runtimeContext.passkey)

        if (!steamAccountDb.data.Session) {
            return { eresult: EResult.Fail, message: 'Session not found', status: 0 }
        }

        const options = {
            identitySecret: steamAccountDb.data.identity_secret,
            deviceid: steamAccountDb.data.device_id,
            steamid: steamAccountDb.data.Session.SteamID,
            cookies: steamAccountDb.data.Session.cookies
        }

        // 构造一个只包含必要字段的 Confirmation 对象
        const confirmation = { id: confId, nonce: confKey } as Confirmation

        if (action === 'accept') {
            return acceptConfirmation(options, confirmation)
        } else {
            return cancelConfirmation(options, confirmation)
        }
    })
    .handle('steam:token', async (event, args) => {
        const {account_name} = {...args}
        const steamAccountDb = steamAccountDbs.db(account_name, runtimeContext.passkey)
        const token = await generateAuthCode(steamAccountDb.data.shared_secret)
        const progress = (30 - (Date.now() / 1000 + runtimeContext.timeOffset) % 30) / 30 * 100
        return {
            token,
            progress
        }
    })
    .handle('steam:generateCode', async (event, args) => {
        return await generateAuthCode(args.shared_secret)
    })
    .handle('steam:account:get', async (event, args) => {
        const {account_name, filepath, passkey} = {...args}
        if (filepath){
            const steamAccountDb = new SteamAccountDb(filepath, passkey)
            return steamAccountDb.data
        } else {
            const steamAccountDb = steamAccountDbs.db(account_name, runtimeContext.passkey)
            return steamAccountDb.data
        }
    })
    .handle('steam:account:set', async (event, args) => {
        const steamAccount = {...args}
        const steamAccountDb = steamAccountDbs.db(steamAccount.account_name, runtimeContext.passkey)
        steamAccountDb.data = {...steamAccountDb.data, ...steamAccount}
        steamAccountDb.update()
        return true
    })
    .handle('steam:MobileDevice:RegisterMobileDevice', async (event, args) => {
        const steamSession: SteamSession = {...args}
        return RegisterMobileDevice(steamSession.access_token)
    })
    .handle('steam:TwoFactor:AddAuthenticator', async (event, args) => {
        const steamSession: SteamSession = {...args}
        const {deviceId} = {...args}
        return AddAuthenticator(steamSession.access_token, deviceId)
    })
    .handle('steam:TwoFactor:FinalizeAddAuthenticator', async (event, args) => {
        const steamAccount: SteamAccount = {...args}
        const {smsCode} = {...args}
        return FinalizeAddAuthenticator(steamAccount.Session?.access_token as string, steamAccount.shared_secret, smsCode)
    })
    .handle('steam:TwoFactor:RemoveAuthenticatorViaChallengeStart', async (event, args) => {
        const steamSession: SteamSession = {...args}
        return RemoveAuthenticatorViaChallengeStart(steamSession.access_token, steamSession.cookies)
    })
    .handle('steam:TwoFactor:RemoveAuthenticatorViaChallengeContinue', async (event, args) => {
        const steamSession: SteamSession = {...args}
        const {smsCode} = {...args}
        return RemoveAuthenticatorViaChallengeContinue(steamSession.access_token, smsCode)
    })
    .handle('steam:TwoFactor:QueryStatus', async (event,args)=>{
        const steamSession:SteamSession = {...args}
        return QueryStatus(steamSession.access_token)
    })
    .handle('steam:Phone:ConfirmAddPhoneToAccount',(event, args)=>{
        const {access_token, steamid, stoken} = {...args}
        return ConfirmAddPhoneToAccount(access_token, steamid, stoken)
    })
    .handle('steam:Phone:IsAccountWaitingForEmailConfirmation', (event, args)=>{
        const {access_token} = {...args}
        return IsAccountWaitingForEmailConfirmation(access_token)
    })
    .handle('steam:Phone:SendPhoneVerificationCode', (event, args)=>{
        const {access_token, language} = {...args}
        return SendPhoneVerificationCode(access_token, language)
    })
    .handle('steam:Phone:SetAccountPhoneNumber', (event, args)=>{
        const {access_token, phoneNumber, phoneCountryCode} = {...args}
        return SetAccountPhoneNumber(access_token, phoneNumber, phoneCountryCode)
    })
    .handle('steam:Phone:VerifyAccountPhoneWithCode', (event, args)=>{
        const {access_token, code} = {...args}
        return VerifyAccountPhoneWithCode(access_token, code)
    })
