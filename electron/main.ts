import { app, BrowserWindow } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url))
import globalStore from "./store";

import './ipc.ts'
import {readMaFile} from "./ma-file.ts";
import {generateAuthCode} from "./steam/steam-community.ts";

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

let win: BrowserWindow | null

const tokenInterval = setInterval(()=>{
  if (!globalStore.getState().runtimeContext.currentAccount){
    return
  }
  if (globalStore.getState().runtimeContext.currentAccount?.steam_guard){
    generateAuthCode(globalStore.getState().runtimeContext.currentAccount?.steam_guard?.shared_secret as string)
      .then(code=>{
        globalStore.updateState('runtime', 'token', code)
        globalStore.updateState('runtime', 'progress', (30-(Date.now()/1000+globalStore.getState().runtimeContext.timeOffset)%30)/30 * 100)
      })
  } else {
    readMaFile(
        path.join(globalStore.getState().settings.maFilesDir,globalStore.getState().runtimeContext.currentAccount?.filename as string),
        {
          passkey: globalStore.getState().runtimeContext.passkey,
          iv: globalStore.getState().runtimeContext.currentAccount?.encryption_iv,
          salt: globalStore.getState().runtimeContext.currentAccount?.encryption_salt,
        }
    ).then(result=>{
      const currentAccount = globalStore.getState().runtimeContext.currentAccount
      const steamGuard: SteamGuard = result.data as SteamGuard
      if (currentAccount){
        currentAccount.steam_guard = steamGuard
      }
      globalStore.updateState('runtime', 'currentAccount', currentAccount)
      return generateAuthCode(result.data.shared_secret)
    }).then(code=>{
      globalStore.updateState('runtime', 'token', code)
      globalStore.updateState('runtime', 'progress', (30-(Date.now()/1000+globalStore.getState().runtimeContext.timeOffset)%30)/30 * 100)
    })
  }

},1000)

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    width: 1000,   // 改窄，模仿手机/工具宽度
    height: 600,  // 高度适中
    useContentSize: true, // 确保内容区域有这么大
    resizable: true, // 允许调整，但你可以设为 false 固定大小
    minWidth: 1000,   // 限制最小宽度
    minHeight: 600,
    maximizable: true,
    minimizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
  // createApplicationMenu()
  win.setMenu(null)
  globalStore.setWindow(win)
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
    clearInterval(tokenInterval)
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
