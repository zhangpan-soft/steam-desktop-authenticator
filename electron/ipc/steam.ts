import ipcMainHandler from "./index.ts";
import {EResult} from "steam-session";
import {settingsDb, SteamAccountDb} from "../db";
import {SteamTimeSync, getSteamModel} from '../steam/models'
import {openSteamCommunityWindow} from "../utils/steam-browser.ts";

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => resolve(fallback), timeoutMs)
        promise
            .then(value => {
                clearTimeout(timer)
                resolve(value)
            })
            .catch(error => {
                clearTimeout(timer)
                reject(error)
            })
    })
}

ipcMainHandler
    .handle('steam:login', async (event, args) => {
        const {account_name, shared_secret, ...rawLoginOptions} = args as LoginOptions & {
            account_name: string
            shared_secret?: string
        }
        const loginOptions: LoginOptions = {...rawLoginOptions}
        const model = getSteamModel(account_name)
        if (shared_secret) {
            loginOptions.steamGuardCode = await model.generateAuthCode(shared_secret)
        }else if (model.guard){
            loginOptions.steamGuardCode = await model.generateAuthCode()
        }
        return model.session.login(loginOptions)
    })
    .handle('steam:RefreshLogin', async (event, args)=>{
        try {
            const model = getSteamModel(args.account_name)
            if (!model.session.refresh_token){
                return false
            }
            const steamLoginEvent = await model.session.refreshLogin()
            return !(!steamLoginEvent || steamLoginEvent.status !== 'LoginSuccess');
        } catch (e) {
            return false
        }
    })
    .handle('steam:submitSteamGuard', (event, args) => {
        return getSteamModel(args.account_name).session.submitAuthCode(args.steamGuardCode)
    })
    .handle('steam:cancelLogin', (event, args) => {
        if (!args.account_name) {
            return
        }
        return getSteamModel(args.account_name).session.cancelLogin()
    })
    .handle('steam:getConfirmations', async (event, args) => {
        const timeoutMs = Math.max(Number(settingsDb.data.timeout) || 10_000, 1_000) + 2_000
        return withTimeout(
            getSteamModel(args.account_name).getConfirmations(),
            timeoutMs,
            {
                eresult: EResult.Timeout,
                response: undefined,
                status: 0,
                message: 'Request timed out'
            } as SteamResponse<ConfirmationsResponse>
        )
    })
    .handle('steam:getCs2Inventory', async (event, args) => {
        try {
            const model = getSteamModel(args.account_name)
            if (!await model.session.checkSession()) {
                return {
                    success: false,
                    error: 'sessionExpired'
                }
            }
            return {
                success: true,
                items: await model.econ.getCs2Inventory() || []
            }
        } catch (e: any) {
            return {
                success: false,
                error: 'failed',
                message: e?.message
            }
        }
    })
    .handle('steam:confirmations:respond', async (event, args) => {
        const { account_name, confId, confKey, action } = args

        // 构造一个只包含必要字段的 Confirmation 对象
        const confirmation = { id: confId, nonce: confKey } as Confirmation

        const model = getSteamModel(account_name)

        if (action === 'accept') {
            return model.acceptConfirmation(confirmation)
        } else {
            return model.cancelConfirmation(confirmation)
        }
    })
    .handle('steam:token', async (event, args) => {
        const {account_name} = {...args}
        const token = await getSteamModel(account_name).generateAuthCode()
        const progress = (30 - await SteamTimeSync.instance.getTime() % 30) / 30 * 100
        return {
            token,
            progress
        }
    })
    .handle('steam:generateCode', async (event, args) => {
        return await getSteamModel(args.account_name).generateAuthCode(args.shared_secret)
    })
    .handle('steam:account:get', async (event, args) => {
        const {account_name, filepath, passkey} = {...args}
        if (filepath){
            const steamAccountDb = new SteamAccountDb(filepath, passkey)
            const model = getSteamModel(steamAccountDb.data.guard?.account_name || steamAccountDb.data.session?.account_name || 'unknown')
            model.session.reload(steamAccountDb.data.session)
            model.guard = steamAccountDb.data.guard
            model.save()
            return steamAccountDb.data
        } else {
            const model = getSteamModel(account_name)
            return {
                session: model.session.toSteamSession(),
                guard: model.guard
            } as SteamAccount
        }
    })
    .handle('steam:addAuthenticator', async (event, args)=>{
        const {account_name, smsCode, phoneNumber, phoneCountryCode} = {...args}
        const model = getSteamModel(account_name)
        if (smsCode){
            model.smsCode = smsCode
        }
        if (phoneNumber){
            model.phone.phoneNumber = phoneNumber
        }
        if (phoneCountryCode){
            model.phone.phoneCountryCode = phoneCountryCode
        }
        await model.addAuthenticator()
        return model.state
    })
    .handle('steam:open-notifications', async (event, args) => {
        const { account_name } = args
        const model = getSteamModel(account_name)
        if (!await model.session.checkSession()) return
        await openSteamCommunityWindow(`https://steamcommunity.com/profiles/${model.session.SteamID}/notifications`, account_name)
    })
    .handle('steam:open-community-window',async (event, args)=>{
        let {account_name, url} = args
        const model = getSteamModel(account_name)
        if (!await model.session.checkSession()) return
        url = url.replace('%s%', model.session.SteamID)
        await openSteamCommunityWindow(url, account_name)
    })
