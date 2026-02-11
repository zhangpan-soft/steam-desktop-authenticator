import {dialog} from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import globalStore from "../store";
import {readMaFile, saveMaFile} from "../ma-file.ts";
import windowManager from "../window-manager.ts";
import ipcMainHandler from "./index.ts";


ipcMainHandler
    .handle('showOpenDialog', (event, args) => {
        console.log('showOpenDialog', args, event)
        return dialog.showOpenDialog(args)
    })
    .handle('readFile', (event, args) => {
        console.log('readFile', args, event)
        return fs.readFile(args.path, args.options)
    })
    .handle('readMaFile', (event, args) => {
        console.log('readMaFile', args, event)
        let filepath = args.path
        if (!filepath && args.filename) {
            filepath = path.join(globalStore.getState().settings.maFilesDir, args.filename)
        }
        return readMaFile(filepath, {passkey: args.passkey, iv: args.iv, salt: args.salt})
    })
    .handle('saveMaFile', (event, args) => {
        console.log('saveMaFile', args, event)
        return saveMaFile(args.content, args.passkey)
    })
    .handle('open-window', (event, args) => {
        console.log('open-window', args, event)
        const {uri,options} = {...args}
        if (!options.parent){
            options.parent = windowManager.getWindow('/')
        } else {
            options.parent = windowManager.getWindow(options.parent)
        }
        windowManager.addChild(uri, options)
    })
    .handle('close-window',(event, args)=>{
        console.log('close-window', args, event)
        windowManager.close(args.hash)
    })
