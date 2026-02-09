import {GotHttpApiRequest} from "../utils/requests.ts";
import getEndpoints, {PHONE_AJAX_URL} from "./endpoints.ts";
import globalStore from "../store";
import {
    ACCESS_TOKEN_NAME,
    DATA_ACTIVATION_CODE_NAME,
    DATA_AUTHENTICATOR_CODE_NAME,
    DATA_AUTHENTICATOR_TIME_NAME,
    DATA_AUTHENTICATOR_TYPE_NAME,
    DATA_DEVICE_IDENTIFIER_NAME,
    DATA_GENERATE_NEW_TOKEN_NAME,
    DATA_SMS_CODE_NAME,
    DATA_SMS_PHONE_ID_NAME,
    DEFAULT_DATA_AUTHENTICATOR_TYPE_VALUE,
    DEFAULT_DATA_SMS_PHONE_ID_VALUE, DEFAULT_USER_AGENT,
    SESSION_ID_NAME,
    STEAM_ID_NAME,
} from "./constants.ts";
import {EResult} from "steam-session";
import {parseErrorResult, parseSteamResult, parseToken} from "./index.ts";
import {generateAuthCode} from "./steam-community.ts";

/**
 * 查询服务器时间
 */
export async function QueryTime(): Promise<QueryTimeResponse> {

    // Steam API 通常需要 POST 且带上 steamid=0 (虽然有时不带也能过，但带上更标准)

    const response = await GotHttpApiRequest.post(getEndpoints('TwoFactor', 'QueryTime', 1))
        .data(STEAM_ID_NAME, '0')
        .data()
        .requestConfig({
            timeout: 5000,
            proxies: globalStore.getState().settings.proxy
        })
        .userAgent(DEFAULT_USER_AGENT)
        .perform()

    if (!response.isSuccess()) {
        throw new Error(`Query Time Failed: ${response.getCode()}`)
    }

    // ✅ 修正：解析外层的 { response: ... } 结构
    const wrapper = response.getBody<SteamApiResponse<QueryTimeResponse>>()

    if (!wrapper || !wrapper.response || !wrapper.response.server_time) {
        throw new Error('Invalid Steam API Response')
    }

    const data = wrapper.response

    // 更新缓存策略
    // 如果 API 返回了 try_again_seconds 则使用，否则默认 10 分钟
    const cacheDuration = (data.try_again_seconds || 600) * 1000
    const state = globalStore.getState()
    state.runtimeContext.timeNextSyncTime = Date.now() + cacheDuration

    // 计算时间偏移量 (Server - Local)
    // 注意：server_time 是秒，Date.now() 是毫秒
    const serverTimeSec = parseInt(data.server_time, 10)
    console.log('serverTimeSec', serverTimeSec)
    state.runtimeContext.timeOffset = serverTimeSec - Math.floor(Date.now() / 1000)
    console.log('timeOffset', state.runtimeContext.timeOffset)

    globalStore.updateState('runtime', 'timeOffset', state.runtimeContext.timeOffset)
    globalStore.updateState('runtime', 'timeNextSyncTime', state.runtimeContext.timeNextSyncTime)

    return data

}

export async function hasPhoneAttached(sessionid: string, cookies: string): Promise<SteamResponse<boolean>> {
    return GotHttpApiRequest.post(PHONE_AJAX_URL)
        .data('op', 'has_phone')
        .data('arg', 'null')
        .data(SESSION_ID_NAME, sessionid)
        .data()
        .cookie(cookies)
        .requestConfig({timeout: 5000, proxies: globalStore.getState().settings.proxy})
        .userAgent(DEFAULT_USER_AGENT)
        .perform()
        .then(res => {
            if (res.isSuccess()) {
                return {
                    eresult: EResult.OK,
                    response: res.getBody<any>().has_phone,
                    status: res.getCode()
                }
            }
            return {
                eresult: EResult.Fail,
                message: res.getText(),
                status: res.getCode()
            }
        })
        .catch(err => parseErrorResult(err))
}

