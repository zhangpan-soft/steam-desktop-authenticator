import {GotHttpApiRequest} from "../utils/requests.ts";
import getEndpoints from "./endpoints.ts";
import {ACCESS_TOKEN_NAME, DEFAULT_LANGUAGE, DEFAULT_USER_AGENT, LANGUAGE_NAME, STEAM_ID_NAME} from "./constants.ts";
import {settingsDb} from "../db";
import {parseErrorResult, parseSteamResult} from "./index.ts";

export async function ConfirmAddPhoneToAccount(access_token: string, steamid: string, stoken: string) {
    return GotHttpApiRequest.post(getEndpoints('Phone', 'ConfirmAddPhoneToAccount', 1))
        .param(ACCESS_TOKEN_NAME, access_token)
        .data(STEAM_ID_NAME, steamid)
        .data('stoken', stoken)
        .data()
        .userAgent(DEFAULT_USER_AGENT)
        .requestConfig({
            timeout: settingsDb.data.timeout,
            proxies: settingsDb.data.proxy
        })
        .perform()
        .then(res => parseSteamResult<any>(res))
        .catch(err => parseErrorResult<any>(err))
}

export async function IsAccountWaitingForEmailConfirmation(access_token: string) {
    return GotHttpApiRequest.post(getEndpoints('Phone', 'IsAccountWaitingForEmailConfirmation', 1))
        .param(ACCESS_TOKEN_NAME, access_token)
        .data()
        .userAgent(DEFAULT_USER_AGENT)
        .requestConfig({
            timeout: settingsDb.data.timeout,
            proxies: settingsDb.data.proxy
        })
        .perform()
        .then(res => parseSteamResult<IsAccountWaitingForEmailConfirmationResponse>(res))
        .catch(err => parseErrorResult<IsAccountWaitingForEmailConfirmationResponse>(err))
}

export async function SendPhoneVerificationCode(access_token: string, language?: string) {
    return GotHttpApiRequest.post(getEndpoints('Phone', 'SendPhoneVerificationCode', 1))
        .param(ACCESS_TOKEN_NAME, access_token)
        .data(LANGUAGE_NAME, language || DEFAULT_LANGUAGE)
        .data()
        .userAgent(DEFAULT_USER_AGENT)
        .requestConfig({
            timeout: settingsDb.data.timeout,
            proxies: settingsDb.data.proxy
        })
        .perform()
        .then(res => parseSteamResult<any>(res))
        .catch(err => parseErrorResult<any>(err))
}


export async function SetAccountPhoneNumber(access_token: string, phoneNumber: string, phoneCountryCode: string) {
    return GotHttpApiRequest.post(getEndpoints('Phone', 'SetAccountPhoneNumber', 1))
        .param(ACCESS_TOKEN_NAME, access_token)
        .data('phone_number', phoneNumber)
        .data('phone_country_code', phoneCountryCode)
        .data()
        .userAgent(DEFAULT_USER_AGENT)
        .requestConfig({
            timeout: settingsDb.data.timeout,
            proxies: settingsDb.data.proxy
        })
        .perform()
        .then(res => parseSteamResult<SetAccountPhoneNumberResponse>(res))
        .catch(err => parseErrorResult<SetAccountPhoneNumberResponse>(err))
}

export async function VerifyAccountPhoneWithCode(access_token: string, code: string) {
    return GotHttpApiRequest.post(getEndpoints('Phone', 'VerifyAccountPhoneWithCode', 1))
        .param(ACCESS_TOKEN_NAME, access_token)
        .data('code', code)
        .data()
        .userAgent(DEFAULT_USER_AGENT)
        .requestConfig({
            timeout: settingsDb.data.timeout,
            proxies: settingsDb.data.proxy
        })
        .perform()
        .then(res => parseSteamResult<any>(res))
        .catch(err => parseErrorResult<any>(err))
}
