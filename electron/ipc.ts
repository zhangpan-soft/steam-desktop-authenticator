import {dialog, ipcMain} from 'electron'
import * as fs from 'node:fs/promises';
import {readMaFile, saveMaFile} from './ma-file.ts'
import globalStore from "./store";
import path from "node:path";
import steamLoginExecutor from "./steam/login.ts";
import {generateAuthCode, getConfirmations} from "./steam/steam-community.ts";
import {parseToken} from "./steam";

class IpcMainHandler {

    public handle(channel: ElectronMessageChannel, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => (Promise<any>) | (any)): IpcMainHandler {
        ipcMain.handle(channel, listener)
        return this
    }

    public on(channel: ElectronMessageChannel, listener: (event: Electron.IpcMainEvent, ...args: any[]) => void): IpcMainHandler {
        ipcMain.on(channel, listener)
        return this
    }
}

const ipcMainHandler = new IpcMainHandler()

ipcMainHandler
    .handle('showOpenDialog', (event, args) => {
        console.log('showOpenDialog', args, event)
        return dialog.showOpenDialog(args)
    })
    .handle('readFile', (event, args) => {
        console.log('readFile', args, event)
        return fs.readFile(args.path, args.options)
    })
    .handle('readMaFile', (event, args) => {
        console.log('readMaFile', args, event)
        let filepath = args.path
        if (!filepath && args.filename){
            filepath = path.join(globalStore.getState().settings.maFilesDir, args.filename)
        }
        return readMaFile(filepath, {passkey: args.passkey, iv: args.iv, salt: args.salt})
    })
    .handle('saveMaFile', (event, args) => {
        console.log('saveMaFile', args, event)
        return saveMaFile(args.content, args.passkey)
    })
    .handle('steam:login', async (event, args) => {
        console.log('steamLogin', args, event)
        const loginOptions: LoginOptions = {...args}
        if (args.shared_secret) {
            loginOptions.steamGuardCode = await generateAuthCode(args.shared_secret)
        }
        const settings = globalStore.getState().settings
        const runtimeContext = globalStore.getState().runtimeContext
        if (settings.entries) {
            const item = settings.entries.find(s => s.account_name === args.account_name)
            if (item) {
                const maFile = await readMaFile(path.join(settings.maFilesDir, item.filename), {
                    passkey: runtimeContext.passkey,
                    iv: item.encryption_iv,
                    salt: item.encryption_salt
                })
                loginOptions.steamGuardCode = await generateAuthCode(JSON.parse(maFile.maFileContent).shared_secret)
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
        return steamLoginExecutor.cancelLogin(args.account_name)
    })
    .handle('importMaFile',async (event, args)=>{
        console.log('importMaFile', args, event)
        if (args.passkey){
            const fileExists = async (filepath: string)=>{
                return await fs.access(filepath).then(()=>{
                    return true
                }).catch(()=>{
                    return false
                })
            }
            let manifest_path = path.join(path.dirname(args.path),'manifest.json')
            let exists = await fileExists(manifest_path);
            if (!exists){
                manifest_path = path.join(args.path,'settings.json')
                exists = await fileExists(manifest_path)
            }
            if (!exists){
                throw new Error('manifest.json not found')
            }
            const manifestText = await fs.readFile(manifest_path, 'utf8')
            const manifest = JSON.parse(manifestText)
            if (!manifest.entries || manifest.entries.length==0){
                throw new Error('manifest.json entries is empty')
            }
            const maFileParse = path.parse(args.path)
            const acc = manifest.entries.find((value:any)=> value.filename===maFileParse.name+'.'+maFileParse.ext)
            if (!acc){
                throw new Error('manifest.json entries is empty')
            }
            return readMaFile(args.path,{passkey: args.passkey, iv: acc.encryption_iv, salt: acc.encryption_salt})
        } else {
            return readMaFile(args.path)
        }
    })
    .handle('steam:getConfirmations', async (event, args)=>{
        console.log('steamGetConfirmations', args, event)
        const currentAccount = globalStore.getState().runtimeContext.currentAccount
        if (!currentAccount){
            throw new Error('currentAccount not found')
        }
        if (!currentAccount.info){
            throw new Error('currentAccount.info not found')
        }
        if (!currentAccount.info.Session){
            throw new Error('currentAccount.info.Session not found')
        }
        let needRefresh = false
        if (currentAccount.info.Session.at){
            if (Date.now()/1000 > currentAccount.info.Session.at){
                needRefresh = true
            }
        } else {
            const p:any = parseToken(currentAccount.info.Session.access_token)
            if (Date.now()/1000 > p.exp){
                needRefresh = true
            }
        }
        if (needRefresh){
            await steamLoginExecutor.refreshLogin(currentAccount.account_name, currentAccount.info.Session.refresh_token)
                .then(result=>{
                    if (currentAccount.info){
                        currentAccount.info.Session = result.data
                    }
                    return saveMaFile(JSON.stringify(currentAccount.info), globalStore.getState().runtimeContext.passkey)
                })
                .then(()=>{
                    globalStore.updateState('runtime', 'currentAccount', currentAccount)
                })
        }
        return getConfirmations({
            deviceid: currentAccount?.info?.device_id as string,
            steamid: currentAccount?.steamid as string,
            identitySecret: currentAccount?.info?.identity_secret as string,
            cookies: currentAccount?.info?.Session?.cookies as string
        })
    })


export default ipcMainHandler
