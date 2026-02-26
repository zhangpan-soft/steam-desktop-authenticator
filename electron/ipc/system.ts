import {dialog} from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import {readMaFile} from "../ma-file.ts";
import windowManager from "../window-manager.ts";
import ipcMainHandler from "./index.ts";
import {settingsDb, steamAccountDbs} from "../db";
import runtimeContext from "../utils/runtime-context.ts";


ipcMainHandler
    .handle('showOpenDialog', async (event, args) => {
        console.log('showOpenDialog', args, event)
        return dialog.showOpenDialog(args)
    })
    .handle('readFile', async (event, args) => {
        console.log('readFile', args, event)
        return fs.readFile(args.path, args.options)
    })
    .handle('readMaFile', async (event, args) => {
        console.log('readMaFile', args, event)
        let filepath = args.path
        if (!filepath && args.filename) {
            filepath = path.join(settingsDb.data.maFilesDir, args.filename)
        }
        return readMaFile(filepath, {passkey: args.passkey, iv: args.iv, salt: args.salt})
    })
    .handle('importMaFile', async (event, args) => {
        console.log('importMaFile', args, event)
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
            const manifest = JSON.parse(manifestText)
            if (!manifest.entries || manifest.entries.length == 0) {
                throw new Error('manifest.json entries is empty')
            }
            const maFileParse = path.parse(args.path)
            const acc = manifest.entries.find((value: any) => value.filename === maFileParse.name + '.' + maFileParse.ext)
            if (!acc) {
                throw new Error('manifest.json entries is empty')
            }
            return readMaFile(args.path, {passkey: args.passkey, iv: acc.encryption_iv, salt: acc.encryption_salt})
        } else {
            return readMaFile(args.path)
        }
    })
    .handle('open-window', async (event, args) => {
        console.log('open-window', args, event)
        const {uri, options} = {...args}
        if (!options.parent) {
            options.parent = windowManager.getWindow('/')
        } else {
            options.parent = windowManager.getWindow(options.parent)
        }
        windowManager.addChild(uri, options)
    })
    .handle('close-window', async (event, args) => {
        console.log('close-window', args, event)
        windowManager.close(args.hash)
    })
    .handle('settings:get', async (event, args) => {
        console.log('settings:get', args, event)
        return settingsDb.data
    })
    .handle('settings:set', async (event, args) => {
        console.log('settings:set', args, event)
        settingsDb.data = {...args}
        settingsDb.update()
        windowManager.sendEvent('/', 'settings:message:change', settingsDb.data)
    })
    .handle('context:get', async (event, args) => {
        console.log('context:get', args, event)
        return {...runtimeContext}
    })
    .handle('context:set', async (event, args) => {
        console.log('context:set', args, event)
        if (args.passkey) {
            const settings = settingsDb.data
            if (!settings.encrypted){
                settings.encrypted = true
                if (settings.entries.length>0){
                    settings.entries.forEach((item) => {
                        steamAccountDbs.db(item.account_name, args.passkey)
                    })
                }
            } else if (settings.entries.length>0){
                steamAccountDbs.db(settings.entries[0].account_name, args.passkey)
            }
            runtimeContext.passkey = args.passkey
        }
        return true
    })
