import {ipcRenderer, contextBridge} from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
    on(channel: ElectronMessageChannel, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) {
        return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
    },
    off(channel: ElectronMessageChannel, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) {
        return ipcRenderer.off(channel, (event, ...args)=>listener(event, ...args))
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

contextBridge.exposeInMainWorld('store',{
    getInitialState: () => ipcRenderer.invoke('store:get-initial'),

    // 发送时带上 scope
    syncSet: (scope: string, path: string, value: any) =>
        ipcRenderer.send('store:renderer-update', scope, path, value),

    onSyncUpdate: (callback: Function) => {
        ipcRenderer.on('store:main-update', (_event, scope, path, value) =>
            callback(scope, path, value)
        );
    }
})
