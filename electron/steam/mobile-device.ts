import {GotHttpApiRequest} from "../utils/requests.ts";
import getEndpoints from "./endpoints.ts";
import {
    ACCESS_TOKEN_NAME,
    APP_VERSION_NAME,
    DEFAULT_APP_VERSION, DEFAULT_CLIENT_PLATFORM,
    DEFAULT_LANGUAGE, DEFAULT_USER_AGENT, DEVICEID_NAME,
    LANGUAGE_NAME
} from "./constants.ts";
import {parseErrorResult, parseSteamResult} from "./index.ts";
import * as crypto from "node:crypto";
import globalStore from "../store";

export async function DeregisterMobileDevice() {
    throw Error('Not Support')
}

export async function RegisterMobileDevice(access_token: string) {
    const deviceid = `${DEFAULT_CLIENT_PLATFORM}:${crypto.randomUUID().toLowerCase()}`
    return GotHttpApiRequest.post(getEndpoints('MobileDevice', 'RegisterMobileDevice', 1))
        .param(ACCESS_TOKEN_NAME, access_token)
        .data(LANGUAGE_NAME, DEFAULT_LANGUAGE)
        .data(APP_VERSION_NAME, DEFAULT_APP_VERSION)
        .data(DEVICEID_NAME, deviceid)
        .data()
        .userAgent(DEFAULT_USER_AGENT)
        .requestConfig({timeout: 5000, proxies: globalStore.getState().settings.proxy})
        .perform()
        .then(res => {
            const response:SteamResponse<string> = parseSteamResult(res)
            response.response = deviceid
            return response
        })
        .catch(reason => parseErrorResult<string>(reason))
}
