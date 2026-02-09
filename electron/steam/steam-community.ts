import * as SteamTotp from 'steam-totp'
import globalStore from "../store";
import {QueryTime} from "./two-factor.ts";
import {DEFAULT_USER_AGENT} from "./constants.ts";
import {GotHttpApiRequest} from "../utils/requests.ts";
import {COMMUNITY_ENDPOINTS, STEAM_COMMUNITY_BASE} from "./endpoints.ts";
import {parseErrorResult, parseSteamCommunityResult} from "./index.ts";

/**
 * 生成2fa
 * @param shard_secret 秘钥
 */
export async function generateAuthCode(shard_secret: string) {
    const state = globalStore.getState()
    if (Date.now() > state.runtimeContext.timeNextSyncTime) {
        await QueryTime()
    }
    // SteamTotp 需要的 offset 是 (ServerTime - LocalTime)
    return SteamTotp.generateAuthCode(shard_secret, state.runtimeContext.timeOffset)
}

export async function getTime(shard_secret?: string) {
    try {
        if (!shard_secret) {
            return SteamTotp.time(globalStore.getState().runtimeContext.timeOffset)
        }
        if (Date.now() > globalStore.getState().runtimeContext.timeNextSyncTime) {
            await QueryTime()
        }
        return SteamTotp.time(globalStore.getState().runtimeContext.timeOffset)
    } catch (e) {
        return SteamTotp.time(globalStore.getState().runtimeContext.timeOffset)
    }

}

/**
 *
 * @param options
 */
export async function getConfirmations(options: ConfirmationOptions) {
    const params = await generateConfirmationQueryParamsAsNVC({
        tag: 'list',
        identitySecret: options.identitySecret,
        p: options.deviceid,
        a: options.steamid
    })
    return GotHttpApiRequest.get(COMMUNITY_ENDPOINTS.confirmations)
        .params(params)
        .userAgent(DEFAULT_USER_AGENT)
        .requestConfig({
            timeout: globalStore.getState().settings.timeout,
            proxies: globalStore.getState().settings.proxy
        })
        .referer(STEAM_COMMUNITY_BASE)
        .cookie(options.cookies)
        .perform()
        .then(res => parseSteamCommunityResult<ConfirmationsResponse>(res))
        .catch(reason => parseErrorResult<ConfirmationsResponse>(reason))
}

export async function getConfirmation(options: ConfirmationOptions, confirmationId: string) {
    const ret = await generateConfirmationQueryParamsAsNVC({
        identitySecret: options.identitySecret,
        tag: 'detail',
        p: options.deviceid,
        a: options.steamid
    })
    return GotHttpApiRequest.get(`${COMMUNITY_ENDPOINTS.confirmationDetail}${confirmationId}`)
        .params(ret)
        .userAgent(DEFAULT_USER_AGENT)
        .requestConfig({
            timeout: globalStore.getState().settings.timeout,
            proxies: globalStore.getState().settings.proxy
        })
        .referer(STEAM_COMMUNITY_BASE)
        .cookie(options.cookies)
        .perform()
        .then(res => parseSteamCommunityResult<any>(res))
        .catch(reason => parseErrorResult<any>(reason))
}


export async function acceptConfirmation(options: ConfirmationOptions, confirmation: Confirmation) {
    return ajaxop(options, confirmation, 'allow', 'accept')
}

export async function cancelConfirmation(options: ConfirmationOptions, confirmation: Confirmation) {
    return ajaxop(options, confirmation, 'cancel', 'reject')
}


async function ajaxop(options: ConfirmationOptions, confirmation: Confirmation, op: string, tag: string): Promise<SteamResponse<ConfirmationAjaxOpResponse>> {
    const ret = await generateConfirmationQueryParamsAsNVC({
        identitySecret: options.identitySecret,
        tag: tag,
        p: options.deviceid,
        a: options.steamid
    })
    ret.cid = confirmation.id
    ret.op = op
    ret.ck = confirmation.nonce
    return GotHttpApiRequest.post(COMMUNITY_ENDPOINTS.ajaxop)
        .data(ret)
        .userAgent(DEFAULT_USER_AGENT)
        .requestConfig({
            timeout: globalStore.getState().settings.timeout,
            proxies: globalStore.getState().settings.proxy
        })
        .referer(COMMUNITY_ENDPOINTS.confirmationDetail + confirmation.id)
        .cookie(options.cookies)
        .perform()
        .then(res => parseSteamCommunityResult<ConfirmationAjaxOpResponse>(res))
        .catch(reason => parseErrorResult<ConfirmationAjaxOpResponse>(reason))
}

async function generateConfirmationQueryParamsAsNVC(options: {
    identitySecret: string,
    tag: string,
    p: string,
    a: string
}): Promise<Record<string, string>> {
    const time = await getTime()
    const k = SteamTotp.generateConfirmationKey(options.identitySecret, time, options.tag)
    return {
        p: options.p,
        a: options.a,
        k: k,
        t: time + '',
        m: 'react',
        tag: options.tag
    }
}
