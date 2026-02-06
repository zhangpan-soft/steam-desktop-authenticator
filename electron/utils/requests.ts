import got, {Response, Method, OptionsInit} from 'got';
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';
import {SocksProxyAgent} from "socks-proxy-agent"; // 用于处理代理

// ---------------------------------------------------------
// 1. 响应体实现 (GotHttpResponse)
// ---------------------------------------------------------
export class GotHttpResponse implements IHttpResponse {
    private response: Response<string>; // 假设我们将 responseType 设为 text，如果是 buffer 则用 Buffer

    constructor(response: Response<string>) {
        this.response = response;
    }

    getCode(): number {
        return this.response.statusCode;
    }

    getContent(): Array<Buffer> {
        // got 的 rawBody 是 Buffer
        return [this.response.rawBody];
    }

    getRequestUrls(): string[] {
        // got 会记录重定向链路，redirectUrls 是重定向过的 url 列表
        // url 是最终 url
        const urls:string[] = []
        for (let redirectUrl of this.response.redirectUrls) {
            urls.push(redirectUrl.href)
        }
        return [...urls, this.response.url];
    }

    getHeaders(): { [key: string]: string } {
        // got 的 headers 类型可能是 string | string[]，我们需要统一转为 string
        const result: { [key: string]: string } = {};
        for (const [key, val] of Object.entries(this.response.headers)) {
            if (Array.isArray(val)) {
                result[key] = val.join('; ');
            } else if (val !== undefined) {
                result[key] = val;
            }
        }
        return result;
    }

    getCookies(): { [key: string]: string } {
        // 简单解析 Set-Cookie 头
        const cookies: { [key: string]: string } = {};
        const setCookie = this.response.headers['set-cookie'];
        if (setCookie) {
            setCookie.forEach(c => {
                const parts = c.split(';');
                const [key, val] = parts[0].split('=');
                if (key) cookies[key.trim()] = val ? val.trim() : '';
            });
        }
        return cookies;
    }

    getText(): string {
        return this.response.body;
    }

    isSuccess(): boolean {
        return this.response.statusCode >= 200 && this.response.statusCode < 300;
    }

    hasContent(): boolean {
        return !!this.response.body && this.response.body.length > 0;
    }

    getBody<T>(): T {
        try {
            return JSON.parse(this.response.body);
        } catch {
            return this.response.body as unknown as T;
        }
    }
}

// ---------------------------------------------------------
// 2. 请求构建器实现 (GotHttpApiRequest)
// ---------------------------------------------------------

// 这个类同时实现了所有 Builder 接口，利用 TS 的鸭子类型特性
export class GotHttpApiRequest implements IHttpUri, IHttpBody, IHttpParam, IHttpRequestBuilder {

    // --- 内部状态 ---
    private _url: string = '';
    private _method: Method = 'GET';
    private _headers: Record<string, string> = {};
    private _cookies: Record<string, string> = {};
    private _searchParams: URLSearchParams = new URLSearchParams();

    private _jsonBody: any = undefined;
    private _formBody: Record<string, any> = {};
    private _rawBody: string | undefined = undefined;

    private _config: Partial<IHttpRequestConfig> = {};
    private _autoRedirect: boolean = false;
    private _referer: string = '';
    private _userAgent: string = '';
    private _contentType: string = '';

    // 私有构造，强制通过静态方法创建
    private constructor() {}

    // ==========================================
    // IHttpUri 静态入口实现
    // ==========================================

    public static get(url: string): IHttpParam {
        const req = new GotHttpApiRequest();
        req._url = url;
        req._method = 'GET';
        return req;
    }

    public static post(url: string): IHttpBody {
        const req = new GotHttpApiRequest();
        req._url = url;
        req._method = 'POST';
        return req;
    }

    public static put(url: string): IHttpBody {
        const req = new GotHttpApiRequest();
        req._url = url;
        req._method = 'PUT';
        return req;
    }

    public static delete(url: string): IHttpParam {
        const req = new GotHttpApiRequest();
        req._url = url;
        req._method = 'DELETE';
        return req;
    }

    public static head(url: string): IHttpParam {
        const req = new GotHttpApiRequest();
        req._url = url;
        req._method = 'HEAD';
        return req;
    }

    public static patch(url: string): IHttpBody {
        const req = new GotHttpApiRequest();
        req._url = url;
        req._method = 'PATCH';
        return req;
    }

    // 为了满足接口定义，这里需要实例方法（虽然逻辑上不太会在实例上调 get/post）
    // 如果接口强制要求实例也要有这些方法，可以返回新实例
    get(url: string): IHttpParam { return GotHttpApiRequest.get(url); }
    post(url: string): IHttpBody { return GotHttpApiRequest.post(url); }
    delete(url: string): IHttpParam { return GotHttpApiRequest.delete(url); }
    put(url: string): IHttpBody { return GotHttpApiRequest.put(url); }
    head(url: string): IHttpParam { return GotHttpApiRequest.head(url); }
    patch(url: string): IHttpBody { return GotHttpApiRequest.patch(url); }


    // ==========================================
    // Builder 方法实现
    // ==========================================

    // --- Headers & Config ---

    header(nameOrObj: string | { [key: string]: string }, value?: string): IHttpRequestBuilder {
        if (typeof nameOrObj === 'string' && value !== undefined) {
            this._headers[nameOrObj] = value;
        } else if (typeof nameOrObj === 'object') {
            Object.assign(this._headers, nameOrObj);
        }
        return this;
    }

