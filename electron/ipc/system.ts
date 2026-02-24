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
            filepath = path.join(settingsDb.get().maFilesDir, args.filename)
        }
        return readMaFile(filepath, {passkey: args.passkey, iv: args.iv, salt: args.salt})
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
        return settingsDb.get()
    })
    .handle('settings:set', async (event, args) => {
        console.log('settings:set', args, event)
        settingsDb.set(args)
    })
    .handle('context:get', async (event, args) => {
        console.log('context:get', args, event)
        return {...runtimeContext}
    })
    .handle('context:set', async (event, args) => {
        console.log('context:set', args, event)
        if (args.passkey) {
            const settings = settingsDb.get()
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
