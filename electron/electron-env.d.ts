/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
    interface ProcessEnv {
        /**
         * The built directory structure
         *
         * ```tree
         * ├─┬─┬ dist
         * │ │ └── index.html
         * │ │
         * │ ├─┬ dist-electron
         * │ │ ├── main.js
         * │ │ └── preload.js
         * │
         * ```
         */
        APP_ROOT: string
        /** /dist/ or /public/ */
        VITE_PUBLIC: string
    }
}

type ElectronMessageChannel = 'showOpenDialog' | 'readFile' | 'readMaFile' | 'saveMaFile' |'store:get-initial'
    | 'store:renderer-update' | 'store:main-update' | 'main-process-message' | 'importMaFile'
    | SteamMessageChannel

type SteamMessageChannel = 'steam:login'
    | 'steam:submitSteamGuard' | 'steam:cancelLogin' | 'steam:message:login-status-changed'

// Used in Renderer process, expose in `preload.ts`
interface Window {
    ipcRenderer: {
        on(channel: ElectronMessageChannel, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void): void
        off(channel: ElectronMessageChannel, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void): void
        send(channel: ElectronMessageChannel, ...args: any[]): void
        invoke(channel: ElectronMessageChannel, ...args: any[]): Promise<any>
    }
    store: {
        getInitialState: () => Promise<GlobalState>;
        // 发送更新：指定 scope (settings/runtime), key, value
        syncSet: (scope: UpdateScope, path: string, value: any) => void;
        onSyncUpdate: (callback: (scope: UpdateScope, path: string, value: any) => void) => void;
    }
    state: GlobalState
}

interface IHttpRequest {
    doRequest(): Promise<IHttpResponse>
}

interface IHttpResponse {
    getCode(): number

    getContent(): Array<Buffer>

    getRequestUrls(): string[]

    getHeaders(): {[key: string]: string}

    getCookies(): {[key: string]: string}

    getText(): string

    isSuccess(): boolean

    hasContent(): boolean

    getBody<T>(): T
}

interface IHttpRequestConfig{
    timeout: number
    proxies?: string
}

interface IHttpRequestBuilder{
    cookie(cookies: {[key:string]: string}): IHttpRequestBuilder

    cookie(name: string, value: string): IHttpRequestBuilder

    cookie(cookieStr: string): IHttpRequestBuilder

    header(headers: {[key: string]: string}): IHttpRequestBuilder

    header(name: string, value: string): IHttpRequestBuilder

    referer(referer: string): IHttpRequestBuilder

    userAgent(userAgent: string): IHttpRequestBuilder

    autoRedirect(): IHttpRequestBuilder

    requestConfig(config: IHttpRequestConfig): IHttpRequestBuilder

    perform(): Promise<IHttpResponse>
}

interface IHttpBody{
    json(json: string): IHttpRequestBuilder

    json(json: object): IHttpRequestBuilder

    json(): IHttpRequestBuilder

    body(body: string, contentType: string): IHttpRequestBuilder

    body(): IHttpRequestBuilder

    body(contentType: string): IHttpRequestBuilder

    param(name: string, value: any): IHttpBody

    param(): IHttpRequestBuilder

    params(nameValues:{[key: string]: any}): IHttpRequestBuilder

    data(name: string, value: any): IHttpBody

    data(nameValues:{[key: string]: any}): IHttpRequestBuilder

    data(): IHttpRequestBuilder
}

interface IHttpParam{
    param(name: string, value: any): IHttpParam

    param(): IHttpRequestBuilder

    params(nameValues: {[key: string]: any})
}

interface IHttpUri{
    get(url: string): IHttpParam

    post(url: string): IHttpBody

    delete(url: string): IHttpParam

    put(url: string): IHttpBody

    head(url: string): IHttpParam

    patch(url: string): IHttpBody
}

interface EntryType{
    encryption_iv: string | null
    encryption_salt: string | null
    filename: string
    steamid: string,
    account_name: string
}

interface Settings{
    encrypted: boolean
    first_run: boolean
    periodic_checking: boolean
    periodic_checking_interval: number
    periodic_checking_checkall: boolean
    auto_confirm_market_transactions: boolean
    auto_confirm_trades: boolean
    maFilesDir: string
    entries: EntryType[]
    proxy?:string
}

interface RuntimeContext{
    passkey: string
    token: string
    progress: number
    selectedSteamid: string
    timeOffset: number
    timeNextSyncTime: number
    loginSession?: any,
}

type UpdateScope = 'settings' | 'runtime'

interface GlobalState {
    settings: Settings
    runtimeContext: RuntimeContext
}

// 定义发送给前端的消息结构
interface SteamLoginEvent {
    account_name: string;      // 关键：必须带上账号名，前端才知道是哪个账号
    result: EResult;           // 结果代码
    status?: 'LoginSuccess' | 'Need2FA' | 'Converting' | 'Failed' | 'Timeout'; // 状态描述
    data?: {
        access_token: string
        refresh_token: string
        steamid: string
        account_name: string
        cookies: string[]
    };                // 成功时的 Cookies/Token 数据
    error_message?: string;    // 错误信息
    valid_actions?: {
        type: number
        detail?: string
    }[];     // 需要 2FA 时，告诉前端是邮件还是手机令牌
}

interface LoginOptions {
    account_name: string
    password?: string
    steamGuardCode?: string
    refresh_token?: string
}
// 1. 定义 Steam API 的外层包装结构
interface SteamApiResponse<T> {
    response: T
}

// 2. 定义内部数据结构
interface QueryTimeResponse {
    server_time: string
    skew_tolerance_seconds: string
    large_time_jink: string
    probe_frequency_seconds: number
    adjusted_time_probe_frequency_seconds: number
    hint_probe_frequency_seconds: number
    sync_timeout: number
    try_again_seconds: number
    max_attempts: number
}
