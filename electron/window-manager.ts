import {app, BrowserWindow, BrowserWindowConstructorOptions} from 'electron'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import path from 'node:path'

createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

class WindowManager {
    private _main: BrowserWindow | null = null
    private _preload: string
    private readonly _child: Map<WindowHashType, BrowserWindow> = new Map<WindowHashType, BrowserWindow>()

    constructor() {
        this._preload = path.join(__dirname, 'preload.mjs')
    }

    public init() {
        if (this._main) return; // 防止重复初始化

        this._main = this._createWindow({
            icon: path.join(process.env.VITE_PUBLIC, 'Steam.svg'),
            width: 420,   // 改窄，模仿手机/工具宽度
            height: 600,  // 高度适中
            useContentSize: true, // 确保内容区域有这么大
            resizable: false, // 允许调整，但你可以设为 false 固定大小
            minWidth: 420,   // 限制最小宽度
            minHeight: 600,
            maximizable: false,
            minimizable: true,
            show: false
        })
        this._load({hash: '/'})
        this._main.webContents.on('did-finish-load', () => {
            this._main?.webContents.send('main-process-message', (new Date).toLocaleString())
        })
        this._main.on('closed', () => {
            app.quit()
            this._main = null
        })
        this._main.show()
        this._main.focus()
    }

    private _createWindow(options: BrowserWindowConstructorOptions) {
        options = {...options}
        if (options.icon && !options.icon?.toString().startsWith('/')) {
            options.icon = path.join(process.env.VITE_PUBLIC, options.icon as string)
        }
        options.webPreferences = {...options.webPreferences, preload: this._preload}
        return new BrowserWindow(options)
    }

    private _load(uri: WindowUri) {
        uri = {...uri}
        uri.hash = uri.hash || '/'
        // 1. 拿到基础 Hash，比如 '/login'
        let finalHash = uri.hash || '/';

        // 2. 关键步骤：手动把 query 拼接到 hash 后面！
        // 这样 Electron 以为这整个字符串都是 hash
        if (uri.query) {
            const queryString = new URLSearchParams(uri.query).toString();
            // 结果变成: "/login?id=1&type=admin"
            finalHash += `?${queryString}`;
        }
        let win
        if (uri.hash === '/') {
            win = this._main
        } else {
            win = this._child.get(uri.hash)
        }

        console.log('222222222', finalHash, win)

        if (!win) {
            throw new Error('Window not found')
        }

        win.setMenu(null)

        if (VITE_DEV_SERVER_URL) {
            win.loadURL(`${VITE_DEV_SERVER_URL}#${finalHash}`)
            win.webContents.openDevTools()
        } else {
            win.loadFile(path.join(RENDERER_DIST, 'index.html'), {hash: finalHash})
        }
    }

    public addChild(uri: WindowUri, options: BrowserWindowConstructorOptions) {

        console.log('addWindow', uri, options)

        if (!this._main) {
            throw new Error('Main window not initialized');
        }
        if (uri.hash === '/') {
            throw new Error('Child windows uri not empty or /');
        }


        const existingWin = this._child.get(uri.hash);
        if (existingWin && !existingWin.isDestroyed()) {
            this._load(uri)
            existingWin.show()
            return
        } else {
            this._child.delete(uri.hash)
        }

        const win = this._createWindow(options)
        this._child.set(uri.hash, win)
        this._load(uri)

        win.on('closed', () => {
            this._child.delete(uri.hash)
        })
        win.show()
        win.focus()
    }

    public removeChild(hash: WindowHashType) {
        if (this._child.has(hash)) {
            this._child.get(hash)?.close()
            this._child.delete(hash)
        }
    }

    public sendEvent(hash: WindowHashType, channel: ElectronMessageChannel, ...args: any[]) {
        if (hash === '/') {
            this._main?.webContents.send(channel, ...args)
        } else if (this._child.has(hash)) {
            this._child.get(hash)?.webContents.send(channel, ...args)
        }
    }

    public show(hash: WindowHashType) {
        if (hash === '/') {
            this._main?.show()
        } else if (this._child.has(hash)) {
            this._child.get(hash)?.show()
            this._child.get(hash)?.focus()
        }
    }

    public hide(hash: WindowHashType) {
        if (hash === '/') {
            this._main?.hide()
        } else if (this._child.has(hash)) {
            this._child.get(hash)?.hide()
        }
    }

    public close(hash: WindowHashType) {
        if (hash === '/') {
            this._main?.close()
            this._main = null
        } else if (this._child.has(hash)) {
            this._child.get(hash)?.close()
            this._child.delete(hash)
        }
    }

    public getWindow(hash: WindowHashType) {
        if (hash === '/') {
            return this._main
        } else if (this._child.has(hash)) {
            return this._child.get(hash)
        }
    }
}

const windowManager = new WindowManager()

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        windowManager.init() // 确保重新初始化
    }
})

app.whenReady().then(() => {
    windowManager.init() // 在 ready 后初始化
})

export default windowManager
