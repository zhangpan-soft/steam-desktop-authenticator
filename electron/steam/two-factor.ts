import {GotHttpApiRequest} from "../utils/requests.ts";
import getEndpoints from "./endpoints.ts";
import globalStore from "../store";
import {STEAM_ID_NAME} from "./constants.ts";

/**
 * 查询服务器时间
 */
export async function queryTime(): Promise<QueryTimeResponse> {

    // Steam API 通常需要 POST 且带上 steamid=0 (虽然有时不带也能过，但带上更标准)

    const response = await GotHttpApiRequest.post(getEndpoints('TwoFactor', 'QueryTime', 1))
        .data(STEAM_ID_NAME, '0')
        .data()
        .requestConfig({
            timeout: 5000,
            proxies: globalStore.getState().settings.proxy
        })
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
