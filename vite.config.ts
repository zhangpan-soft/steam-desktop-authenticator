import {defineConfig, type ESBuildOptions} from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const isProd = mode === 'production'
    // ✅ 修复：显式指定类型为 ESBuildOptions，让 TS 正确推断 drop 的字面量类型
    const esbuild: ESBuildOptions | undefined = isProd ? { drop: ['console', 'debugger'] } : undefined
    const rendererManualChunks = (id: string) => {
        if (!id.includes('node_modules')) return undefined
        if (id.includes('@element-plus/icons-vue')) return 'element-plus-icons'
        if (id.includes('element-plus')) return 'element-plus'
        if (id.includes('vue-router')) return 'vue-router'
        if (id.includes('vue-i18n')) return 'vue-i18n'
        return 'vendor'
    }

    return {
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
                                'steamcommunity',
                                'electron-updater'
                            ],
                        },
                    },
                    esbuild,
                }
            },
            preload: {
                // Shortcut of `build.rollupOptions.input`.
                // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
                input: path.join(__dirname, 'electron/preload.ts'),
                vite: {
                    esbuild,
                }
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
    build: {
        rollupOptions: {
            output: {
                manualChunks: rendererManualChunks,
            },
        },
    },
    esbuild,
    }
})
