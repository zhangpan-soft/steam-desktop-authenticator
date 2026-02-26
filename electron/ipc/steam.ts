import ipcMainHandler from "./index.ts";
import {generateAuthCode, getConfirmations} from "../steam/steam-community.ts";
import steamLoginExecutor from "../steam/login.ts";
import runtimeContext from "../utils/runtime-context.ts";
import {EResult} from "steam-session";
import {settingsDb, SteamAccountDb, steamAccountDbs} from "../db";
import {RegisterMobileDevice} from "../steam/mobile-device.ts";
import {
    AddAuthenticator,
    FinalizeAddAuthenticator,
    hasPhoneAttached, QueryStatus,
    RemoveAuthenticatorViaChallengeContinue,
    RemoveAuthenticatorViaChallengeStart
} from "../steam/two-factor.ts";

ipcMainHandler
    .handle('steam:login', async (event, args) => {
        console.log('steamLogin', args, event)
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
        console.log('steamRefreshLogin', args, event)
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
        console.log('steamSubmitSteamGuard', args, event)
        return steamLoginExecutor.submitSteamGuardCode(args.account_name, args.steamGuardCode)
    })
    .handle('steam:cancelLogin', (event, args) => {
        console.log('steamCancelLogin', args, event)
        if (!args.account_name) {
            return
        }
        return steamLoginExecutor.cancelLogin(args.account_name)
    })
    .handle('steam:getConfirmations', async (event, args) => {
        console.log('steamGetConfirmations', args, event)
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
    .handle('steam:token', async (event, args) => {
        console.log('steam:token', event, args)
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
        console.log('steam:generateCode', event, args)
        return await generateAuthCode(args.shared_secret)
    })
    .handle('steam:account:get', async (event, args) => {
        console.log('steam:account:get', event, args)
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
        console.log('steam:account:set', event, args)
        const steamAccount = {...args}
        const steamAccountDb = steamAccountDbs.db(steamAccount.account_name, runtimeContext.passkey)
        steamAccountDb.data = {...steamAccountDb.data, ...steamAccount}
        steamAccountDb.update()
        return true
    })
    .handle('steam:MobileDevice:RegisterMobileDevice', async (event, args) => {
        console.log('steam:MobileDevice:RegisterMobileDevice', event, args)
        const steamSession: SteamSession = {...args}
        return RegisterMobileDevice(steamSession.access_token)
    })
    .handle('steam:TwoFactor:AddAuthenticator', async (event, args) => {
        console.log('steam:TwoFactor:AddAuthenticator', event, args)
        const steamSession: SteamSession = {...args}
        const {deviceId} = {...args}
        return AddAuthenticator(steamSession.access_token, deviceId)
    })
    .handle('steam:TwoFactor:FinalizeAddAuthenticator', async (event, args) => {
        console.log('steam:TwoFactor:FinalizeAddAuthenticator', event, args)
        const steamAccount: SteamAccount = {...args}
        const {smsCode} = {...args}
        return FinalizeAddAuthenticator(steamAccount.Session?.access_token as string, steamAccount.shared_secret, smsCode)
    })
    .handle('steam:TwoFactor:RemoveAuthenticatorViaChallengeStart', async (event, args) => {
        console.log('steam:TwoFactor:RemoveAuthenticatorViaChallengeStart', event, args)
        const steamSession: SteamSession = {...args}
        return RemoveAuthenticatorViaChallengeStart(steamSession.access_token, steamSession.cookies)
    })
    .handle('steam:TwoFactor:RemoveAuthenticatorViaChallengeContinue', async (event, args) => {
        console.log('steam:TwoFactor:RemoveAuthenticatorViaChallengeContinue', event, args)
        const steamSession: SteamSession = {...args}
        const {smsCode} = {...args}
        return RemoveAuthenticatorViaChallengeContinue(steamSession.access_token, smsCode)
    })
    .handle('steam:TwoFactor:hasPhoneAttached', async (event, args) => {
        console.log('steam:TwoFactor:hasPhoneAttached', event, args)
        const steamSession: SteamSession = {...args}
        return hasPhoneAttached(steamSession.SessionID, steamSession.cookies)
    })
    .handle('steam:TwoFactor:QueryStatus', async (event,args)=>{
        console.log('steam:TwoFactor:QueryStatus', event, args)
        const steamSession:SteamSession = {...args}
        return QueryStatus(steamSession.access_token)
    })

