import {
    LoginSession,
    EAuthTokenPlatformType,
    EResult
} from 'steam-session';
import globalStore from "../store";
import {ConstructorOptions} from "steam-session/dist/interfaces-external";

class SteamLoginExecutor {
    // 使用 Map 管理所有正在进行或已登录的会话
    private readonly _sessions: Map<string, LoginSession> = new Map<string, LoginSession>();

    constructor() {
    }

    /**
     * 发起登录 (入口)
     */
    public async login(options: LoginOptions) {
        // 1. 基础校验
        if (!options.account_name) {
            this._sendLoginMessage({
                account_name: 'unknown',
                result: EResult.InvalidParam,
                error_message: 'Account name is required'
            });
            return;
        }

        const accountName = options.account_name;

        try {
            // 2. 清理旧会话 (防止重复登录同一账号导致内存泄漏)
            if (this._sessions.has(accountName)) {
                console.log(`[SteamExecutor] Cleaning up existing session for ${accountName}`);
                this._sessions.get(accountName)?.cancelLoginAttempt();
                this._sessions.get(accountName)?.removeAllListeners(); // 移除旧监听器
                this._sessions.delete(accountName);
            }

            // 3. 准备代理配置
            const state = globalStore.getState();
            const sessionOptions: ConstructorOptions = {};
            if (state.settings.proxy) {
                const proxy = state.settings.proxy.trim();
                if (proxy.startsWith('http')) {
                    sessionOptions.httpProxy = proxy;
                } else if (proxy.startsWith('socks')) {
                    sessionOptions.socksProxy = proxy;
                }
            }

            // 4. 创建新会话
            const session = new LoginSession(EAuthTokenPlatformType.MobileApp, sessionOptions);
            session.loginTimeout = 120_000
            this._sessions.set(accountName, session);

            // 5. 绑定事件监听 (先埋伏)
            this._bindSessionEvents(session, accountName);

            // 6. 执行登录动作 (再开枪)
            if (options.refresh_token) {
                // 6a.如果有刷新令牌，直接刷新
                session.refreshToken = options.refresh_token;
                this._sendLoginMessage({ account_name: accountName, result: EResult.OK, status: 'Converting' }); //以此状态告知前端正在置换
                await session.refreshAccessToken();
                // refreshAccessToken 成功后通常不会触发 authenticated 事件，需要手动处理成功逻辑，或者依赖库的行为
                // steam-session 的 refreshAccessToken 如果成功，access_token 会更新。
                // 为了统一，我们手动触发一次成功消息
                await this._handleLoginSuccess(session, accountName);

            } else if (options.password) {
                // 6b. 账号密码登录
                const startResult = await session.startWithCredentials({
                    accountName: accountName,
                    password: options.password,
                    steamGuardCode: options.steamGuardCode // 如果是第二次调用（带了验证码），这里传入
                });

                // 7. 处理同步返回结果 (关键：判断是否需要 2FA)
                if (startResult.actionRequired) {
                    this._sendLoginMessage({
                        account_name: accountName,
                        result: EResult.AccountLogonDenied, // 通常用这个码表示需要验证
                        status: 'Need2FA',
                        valid_actions: startResult.validActions // 告诉前端是 email 还是 app 验证码
                    });
                }
            } else {
                this._sendLoginMessage({
                    account_name: accountName,
                    result: EResult.InvalidParam,
                    status: 'Failed',
                })
            }

        } catch (e: any) {
            console.error(`[SteamExecutor] Login Error for ${accountName}:`, e);
            this._sendLoginMessage({
                account_name: accountName,
                result: e.eresult || EResult.Fail,
                status: 'Failed',
                error_message: e.message
            });
            // 出错后是否清理 Session 取决于业务，如果是密码错，建议清理；如果是 2FA 错，保留 Session
            if (e.eresult === EResult.InvalidPassword || e.eresult === EResult.AccountLogonDenied) {
                this.cancelLogin(accountName).then();
            }
        }
    }

    /**
     * 提交验证码 (2FA)
     */
    public async submitSteamGuardCode(account_name: string, authCode: string) {
        const session = this._sessions.get(account_name);
        if (!session) {
            this._sendLoginMessage({
                account_name,
                result: EResult.Fail,
                error_message: 'Session expired or not found'
            });
            return;
        }

        try {
            // 提交验证码
            await session.submitSteamGuardCode(authCode);
            // 注意：submitSteamGuardCode 成功后，steam-session 会自动触发 'authenticated' 事件
            // 所以这里不需要手动发送成功消息，监听器会处理
        } catch (e: any) {
            console.error(`[SteamExecutor] 2FA Error for ${account_name}:`, e);
            this._sendLoginMessage({
                account_name,
                result: EResult.InvalidPassword, // 这里复用 InvalidPassword 表示验证码错
                status: 'Failed',
                error_message: e.message
            });
            // 验证码输错不要销毁 Session，允许用户重试
        }
    }

    /**
     * 取消/登出
     */
    public async cancelLogin(account_name: string) {
        const session = this._sessions.get(account_name);
        if (session) {
            try {
                session.cancelLoginAttempt();
                session.removeAllListeners();
            } catch (e) { /* ignore */ }
            this._sessions.delete(account_name);
        }
    }

    // --- 私有辅助方法 ---

    private _bindSessionEvents(session: LoginSession, accountName: string) {
        // 登录成功事件
        session.on('authenticated', async () => {
            await this._handleLoginSuccess(session, accountName);
        });

        // 错误事件
        session.on('error', (err) => {
            this._sendLoginMessage({
                account_name: accountName,
                result: err.eresult || EResult.Fail,
                status: 'Failed',
                error_message: err.message
            });
        });

        // 超时事件
        session.on('timeout', () => {
            this._sendLoginMessage({
                account_name: accountName,
                result: EResult.Timeout,
                status: 'Timeout',
                error_message: 'Connection timed out'
            });
            // 超时通常清理掉比较好
            this.cancelLogin(accountName).then();
        });
    }

    private async _handleLoginSuccess(session: LoginSession, accountName: string) {
        try {
            const cookies = await session.getWebCookies();
            this._sendLoginMessage({
                account_name: accountName,
                result: EResult.OK,
                status: 'LoginSuccess',
                data: {
                    access_token: session.accessToken,
                    refresh_token: session.refreshToken,
                    account_name: session.accountName,
                    steamid: session.steamID.getSteamID64(),
                    cookies: cookies
                }
            });

            // 登录成功后，Session 对象通常就不需要保留在 executor 里了（除非你要做保活）
            // 或者转移到另一个 SessionManager 管理器中去处理后续业务
            this._sessions.delete(accountName);

        } catch (e: any) {
            this._sendLoginMessage({
                account_name: accountName,
                result: e.eresult || EResult.Fail,
                status: 'Failed',
                error_message: 'Failed to retrieve cookies'
            });
        }
    }

    private _sendLoginMessage(payload: SteamLoginEvent) {
        // 统一通过 IPC 发送给渲染进程
        // 渲染进程通过 payload.account_name 来判断更新 UI 上的哪个卡片
        globalStore.sendMessage('steam:message:login-status-changed', payload);
    }
}

const steamLoginExecutor = new SteamLoginExecutor();

export default steamLoginExecutor
