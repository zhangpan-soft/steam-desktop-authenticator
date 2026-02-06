import {defineConfig} from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        electron({
            main: {
                // Shortcut of `build.lib.entry`.
                entry: 'electron/main.ts',
                vite: {
                    build: {
                        rollupOptions: {
                            // 🔥 关键修改：将 steam 相关库排除在打包之外，强制使用 Node 原生加载
                            external: [
                                'steam-session',
                                'steam-totp',
                                'steam-crypto',
                                'got',
                                'protobufjs',
                                'steamcommunity'
                            ],
                        },
                    },
                }
            },
            preload: {
                // Shortcut of `build.rollupOptions.input`.
                // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
                input: path.join(__dirname, 'electron/preload.ts'),
            },
            // Ployfill the Electron and Node.js API for Renderer process.
            // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
            // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
            renderer: process.env.NODE_ENV === 'test'
                // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
                ? undefined
                : {},
        }),
    ],
})
