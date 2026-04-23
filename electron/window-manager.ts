import {app, BrowserWindow, BrowserWindowConstructorOptions, Notification} from 'electron'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {paintIndexDb, settingsDb} from "./db";
import {getSteamModel} from "./steam/models";
import {DEFAULT_LANGUAGE} from "./steam/constants.ts";
import {EResult} from "steam-session";
import enLocale from '../src/i18n/locales/en.json'
import zhLocale from '../src/i18n/locales/zh.json'
import {openSteamNotificationsWindow} from "./utils/steam-browser.ts";
import {GotHttpApiRequest} from "./utils/requests.ts";

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

// 主进程简易 i18n 翻译函数
function t(keyPath: string, args?: Record<string, any>): string {
    const lang = settingsDb.data.language || 'en'
    const localeData: any = lang === 'zh' ? zhLocale : enLocale

    const keys = keyPath.split('.')
    let result: any = localeData
    for (const k of keys) {
        if (result === undefined) break
        result = result[k]
    }

    let str = typeof result === 'string' ? result : keyPath
    if (args) {
        for (const [k, v] of Object.entries(args)) {
            str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
        }
    }
    return str
}

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
            icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
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

        if (!this._main) {
            throw new Error('Main window not initialized');
        }
        if (uri.hash === '/') {
            throw new Error('Child windows uri not empty or /');
        }

        if (!options.parent){
            options.parent = this._main
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

    // 使用递归 setTimeout 替代 setInterval，防止网络阻塞导致的请求堆积，并支持动态间隔
    const periodicCheck = async () => {
        try {
            if (settingsDb.data.entries && settingsDb.data.entries.length > 0) {
                const isCheckingEnabled = settingsDb.data.periodic_checking ||
                                          settingsDb.data.periodic_checking_checkall ||
                                          settingsDb.data.auto_confirm_trades ||
                                          settingsDb.data.auto_confirm_market_transactions;

                if (isCheckingEnabled) {
                    for (let entry of settingsDb.data.entries) {
                        await checkAccountConfirmations(entry)
                    }
                }
            }
        } catch (e) {
            console.error('Periodic check error:', e)
        }

        // 获取最新间隔时间，最少 5 秒，开始下一轮递归
        const interval = Math.max(Number(settingsDb.data.periodic_checking_interval) || 5, 5) * 1000;
        setTimeout(periodicCheck, interval)
    }

    // 启动轮询
    setTimeout(periodicCheck, 5000)

    const paintIndexCheck = async ()=>{
        try {
            const nextSyncTime = paintIndexDb.get('nextSyncTime')
            if (nextSyncTime && Date.now()<Number(nextSyncTime)){
                return
            }
            await GotHttpApiRequest.get('https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json')
                .param()
                .requestConfig({
                    timeout: settingsDb.data.timeout,
                    proxies: settingsDb.data.proxy
                })
                .perform()
                .then(res=>{
                    const o = res.getBody<Record<string, any>[]>()
                    for (let e of o) {
                        try {
                            paintIndexDb.data[e['name']] = e['weapon']['weapon_id']
                        }catch (e) {
                            console.error(e)
                        }
                    }
                    paintIndexDb.data['nextSyncTime'] = String(Date.now() + 30*60*1000)
                    paintIndexDb.update()
                })
        }catch (e){
            console.error(e)
        }

        setTimeout(paintIndexCheck, 10*1000)
    }

    setTimeout(paintIndexCheck, 10*1000)
})

async function checkAccountConfirmations(entry: EntryType) {
    const model = getSteamModel(entry.account_name)
    const res = await model.notification.getNotifications({
        include_hidden: false,
        language: DEFAULT_LANGUAGE,
        include_confirmation_count: true,
        include_pinned_counts: true,
        include_read: false,
        count_only: true
    })
    if (res.eresult !== EResult.OK) return;

    if (res.response?.confirmation_count && res.response.confirmation_count > 0) {
        const confs = await model.getConfirmations()
        if (confs.eresult === EResult.OK && confs.response?.success && confs.response.conf.length > 0) {
            const trades = confs.response.conf.filter(value => value.type === 2) // ConfirmationType.TRADE = 2
            const markets = confs.response.conf.filter(value => value.type === 3) // ConfirmationType.MARKET = 3

            // 提取出的公共处理函数
            const processList = async (list: any[], autoConfirm: boolean, typeLabel: string, idLabel: string, idField: string) => {
                for (const item of list) {
                    try {
                        const dateStr = new Date(Number(item.creation_time) * 1000).toLocaleDateString()
                        const displayId = item[idField]

                        if (autoConfirm && !item.warn) {
                            await model.acceptConfirmation(item)
                            const n = new Notification({
                                title: t('notifications.autoConfirmTitle', { account: entry.account_name, type: typeLabel }),
                                body: t('notifications.bodyAuto', { idLabel, id: displayId, time: dateStr, summary: item.summary })
                            })
                            n.show()
                        } else {
                            const title = item.warn
                                ? t('notifications.warnConfirmTitle', { account: entry.account_name, type: typeLabel })
                                : t('notifications.confirmTitle', { account: entry.account_name, type: typeLabel })
                            const body = item.warn
                                ? t('notifications.bodyWarn', { warn: item.warn, idLabel, id: displayId, summary: item.summary })
                                : t('notifications.bodyNormal', { idLabel, id: displayId, time: dateStr, summary: item.summary })

                            const n = new Notification({ title, body })
                            n.on('click', () => {
                                windowManager.addChild({
                                    hash: '/steam/confirmations',
                                    query: { account_name: entry.account_name }
                                }, {
                                    width: 600,
                                    height: 800,
                                    useContentSize: true,
                                    resizable: false,
                                    maximizable: false,
                                    minimizable: true,
                                    show: false
                                })
                                n.close()
                            })
                            n.show()
                        }
                    } catch (e) {
                        console.error(`Failed to handle ${typeLabel} transaction:`, e)
                    }
                }
            }

            // 1. 处理交易 (Trade)
            await processList(trades, settingsDb.data.auto_confirm_trades, t('notifications.tradeType'), t('notifications.tradeId'), 'creator_id')

            // 2. 处理市场 (Market)
            await processList(markets, settingsDb.data.auto_confirm_market_transactions, t('notifications.marketType'), t('notifications.marketId'), 'id')
        }
    }

    if ((res.response?.pending_gift_count && res.response.pending_gift_count>0)
        || (res.response?.pending_friend_count && res.response.pending_friend_count>0)
        || (res.response?.pending_family_invite_count && res.response.pending_family_invite_count>0)
    ){
        const msgs = []
        if (res.response.pending_gift_count && res.response.pending_gift_count > 0) msgs.push(t('notifications.pendingGifts', { count: res.response.pending_gift_count }))
        if (res.response.pending_friend_count && res.response.pending_friend_count > 0) msgs.push(t('notifications.pendingFriends', { count: res.response.pending_friend_count }))
        if (res.response.pending_family_invite_count && res.response.pending_family_invite_count > 0) msgs.push(t('notifications.pendingFamilies', { count: res.response.pending_family_invite_count }))

        const n = new Notification({
            title: t('notifications.steamAccountNotice'),
            body: t('notifications.pendingBody', { account: entry.account_name, msgs: msgs.join(t('notifications.separator')) })
        })

        n.on('click', async () => {
            await openSteamNotificationsWindow(entry.account_name, model.session)
        })

        n.show()
    }
}

export default windowManager
