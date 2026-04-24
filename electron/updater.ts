import {app, BrowserWindow, dialog} from 'electron'
import {autoUpdater, ProgressInfo, UpdateInfo} from 'electron-updater'
import {settingsDb} from './db'
import enLocale from '../src/i18n/locales/en.json'
import zhLocale from '../src/i18n/locales/zh.json'

type UpdaterOptions = {
    getMainWindow: () => BrowserWindow | null | undefined
    sendEvent: (channel: ElectronMessageChannel, ...args: any[]) => void
}

let initialized = false
let checking = false
let optionsRef: UpdaterOptions | undefined
let latestState: UpdateStatus = {
    status: 'idle'
}

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

function publishState(state: UpdateStatus) {
    const nextState: UpdateStatus = {...state}
    if (state.status === 'downloading') {
        nextState.version = state.version || latestState.version
        nextState.releaseDate = state.releaseDate || latestState.releaseDate
    }
    latestState = nextState
    optionsRef?.sendEvent('update:status-changed', latestState)
    return latestState
}

async function showMessageBox(options: Electron.MessageBoxOptions) {
    const parent = optionsRef?.getMainWindow()
    if (parent && !parent.isDestroyed()) {
        return dialog.showMessageBox(parent, options)
    }
    return dialog.showMessageBox(options)
}

async function askToDownload(info: UpdateInfo) {
    const res = await showMessageBox({
        type: 'info',
        buttons: [t('updater.downloadNow'), t('dialog.cancel')],
        defaultId: 0,
        cancelId: 1,
        title: t('updater.updateAvailableTitle'),
        message: t('updater.updateAvailableMessage', {version: info.version}),
        detail: t('updater.updateAvailableDetail')
    })
    if (res.response === 0) {
        await autoUpdater.downloadUpdate()
    }
}

async function askToInstall(info: UpdateInfo) {
    const res = await showMessageBox({
        type: 'info',
        buttons: [t('updater.installNow'), t('updater.installLater')],
        defaultId: 0,
        cancelId: 1,
        title: t('updater.updateReadyTitle'),
        message: t('updater.updateReadyMessage', {version: info.version}),
        detail: t('updater.updateReadyDetail')
    })
    if (res.response === 0) {
        autoUpdater.quitAndInstall()
    }
}

export function initUpdater(options: UpdaterOptions) {
    optionsRef = options
    if (initialized) {
        return
    }

    initialized = true
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('checking-for-update', () => {
        publishState({status: 'checking'})
    })

    autoUpdater.on('update-available', (info) => {
        publishState({
            status: 'available',
            version: info.version,
            releaseDate: info.releaseDate
        })
        askToDownload(info).catch(e => {
            publishState({
                status: 'error',
                error: e instanceof Error ? e.message : String(e)
            })
        })
    })

    autoUpdater.on('update-not-available', (info) => {
        publishState({
            status: 'not-available',
            version: info.version,
            releaseDate: info.releaseDate
        })
    })

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
        publishState({
            status: 'downloading',
            percent: progress.percent,
            transferred: progress.transferred,
            total: progress.total
        })
    })

    autoUpdater.on('update-downloaded', (info) => {
        publishState({
            status: 'downloaded',
            version: info.version,
            releaseDate: info.releaseDate
        })
        askToInstall(info).catch(e => {
            publishState({
                status: 'error',
                error: e instanceof Error ? e.message : String(e)
            })
        })
    })

    autoUpdater.on('error', (e) => {
        publishState({
            status: 'error',
            error: e instanceof Error ? e.message : String(e)
        })
    })

    if (app.isPackaged) {
        setTimeout(() => {
            checkForUpdates(false).catch(e => {
                publishState({
                    status: 'error',
                    error: e instanceof Error ? e.message : String(e)
                })
            })
        }, 15000)
    }
}

export async function checkForUpdates(manual = false): Promise<UpdateStatus> {
    if (!app.isPackaged) {
        return publishState({
            status: 'unsupported',
            manual,
            message: 'notPackaged'
        })
    }
    if (checking) {
        return latestState
    }

    checking = true
    publishState({status: 'checking', manual})
    try {
        const result = await autoUpdater.checkForUpdates()
        if (!result?.updateInfo) {
            return publishState({
                status: 'not-available',
                manual
            })
        }
        return latestState
    } catch (e) {
        return publishState({
            status: 'error',
            manual,
            error: e instanceof Error ? e.message : String(e)
        })
    } finally {
        checking = false
    }
}

export function installUpdate() {
    autoUpdater.quitAndInstall()
}
