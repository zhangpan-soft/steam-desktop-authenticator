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
import {openSteamCommunityWindow} from "./utils/steam-browser.ts";
import {GotHttpApiRequest} from "./utils/requests.ts";
import runtimeContext from "./utils/runtime-context.ts";
import {initUpdater} from "./updater.ts";

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
    private readonly _child: Map<string, BrowserWindow> = new Map<string, BrowserWindow>()

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

    private _windowKey(uri: WindowUri) {
        return uri.hash === '/' ? '/' : (uri.key || uri.hash)
    }

    private _load(uri: WindowUri) {
        uri = {...uri}
        uri.hash = uri.hash || '/'
        const windowKey = this._windowKey(uri)
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
            win = this._child.get(windowKey)
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


        const windowKey = this._windowKey(uri)
        const existingWin = this._child.get(windowKey);
        if (existingWin && !existingWin.isDestroyed()) {
            this._load(uri)
            existingWin.show()
            existingWin.focus()
            return
        } else {
            this._child.delete(windowKey)
        }

        const win = this._createWindow(options)
        this._child.set(windowKey, win)
        this._load(uri)

        win.on('closed', () => {
            this._child.delete(windowKey)
        })
        win.show()
        win.focus()
    }

    public hasChild(key: string) {
        return this._child.has(key) && !this._child.get(key)?.isDestroyed()
    }

    public removeChild(key: string) {
        if (this._child.has(key)) {
            this._child.get(key)?.close()
            this._child.delete(key)
        }
    }

    public sendEvent(key: string, channel: ElectronMessageChannel, ...args: any[]) {
        if (key === '/') {
            this._main?.webContents.send(channel, ...args)
        } else if (this._child.has(key)) {
            this._child.get(key)?.webContents.send(channel, ...args)
        }
    }

    public show(key: string) {
        if (key === '/') {
            this._main?.show()
        } else if (this._child.has(key)) {
            this._child.get(key)?.show()
            this._child.get(key)?.focus()
        }
    }

    public hide(key: string) {
        if (key === '/') {
            this._main?.hide()
        } else if (this._child.has(key)) {
            this._child.get(key)?.hide()
        }
    }

    public close(key: string) {
        if (key === '/') {
            this._main?.close()
            this._main = null
        } else if (this._child.has(key)) {
            this._child.get(key)?.close()
            this._child.delete(key)
        }
    }

    public getWindow(key: string) {
        if (key === '/') {
            return this._main
        } else if (this._child.has(key)) {
            return this._child.get(key)
        }
    }
}

const windowManager = new WindowManager()
const RELOGIN_PROMPT_COOLDOWN = 5 * 60 * 1000
const reloginPromptedAt = new Map<string, number>()

function getLoginWindowKey(accountName: string) {
    return `steam-login:${accountName}`
}

function getEntriesToCheck() {
    if (settingsDb.data.periodic_checking_checkall) {
        return settingsDb.data.entries
    }
    if (!runtimeContext.selectedAccount?.account_name) {
        return []
    }
    return settingsDb.data.entries.filter(entry => entry.account_name === runtimeContext.selectedAccount?.account_name)
}

async function checkAccountHealth(entry: EntryType): Promise<AccountHealthResult> {
    const checkedAt = Date.now()
    try {
        const model = getSteamModel(entry.account_name)
        const sessionIsValid = await model.session.checkSession()
        if (!sessionIsValid) {
            return {
                account_name: entry.account_name,
                steamid: entry.steamid,
                status: 'login_required',
                healthy: false,
                reason: model.session.lastSessionError || 'sessionExpired',
                checked_at: checkedAt
            }
        }

        reloginPromptedAt.delete(entry.account_name)
        return {
            account_name: entry.account_name,
            steamid: entry.steamid,
            status: model.guard ? 'ok' : 'missing_guard',
            healthy: true,
            checked_at: checkedAt
        }
    } catch (e: any) {
        return {
            account_name: entry.account_name,
            steamid: entry.steamid,
            status: 'checking_failed',
            healthy: false,
            reason: e?.message || String(e),
            checked_at: checkedAt
        }
    }
}

function openReloginWindow(entry: EntryType, reason?: string) {
    const windowKey = getLoginWindowKey(entry.account_name)
    if (windowManager.hasChild(windowKey)) {
        return
    }

    const lastPromptedAt = reloginPromptedAt.get(entry.account_name) || 0
    if (Date.now() - lastPromptedAt < RELOGIN_PROMPT_COOLDOWN) {
        return
    }

    reloginPromptedAt.set(entry.account_name, Date.now())
    windowManager.addChild({
        hash: '/steam/login',
        key: windowKey,
        query: {
            account_name: entry.account_name,
            window_key: windowKey,
            reason: reason || 'sessionExpired'
        }
    }, {
        width: 420,
        height: 360,
        useContentSize: true,
        resizable: false,
        maximizable: false,
        minimizable: true,
        show: false,
        icon: 'icon.png',
        title: t('accountHealth.loginWindowTitle', {account: entry.account_name})
    })
}

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
    initUpdater({
        getMainWindow: () => windowManager.getWindow('/'),
        sendEvent: (channel, ...args) => windowManager.sendEvent('/', channel, ...args)
    })

    // 使用递归 setTimeout 替代 setInterval，防止网络阻塞导致的请求堆积，并支持动态间隔
    const periodicCheck = async () => {
        try {
            if (settingsDb.data.entries && settingsDb.data.entries.length > 0) {
                const isCheckingEnabled = settingsDb.data.periodic_checking ||
                                          settingsDb.data.auto_confirm_trades ||
                                          settingsDb.data.auto_confirm_market_transactions;

                if (isCheckingEnabled) {
                    if (!(settingsDb.data.encrypted && !runtimeContext.passkey)) {
                        for (let entry of getEntriesToCheck()) {
                            await checkAccountConfirmations(entry)
                        }
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
            if (!nextSyncTime || Date.now() >= Number(nextSyncTime)){
                await GotHttpApiRequest.get('https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json')
                    .param()
                    .requestConfig({
                        timeout: 30000,
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
            }
        }catch (e){
            console.error(e)
        }

        setTimeout(paintIndexCheck, 10*1000)
    }

    setTimeout(paintIndexCheck, 10*1000)
})

async function checkAccountConfirmations(entry: EntryType) {
    const health = await checkAccountHealth(entry)
    windowManager.sendEvent('/', 'steam:account-health-changed', health)
    if (health.status === 'login_required') {
        openReloginWindow(entry, health.reason)
    }
    if (!health.healthy) {
        return
    }

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
            if (!await model.session.checkSession()) {
                return
            }
            await openSteamCommunityWindow(`https://steamcommunity.com/profiles/${model.session.SteamID}/notifications`, model.session.account_name)
        })

        n.show()
    }
}

export default windowManager