    cookie(nameOrObj: string | { [key: string]: string }, value?: string): IHttpRequestBuilder {
        if (typeof nameOrObj === 'string') {
            if (value !== undefined) {
                // cookie(name, value)
                this._cookies[nameOrObj] = value;
            } else {
                // cookie(str) -> "a=1; b=2"
                nameOrObj.split(';').forEach(pair => {
                    const [k, v] = pair.split('=');
                    if (k) this._cookies[k.trim()] = v ? v.trim() : '';
                });
            }
        } else if (typeof nameOrObj === 'object') {
            Object.assign(this._cookies, nameOrObj);
        }
        return this;
    }

    referer(referer: string): IHttpRequestBuilder {
        this._referer = referer;
        return this;
    }

    userAgent(userAgent: string): IHttpRequestBuilder {
        this._userAgent = userAgent;
        return this;
    }

    autoRedirect(): IHttpRequestBuilder {
        this._autoRedirect = true;
        return this;
    }

    requestConfig(config: IHttpRequestConfig): any { // 返回 any 以匹配接口的不严格定义，或 IHttpRequestBuilder
        this._config = config;
        return this;
    }

    // --- Params (IHttpParam / IHttpBody) ---

    param(name?: string, value?: any): any {
        if (name && value !== undefined) {
            this._searchParams.append(name, String(value));
            return this; // 返回 this，既是 IHttpParam 也是 IHttpRequestBuilder
        }
        // param() 无参调用，意图是转换接口类型
        return this;
    }

    params(nameValues: { [key: string]: any }): any {
        for (const [k, v] of Object.entries(nameValues)) {
            this._searchParams.append(k, String(v));
        }
        return this;
    }

    // --- Body (IHttpBody) ---

    json(json?: string | object): any {
        if (json === undefined) {
            // json() 无参调用
            this._contentType = 'application/json';
        } else if (typeof json === 'string') {
            try {
                this._jsonBody = JSON.parse(json);
            } catch {
                this._jsonBody = json; // Fallback or raw string
            }
            this._contentType = 'application/json';
        } else {
            this._jsonBody = json;
            this._contentType = 'application/json';
        }
        return this;
    }

    body(body?: string, contentType?: string): any {
        if (body !== undefined) {
            this._rawBody = body;
        }
        if (contentType) {
            this._contentType = contentType;
        } else if (!this._contentType) {
            this._contentType = 'application/x-www-form-urlencoded';
        }
        return this;
    }

    data(nameOrObj?: string | { [key: string]: any }, value?: any): any {
        if (typeof nameOrObj === 'string' && value !== undefined) {
            this._formBody[nameOrObj] = value;
        } else if (typeof nameOrObj === 'object') {
            Object.assign(this._formBody, nameOrObj);
        }
        // data() 无参调用
        if (!this._contentType) {
            this._contentType = 'application/x-www-form-urlencoded';
        }
        return this;
    }

    // ==========================================
    // 核心执行方法 Perform (Got 实现)
    // ==========================================

    async perform(): Promise<IHttpResponse> {
        // 1. 合并 Headers
        const finalHeaders = { ...this._headers };

        if (this._userAgent) finalHeaders['User-Agent'] = this._userAgent;
        if (this._referer) finalHeaders['Referer'] = this._referer;
        if (this._contentType) finalHeaders['Content-Type'] = this._contentType;

        // 2. 处理 Cookie
        const cookieParts: string[] = [];
        for (const [k, v] of Object.entries(this._cookies)) {
            cookieParts.push(`${k}=${v}`);
        }
        if (cookieParts.length > 0) {
            const existing = finalHeaders['Cookie'] ? finalHeaders['Cookie'] + '; ' : '';
            finalHeaders['Cookie'] = existing + cookieParts.join('; ');
        }

        // 3. 构建 Got 基础选项
        const options: OptionsInit = {
            method: this._method,
            headers: finalHeaders,
            searchParams: this._searchParams,
            followRedirect: this._autoRedirect,
            throwHttpErrors: false,
            responseType: 'text',
            // 如果配置中有 timeout 则添加
            ...(this._config.timeout ? { timeout: { request: this._config.timeout } } : {}),
        };

        // 4. 处理 Body 互斥逻辑
        if (this._jsonBody !== undefined) {
            options.json = this._jsonBody;
        } else if (this._rawBody !== undefined) {
            options.body = this._rawBody;
        } else if (Object.keys(this._formBody).length > 0) {
            options.form = this._formBody;
        }

        // =========================================================
        // 5. 处理代理 (Proxies) - 适配字符串类型
        // =========================================================

        // 假设 interface IHttpRequestConfig { proxies?: string; ... }
        if (this._config.proxies && this._config.proxies.trim() !== '') {

            // 🌟 变化点：直接使用字符串，不再取数组下标
            const proxyUrl = this._config.proxies.trim();
            const lowerProxyUrl = proxyUrl.toLowerCase();

            // SOCKS5 代理处理
            if (lowerProxyUrl.startsWith('socks')) {
                const socksAgent = new SocksProxyAgent(proxyUrl);
                options.agent = {
                    http: socksAgent,
                    https: socksAgent
                };
            }
            // HTTP/HTTPS 代理处理
            else if (lowerProxyUrl.startsWith('http')) {
                options.agent = {
                    http: new HttpProxyAgent({
                        keepAlive: true,
                        keepAliveMsecs: 1000,
                        maxSockets: 256,
                        maxFreeSockets: 256,
                        proxy: proxyUrl
                    }),
                    https: new HttpsProxyAgent({
                        keepAlive: true,
                        keepAliveMsecs: 1000,
                        maxSockets: 256,
                        maxFreeSockets: 256,
                        proxy: proxyUrl
                    })
                };
            }
        }

        // 6. 发送请求
        try {
            console.log('gotRequest', this._url, options)
            const response = await got(this._url, options);
            console.log('got response', response);
            return new GotHttpResponse(response as Response<string>);
        } catch (error: any) {
            console.error('Got Request Error:', error);
            throw error;
        }
    }
}
