// electron/GlobalStore.ts
import { app} from 'electron';
import fs from 'fs';
import path from 'path';
import ipcMainHandler from "../ipc";
import windowManager from "../window-manager.ts";

class GlobalStore {
    // 内存中持有完整的状态
    private state: GlobalState;
    private filePath: string;

    // 默认 Settings
    private defaultSettings: Settings = {
        encrypted: false,
        first_run: true,
        periodic_checking: false,
        periodic_checking_interval: 60,
        periodic_checking_checkall: false,
        auto_confirm_market_transactions: false,
        auto_confirm_trades: false,
        maFilesDir: path.join(app.getPath('userData'), 'maFiles'),
        entries: [],
        timeout: 30000,
    };

    // 默认 Runtime (每次启动都是新的)
    private defaultRuntime: RuntimeContext = {
        passkey: '',
        token: '',
        progress: 0,
        selectedSteamid: '',
        timeOffset: 0,
        timeNextSyncTime: 0
    };

    constructor(filePath: string) {
        this.filePath = filePath;
        // 初始化：加载 Settings + 新的 Runtime
        this.state = {
            settings: this.loadSettingsFromDisk(),
            runtimeContext: {...this.defaultRuntime}
        };
        this.saveSettingsToDisk()
        this.initIpc();
    }

    // 只读取 settings
    private loadSettingsFromDisk(): Settings {
        if (fs.existsSync(this.filePath)) {
            const diskData = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
            // 合并默认值，防止新版本加了字段导致 undefined
            return {...this.defaultSettings, ...diskData};
        } else {
            return {...this.defaultSettings};
        }
    }

    // 🔴 核心：只保存 settings
    private saveSettingsToDisk() {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true});
        // 只序列化 settings 部分
        fs.writeFileSync(this.filePath, JSON.stringify(this.state.settings, null, 2));
    }

    private initIpc() {
        // 渲染进程获取完整初始状态
        ipcMainHandler.handle('store:get-initial', () => this.state);

        // 接收渲染进程的更新
        ipcMainHandler.on('store:renderer-update', (event, scope: UpdateScope, keyPath: string, value: any) => {
            // keyPath 可能是 "encrypted" 也可能是 "entries"
            this.updateState(scope, keyPath, value, false);
        });
    }

    /**
     * 更新状态的统一入口
     * @param scope 'settings' | 'runtime'
     * @param key 属性名
     * @param value 值
     * @param emitToRenderer 是否通知渲染进程
     */
    public updateState(scope: UpdateScope, key: string, value: any, emitToRenderer = true) {
        // 1. 更新内存
        if (scope === 'settings') {
            (this.state.settings as any)[key] = value;
            // 2. 如果是 settings，触发持久化
            this.saveSettingsToDisk();
        } else {
            (this.state.runtimeContext as any)[key] = value;
        }
        // 3. 通知渲染进程
        if (emitToRenderer) {
            windowManager.sendEvent('/', 'store:main-update', scope, key, value)
        }
    }

    public getState() {
        return {...this.state}
    }
}

const globalStore = new GlobalStore(path.join(app.getPath('userData'),'settings.json'))

export default globalStore
