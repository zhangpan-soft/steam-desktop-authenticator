import ipcMainHandler from "./index.ts";
import {SteamAccountDb} from "../db";
import {SteamTimeSync, getSteamModel} from '../steam/models'
import {openSteamNotificationsWindow} from "../utils/steam-browser.ts";
import {toJson} from "../utils/json-util.ts";

ipcMainHandler
    .handle('steam:login', async (event, args) => {
        const loginOptions: LoginOptions = {...args}
        const model = getSteamModel(loginOptions.account_name)
        if (args.shared_secret) {
            loginOptions.steamGuardCode = await model.generateAuthCode(args.shared_secret)
        }else if (model.guard){
            loginOptions.steamGuardCode = await model.generateAuthCode()
        }
        return model.login.login(loginOptions)
    })
    .handle('steam:RefreshLogin', async (event, args)=>{
        try {
            const model = getSteamModel(args.account_name)
            if (!model.session){
                return false
            }
            const steamLoginEvent = await model.login.refreshLogin(model.session.refresh_token)
            return !(!steamLoginEvent || steamLoginEvent.status !== 'LoginSuccess');
        } catch (e) {
            return false
        }
    })
    .handle('steam:submitSteamGuard', (event, args) => {
        return getSteamModel(args.account_name).login.submitAuthCode(args.steamGuardCode)
    })
    .handle('steam:cancelLogin', (event, args) => {
        if (!args.account_name) {
            return
        }
        return getSteamModel(args.account_name).login.cancelLogin()
    })
    .handle('steam:getConfirmations', async (event, args) => {
        return getSteamModel(args.account_name).getConfirmations()
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
        console.log(`args:${toJson(args)}`)
        if (filepath){
            const steamAccountDb = new SteamAccountDb(filepath, passkey)
            const model = getSteamModel(steamAccountDb.data.guard?.account_name || steamAccountDb.data.session?.account_name || 'unknown')
            model.session = steamAccountDb.data.session
            model.guard = steamAccountDb.data.guard
            model.save()
            return steamAccountDb.data
        } else {
            const model = getSteamModel(account_name)
            return {
                session: model.session,
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
        if (!model.session) return
        await openSteamNotificationsWindow(account_name, model.session)
    })
