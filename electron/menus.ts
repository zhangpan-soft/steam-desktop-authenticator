import { app, Menu, MenuItemConstructorOptions } from "electron";

export function createApplicationMenu() {
    const isMac = process.platform === 'darwin'

    const template: MenuItemConstructorOptions[] = [
        // 1. 文件菜单
        {
            // 在 Mac 上第一个菜单通常显示应用名，Windows 上显示 "文件"
            label: isMac ? app.name : '文件',
            submenu: [ // <--- 修正了这里
                {
                    label: '导入',
                },
                {
                    label: '设置'
                },
                { type: 'separator' }, // 加个分割线更好看
                {
                    label: '退出',
                    accelerator: isMac ? 'Cmd+Q' : 'Ctrl+Q', // 加上快捷键
                    click() {
                        app.quit()
                    }
                }
            ]
        },
        // 2. 自定义菜单
        {
            label: '已选中账户',
            submenu: [ // <--- 修正了这里
                {
                    label: '重新登录'
                },
                {
                    label: '移除'
                }
            ]
        }
    ]

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
}
