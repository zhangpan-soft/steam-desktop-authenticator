import {ipcRenderer, contextBridge} from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
    on(channel: ElectronMessageChannel, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) {
        return ipcRenderer.on(channel, listener)
    },
    off(channel: ElectronMessageChannel, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) {
        return ipcRenderer.off(channel, listener)
    },
    send(channel: ElectronMessageChannel, ...args:any[]) {
        return ipcRenderer.send(channel, ...args)
    },
    invoke(channel: ElectronMessageChannel, ...args: any[]) {
        return ipcRenderer.invoke(channel, ...args)
    }
    // You can expose other APTs you need here.
    // ...
})
