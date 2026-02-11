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

type ElectronMessageChannel =
    'showOpenDialog'
    | 'readFile'
    | 'readMaFile'
    | 'saveMaFile'
    | 'store:get-initial'
    | 'store:renderer-update'
    | 'store:main-update'
    | 'main-process-message'
    | 'importMaFile'
    | 'open-window'
    | 'close-window'
    | SteamMessageChannel

type SteamMessageChannel =
    'steam:login'
    | 'steam:submitSteamGuard'
    | 'steam:cancelLogin'
    | 'steam:message:login-status-changed'
    | 'steam:getConfirmations'

type WindowHashType = '/' | '/confirmations' | '/steamLogin'

type WindowUri = {
    hash: WindowHashType
    query?: Record<string, string>
}

type SteamLoginType = 'NewAccount' | 'ImportSda' | 'RefreshToken' | 'ReLogin'

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

    getHeaders(): { [key: string]: string }

    getCookies(): { [key: string]: string }

    getText(): string

    isSuccess(): boolean

    hasContent(): boolean

    getBody<T>(): T
}

interface IHttpRequestConfig {
    timeout: number
    proxies?: string
}

interface IHttpRequestBuilder {
    cookie(cookies: { [key: string]: string }): IHttpRequestBuilder

    cookie(name: string, value: string): IHttpRequestBuilder

    cookie(cookieStr: string): IHttpRequestBuilder

    header(headers: { [key: string]: string }): IHttpRequestBuilder

    header(name: string, value: string): IHttpRequestBuilder

    referer(referer: string): IHttpRequestBuilder

    userAgent(userAgent: string): IHttpRequestBuilder

    autoRedirect(): IHttpRequestBuilder

    requestConfig(config: IHttpRequestConfig): IHttpRequestBuilder

    perform(): Promise<IHttpResponse>
}

interface IHttpBody {
    json(json: string): IHttpRequestBuilder

    json(json: object): IHttpRequestBuilder

    json(): IHttpRequestBuilder

    body(body: string, contentType: string): IHttpRequestBuilder

    body(): IHttpRequestBuilder

    body(contentType: string): IHttpRequestBuilder

    param(name: string, value: any): IHttpBody

    param(): IHttpRequestBuilder

    params(nameValues: { [key: string]: any }): IHttpRequestBuilder

    data(name: string, value: any): IHttpBody

    data(nameValues: { [key: string]: any }): IHttpRequestBuilder

    data(): IHttpRequestBuilder
}

interface IHttpParam {
    param(name: string, value: any): IHttpParam

    param(): IHttpRequestBuilder

    params(nameValues: { [key: string]: any }): IHttpRequestBuilder
}

interface IHttpUri {
    get(url: string): IHttpParam

    post(url: string): IHttpBody

    delete(url: string): IHttpParam

    put(url: string): IHttpBody

    head(url: string): IHttpParam

    patch(url: string): IHttpBody
}

interface EntryType {
    encryption_iv: string | null
    encryption_salt: string | null
    filename: string
    steamid: string,
    account_name: string
}

interface Settings {
    encrypted: boolean
    first_run: boolean
    periodic_checking: boolean
    periodic_checking_interval: number
    periodic_checking_checkall: boolean
    auto_confirm_market_transactions: boolean
    auto_confirm_trades: boolean
    maFilesDir: string
    entries: EntryType[]
    proxy?: string
    timeout: number
}

interface RuntimeContext {
    passkey: string
    token: string
    progress: number
    selectedSteamid: string
    timeOffset: number
    timeNextSyncTime: number
    loginSession?: any,
    currentAccount?: EntryType & { info?: SteamAccount }
}

interface SteamAccount extends SteamGuard {
    Session?: SteamSession
}

interface SteamSession {
    access_token: string
    refresh_token: string
    SteamID: string
    account_name: string
    cookies: string
    at: number
    rt: number
    SessionID: string
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
    data?: SteamSession;                // 成功时的 Cookies/Token 数据
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

interface SteamResponse<T> extends SteamApiResponse<T> {
    eresult: number
    message?: string
    status: number
}

// 1. 定义 Steam API 的外层包装结构
interface SteamApiResponse<T> {
    response?: T
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

interface SteamGuard {
    shared_secret: string
    serial_number: string
    revocation_code: string
    uri: string
    server_time: string
    account_name: string
    token_gid: string
    identity_secret: string
    secret_1: string
    status: number
    device_id: string
    fully_enrolled: boolean
    steamid: string
}

interface FinalizeAuthenticatorResponse {
    status: number
    server_time: string
    want_more: boolean
    success: boolean
}

interface RemoveAuthenticatorViaChallengeContinueResponse {
    success: boolean
    replacement_token: SteamGuard
}

interface QueryStatusResponse {
    state: number
    inactivation_reason: number
    authenticator_type: number
    authenticator_allowed: boolean
    steamguard_scheme: number
    token_gid: string
    email_validated: boolean
    device_identifier: string
    time_created: string
    revocation_attempts_remaining: number
    classified_agent: string
    allow_external_authenticator: boolean
    time_transferred: string
    version: number
}

interface ConfirmationsResponse {
    success: boolean
    conf: Confirmation[]
}

interface Confirmation {
    type: number // 1-其他,2-交易,3-市场
    type_name: string
    id: string
    creator_id: string // 如果type=2,则 create_id=tradeOfferId
    nonce: string
    creation_time: string
    cancel: string
    accept: string
    icon: string
    multi: boolean
    headline: string
    summary: string[]
    warn: any
}

interface ConfirmationOptions {
    identitySecret: string,
    deviceid: string,
    steamid: string,
    cookies: string
}

interface ConfirmationAjaxOpResponse {
    success: boolean
    message: string
}

