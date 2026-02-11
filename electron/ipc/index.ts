import {ipcMain} from 'electron'

export class IpcMainHandler {

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

export default ipcMainHandler

export function initIpc(){
    import('./electron.ts')
    import('./steam.ts')
}
