import {dialog} from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import {readMaFile} from "../ma-file.ts";
import windowManager from "../window-manager.ts";
import ipcMainHandler from "./index.ts";
import {settingsDb, SteamAccountDb} from "../db";
import runtimeContext from "../utils/runtime-context.ts";
import {getSteamModel} from "../steam/models";
import {fromJson} from "../utils/json-util.ts";


ipcMainHandler
    .handle('showOpenDialog', async (event, args) => {
        return dialog.showOpenDialog(args)
    })
    .handle('readFile', async (event, args) => {
        return fs.readFile(args.path, args.options)
    })
    .handle('readMaFile', async (event, args) => {
        let filepath = args.path
        if (!filepath && args.filename) {
            filepath = path.join(settingsDb.data.maFilesDir, args.filename)
        }
        return readMaFile(filepath, {passkey: args.passkey, iv: args.iv, salt: args.salt})
    })
    .handle('importMaFile', async (event, args) => {
        if (args.passkey) {
            const fileExists = async (filepath: string) => {
                return await fs.access(filepath).then(() => {
                    return true
                }).catch(() => {
                    return false
                })
            }
            let manifest_path = path.join(path.dirname(args.path), 'manifest.json')
            let exists = await fileExists(manifest_path);
            if (!exists) {
                manifest_path = path.join(path.dirname(args.path), 'settings.json')
                exists = await fileExists(manifest_path)
            }
            if (!exists) {
                throw new Error('manifest.json not found')
            }
            const manifestText = await fs.readFile(manifest_path, 'utf8')
            const manifest = fromJson<any>(manifestText)
            if (!manifest.entries || manifest.entries.length == 0) {
                throw new Error('manifest.json entries is empty')
            }
            const maFileParse = path.parse(args.path)
            const acc = manifest.entries.find((value: any) => value.filename === maFileParse.base)
            if (!acc) {
                throw new Error('manifest.json entries is empty')
            }
            return readMaFile(args.path, {passkey: args.passkey, iv: acc.encryption_iv, salt: acc.encryption_salt})
        } else {
            return readMaFile(args.path)
        }
    })
    .handle('exportMaFiles', async (event, args) => {
        const rawTargetDir = String(args.targetDir || '').trim()
        if (!rawTargetDir) {
            throw new Error('exportTargetRequired')
        }
        const targetDir = path.resolve(rawTargetDir)
        const sourceDir = path.resolve(settingsDb.data.maFilesDir)
        if (targetDir === sourceDir) {
            throw new Error('exportTargetIsSource')
        }
        if (settingsDb.data.encrypted && !runtimeContext.passkey) {
            throw new Error('sdaPasskeyRequired')
        }
        const encrypted = Boolean(args.encrypted)
        const exportPasskey = encrypted ? String(args.passkey || '').trim() : undefined
        if (encrypted && !exportPasskey) {
            throw new Error('exportPasskeyRequired')
        }

        const entries = args.scope === 'current'
            ? settingsDb.data.entries.filter(entry => entry.account_name === args.account_name)
            : settingsDb.data.entries

        if (entries.length === 0) {
            throw new Error('exportNoAccounts')
        }

        await fs.mkdir(targetDir, {recursive: true})

        const files: { account_name: string, filepath: string }[] = []
        const failed: { account_name: string, message: string }[] = []

        for (const entry of entries) {
            try {
                const sourcePath = path.join(settingsDb.data.maFilesDir, `${entry.account_name}.maFile`)
                const accountDb = new SteamAccountDb(sourcePath, runtimeContext.passkey)
                const filename = `${entry.account_name.replace(/[\\/:*?"<>|]/g, '_')}.maFile`
                const filepath = path.join(targetDir, filename)
                SteamAccountDb.writeFile(filepath, accountDb.data, exportPasskey)
                files.push({
                    account_name: entry.account_name,
                    filepath
                })
            } catch (e: any) {
                failed.push({
                    account_name: entry.account_name,
                    message: e?.message || String(e)
                })
            }
        }

        return {
            count: files.length,
            files,
            failed
        }
    })
    .handle('open-window', async (event, args) => {
        const {uri, options} = {...args}
        if (!options.parent) {
            options.parent = windowManager.getWindow('/')
        } else {
            options.parent = windowManager.getWindow(options.parent)
        }
        windowManager.addChild(uri, options)
    })
    .handle('close-window', async (event, args) => {
        windowManager.close(args.key || args.hash)
    })
    .handle('settings:get', async (event, args) => {
        return settingsDb.data
    })
    .handle('settings:set', async (event, args) => {
        settingsDb.data = {...args}
        settingsDb.update()
        windowManager.sendEvent('/', 'settings:message:change', settingsDb.data)
    })
    .handle('context:get', async (event, args) => {
        return {...runtimeContext}
    })
    .handle('context:set', async (event, args) => {
        if (Object.prototype.hasOwnProperty.call(args, 'selectedAccount')) {
            runtimeContext.selectedAccount = args.selectedAccount || undefined
        }
        if (Object.prototype.hasOwnProperty.call(args, 'passkey')) {
            const passkey = typeof args.passkey === 'string' ? args.passkey.trim() : ''
            if (!passkey) {
                throw new Error('Passkey is required')
            }
            if (!settingsDb.data.encrypted) { // 如果未加密
                settingsDb.data.encrypted = true // 设置为加密
                settingsDb.update() // 更新settings
                settingsDb.data.entries.forEach((item) => {
                    // 按未加密读取数据
                    getSteamModel(item.account_name).setPasskey(passkey)
                    // 设置加密
                })
            } else { // 如果已加密
                if (!runtimeContext.passkey) { // 如果当前运行时还未设置密码
                    if (settingsDb.data.entries.length>0){
                        // 强制使用当前输入的密码读一次磁盘文件，失败则直接抛错
                        const filepath = path.join(settingsDb.data.maFilesDir, `${settingsDb.data.entries[0].account_name}.maFile`)
                        new SteamAccountDb(filepath, passkey)
                    }
                } else { // 如果运行时已存在密码,证明是修改密码
                    settingsDb.data.entries.forEach((item) => {
                        // 使用老密码读取数据
                        getSteamModel(item.account_name).setPasskey(passkey)
                        // 设置新密码
                    })
                }
            }
            runtimeContext.passkey = passkey
        }
        return true
    })