export async function AddAuthenticator(access_token: string,
                                       deviceid: string):Promise<SteamResponse<SteamGuard>>{
    return GotHttpApiRequest.post(getEndpoints('TwoFactor','AddAuthenticator',1))
        .param(ACCESS_TOKEN_NAME, access_token)
        .data(STEAM_ID_NAME, parseToken(access_token).payload.sub)
        .data(DATA_AUTHENTICATOR_TYPE_NAME, DEFAULT_DATA_AUTHENTICATOR_TYPE_VALUE)
        .data(DATA_SMS_PHONE_ID_NAME, DEFAULT_DATA_SMS_PHONE_ID_VALUE)
        .data(DATA_DEVICE_IDENTIFIER_NAME, deviceid)
        .data()
        .requestConfig({timeout: 5000, proxies: globalStore.getState().settings.proxy})
        .userAgent(DEFAULT_USER_AGENT)
        .perform()
        .then(res => parseSteamResult<SteamGuard>(res))
        .catch(reason => parseErrorResult(reason))
}

export async function finalizeAddAuthenticator(access_token: string,
                                               shared_secret: string,
                                               smsCode: string):Promise<SteamResponse<FinalizeAuthenticatorResponse>> {
    const code = await generateAuthCode(shared_secret)
    return GotHttpApiRequest.post(getEndpoints('TwoFactor', 'FinalizeAddAuthenticator',1))
        .param(ACCESS_TOKEN_NAME, access_token)
        .data(STEAM_ID_NAME, parseToken(access_token).payload.sub)
        .data(DATA_ACTIVATION_CODE_NAME, smsCode)
        .data(DATA_AUTHENTICATOR_CODE_NAME,code)
        .data(DATA_AUTHENTICATOR_TIME_NAME, Date.now()/1000+globalStore.getState().runtimeContext.timeOffset)
        .data()
        .requestConfig({timeout: 5000, proxies: globalStore.getState().settings.proxy})
        .userAgent(DEFAULT_USER_AGENT)
        .perform()
        .then(res => parseSteamResult<FinalizeAuthenticatorResponse>(res))
        .catch(reason => parseErrorResult(reason))
}

export async function RemoveAuthenticatorViaChallengeStart(access_token: string, cookies: string){
    return GotHttpApiRequest.post(getEndpoints('TwoFactor','RemoveAuthenticatorViaChallengeStart',1))
        .param(ACCESS_TOKEN_NAME, access_token)
        .data(STEAM_ID_NAME, parseToken(access_token).payload.sub)
        .data()
        .cookie(cookies)
        .requestConfig({timeout: 5000, proxies: globalStore.getState().settings.proxy})
        .userAgent(DEFAULT_USER_AGENT)
        .perform()
        .then(res=>parseSteamResult<any>(res))
        .catch(reason => parseErrorResult(reason))
}

export async function RemoveAuthenticatorViaChallengeContinue(access_token:string, smsCode: string){
    return GotHttpApiRequest.post(getEndpoints('TwoFactor','RemoveAuthenticatorViaChallengeContinue',1))
        .param(ACCESS_TOKEN_NAME, access_token)
        .data(STEAM_ID_NAME, parseToken(access_token).payload.sub)
        .data(DATA_SMS_CODE_NAME, smsCode)
        .data(DATA_GENERATE_NEW_TOKEN_NAME, true)
        .data()
        .requestConfig({timeout: 5000, proxies: globalStore.getState().settings.proxy})
        .userAgent(DEFAULT_USER_AGENT)
        .perform()
        .then(res=>parseSteamResult<RemoveAuthenticatorViaChallengeContinueResponse>(res))
        .catch(reason => parseErrorResult(reason))
}

export async function QueryStatus(access_token: string){
    return GotHttpApiRequest.post(getEndpoints('TwoFactor','QueryStatus',1))
        .param(ACCESS_TOKEN_NAME, access_token)
        .data(STEAM_ID_NAME, parseToken(access_token).payload.sub)
        .data()
        .requestConfig({timeout: 5000, proxies: globalStore.getState().settings.proxy})
        .userAgent(DEFAULT_USER_AGENT)
        .perform()
        .then(res=>parseSteamResult<QueryStatusResponse>(res))
        .catch(reason => parseErrorResult(reason))
}
