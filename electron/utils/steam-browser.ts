import { BrowserWindow } from 'electron'
import { settingsDb } from '../db/index.ts'

export async function openSteamNotificationsWindow(account_name: string, session?: SteamSession) {
    if (!session) return

    const win = new BrowserWindow({
        width: 420,
        height: 700,
        autoHideMenuBar: true,
        resizable: false, // 固定为手机比例，不允许随意拉伸
        webPreferences: {
            partition: `persist:steam-${account_name}`, // 使用独立会话，避免不同账号 Cookie 互相污染
            nodeIntegration: false,
            contextIsolation: true
        }
    })

    // 设置代理 (如果用户在设置中配置了的话)
    if (settingsDb.data.proxy) {
        await win.webContents.session.setProxy({ proxyRules: settingsDb.data.proxy })
    }

    // 窗口关闭时清除该 partition 下的 cookie
    win.on('closed', async () => {
        await win.webContents.session.clearStorageData({ storages: ['cookies'] })
    })

    // 注入 Cookie
    const cookieString = session.cookies || ''
    const cookiePairs = cookieString.split(';')
    for (const pair of cookiePairs) {
        const trimmedPair = pair.trim()
        if (!trimmedPair) continue
        
        const eqIdx = trimmedPair.indexOf('=')
        if (eqIdx > -1) {
            const name = trimmedPair.substring(0, eqIdx).trim()
            const value = trimmedPair.substring(eqIdx + 1).trim()
            if (!name || !value) continue
            try {
                await win.webContents.session.cookies.set({
                    url: 'https://steamcommunity.com',
                    name,
                    value,
                    domain: '.steamcommunity.com',
                    path: '/',
                    secure: true
                })
            } catch (e) {
                console.error('Failed to set cookie', name, e)
            }
        }
    }

    // 加载通知页面
    win.loadURL(`https://steamcommunity.com/profiles/${session.SteamID}/notifications`)
}