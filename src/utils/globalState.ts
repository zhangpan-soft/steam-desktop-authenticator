// src/utils/globalState.ts
import { reactive } from 'vue';

// 内部锁：防止死循环
let isRemoteUpdate = false;

/**
 * 创建一个代理，拦截 set 操作并同步给主进程
 * @param scope 'settings' 或 'runtime'
 * @param targetObj Vue 的 reactive 对象
 */
function createSyncProxy<T extends object>(scope: UpdateScope, targetObj: T): T {
    return new Proxy(targetObj, {
        set(target, key, value, receiver) {
            // 1. 先执行正常的赋值 (这会触发 Vue 的响应式更新)
            const result = Reflect.set(target, key, value, receiver);

            // 2. 如果不是来自远程的更新，说明是用户在 UI 上操作的 -> 发送 IPC
            if (!isRemoteUpdate) {
                console.log(`[Renderer] Syncing ${scope}.${String(key)} =`, value);
                // 注意：这里只处理了浅层属性 (如 settings.encrypted)
                // 对于 settings.entries 这种数组的深层修改，建议单独处理或全量保存
                window.store.syncSet(scope, String(key), value);
            }

            return result;
        }
    });
}

export async function initGlobalState() {
    // 1. 从主进程获取初始数据
    const initialState = await window.store.getInitialState();

    // 2. 将数据转换为 Vue 响应式对象
    // 必须分开 reactive，否则替换属性时可能会丢失响应性
    const reactiveSettings = reactive(initialState.settings);
    const reactiveRuntime = reactive(initialState.runtimeContext);

    // 3. 包装 Proxy 并挂载到 window
    // 这样你在组件里用 window.globalState.settings.xxx = yyy 时就能触发拦截
    window.state = {
        settings: createSyncProxy('settings', reactiveSettings),
        runtimeContext: createSyncProxy('runtime', reactiveRuntime)
    };

    console.log('[Renderer] Global State Initialized:', window.state);

    // 4. 监听主进程发来的更新 (比如主进程逻辑修改了数据，或者多窗口同步)
    window.store.onSyncUpdate((scope: UpdateScope, key: string, value: any) => {
        console.log(`[Renderer] Received update from Main: ${scope}.${key}`, value);

        // 开启锁，避免 Proxy set 再次触发 IPC 发送
        isRemoteUpdate = true;

        if (scope === 'settings') {
            // @ts-ignore
            window.state.settings[key] = value;
        } else {
            // @ts-ignore
            window.state.runtimeContext[key] = value;
        }

        // 关闭锁
        isRemoteUpdate = false;
    });
}
