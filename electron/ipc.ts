import {dialog, ipcMain} from 'electron'
import fs from 'node:fs/promises';
import {readMaFile} from './ma-file.ts'
import {generateAuthCode} from "./steam";
import globalStore from "./store";
import path from "node:path";
import steamLoginExecutor from "./steam/login.ts";

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
        return readMaFile(args.path, args.password)
    })
    .handle('saveMaFile', (event, args) => {
        console.log('saveMaFile', args, event)
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
            const item = settings.entries.find(s => s.filename.startsWith(args.account_name + '.'))
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

export default ipcMainHandler
