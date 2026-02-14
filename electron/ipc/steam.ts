import ipcMainHandler from "./index.ts";
import {generateAuthCode, getConfirmations} from "../steam/steam-community.ts";
import {readMaFile} from "../ma-file.ts";
import path from "node:path";
import steamLoginExecutor from "../steam/login.ts";
import fs from "node:fs/promises";
import {getSettingsDb, getSteamAccountDb} from "../db";
import runtimeContext from "../utils/runtime-context.ts";
import {EResult} from "steam-session";

ipcMainHandler
    .handle('steam:login', async (event, args) => {
        console.log('steamLogin', args, event)
        const loginOptions: LoginOptions = {...args}
        if (args.shared_secret) {
            loginOptions.steamGuardCode = await generateAuthCode(args.shared_secret)
        }
        const settingsDb = await getSettingsDb()
        const settings = settingsDb.data
        if (settings.entries) {
            const item = settings.entries.find(s => s.account_name === args.account_name)
            if (item) {
                const steamAccount = await getSteamAccountDb(args.account_name, runtimeContext.passkey)
                loginOptions.steamGuardCode = await generateAuthCode(steamAccount.data.shared_secret)
            }
        }
        return steamLoginExecutor.login(loginOptions)
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
    .handle('importMaFile', async (event, args) => {
        console.log('importMaFile', args, event)
        if (args.passkey) {
            const fileExists = async (filepath: string) => {
                return await fs.access(filepath).then(() => {
                    return true
                }).catch(() => {
                    return false
                })
            }
            let manifest_path = path.join(path.dirname(args.path), 'manifest.json')
            let exists = await fileExists(manifest_path);
            if (!exists) {
                manifest_path = path.join(args.path, 'settings.json')
                exists = await fileExists(manifest_path)
            }
            if (!exists) {
                throw new Error('manifest.json not found')
            }
            const manifestText = await fs.readFile(manifest_path, 'utf8')
            const manifest = JSON.parse(manifestText)
            if (!manifest.entries || manifest.entries.length == 0) {
                throw new Error('manifest.json entries is empty')
            }
            const maFileParse = path.parse(args.path)
            const acc = manifest.entries.find((value: any) => value.filename === maFileParse.name + '.' + maFileParse.ext)
            if (!acc) {
                throw new Error('manifest.json entries is empty')
            }
            return readMaFile(args.path, {passkey: args.passkey, iv: acc.encryption_iv, salt: acc.encryption_salt})
        } else {
            return readMaFile(args.path)
        }
    })
    .handle('steam:getConfirmations', async (event, args) => {
        console.log('steamGetConfirmations', args, event)
        const steamAccountDb = await getSteamAccountDb(args.account_name, runtimeContext.passkey)
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
        const steamAccountDb = await getSteamAccountDb(account_name, runtimeContext.passkey)
        const token = await generateAuthCode(steamAccountDb.data.shared_secret)
        const progress = (30 - (Date.now() / 1000 + runtimeContext.timeOffset) % 30) / 30 * 100
        return {
            token,
            progress
        }
    })
    .handle('steam:account:get', async (event, args) => {
        console.log('steam:account:get', event, args)
        const {account_name} = {...args}
        const steamAccountDb = await getSteamAccountDb(account_name, runtimeContext.passkey)
        return steamAccountDb.data
    })
    .handle('steam:account:set', async (event, args) => {
        console.log('steam:account:set', event, args)
        const steamAccount = {...args}
        const steamAccountDb = await getSteamAccountDb(steamAccount.account_name, runtimeContext.passkey)
        steamAccountDb.data = {...steamAccountDb.data, ...steamAccount}
        await steamAccountDb.write()
        const settingDb = await getSettingsDb()
        settingDb.data.entries.push({
            steamid: steamAccountDb.data.Session?.SteamID as string,
            account_name: steamAccountDb.data.account_name as string
        })
        await settingDb.write()
        return true
    })

