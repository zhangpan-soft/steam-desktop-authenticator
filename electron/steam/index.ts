import * as SteamTotp from 'steam-totp'
import globalStore from "../store";
import {queryTime} from "./two-factor.ts";

/**
 * 生成2fa
 * @param shard_secret 秘钥
 */
export async function generateAuthCode(shard_secret: string) {
    const state = globalStore.getState()
    if (Date.now() > state.runtimeContext.timeNextSyncTime) {
        await queryTime()
    }
    // SteamTotp 需要的 offset 是 (ServerTime - LocalTime)
    return SteamTotp.generateAuthCode(shard_secret, state.runtimeContext.timeOffset)
}


