import {EResult} from "steam-session";
import {Base64} from "js-base64";

export function parseSteamResult<T>(response: IHttpResponse): SteamResponse<T> {
    const eresult = response.getHeaders()['x-eresult']
    const _eresult = eresult ? parseInt(eresult) : EResult.Fail
    if (response.getCode() !== 200) {
        return {
            eresult: _eresult,
            message: response.getText(),
            status: response.getCode(),
        }
    }
    if (_eresult === EResult.OK) {
        const apiResponse = response.getBody<SteamApiResponse<T>>()
        return {
            eresult: _eresult,
            ...apiResponse,
            status: response.getCode()
        }
    } else {
        return {
            eresult: _eresult,
            message: response.getText(),
            status: response.getCode()
        }
    }
}

export function parseSteamCommunityResult<T>(response: IHttpResponse): SteamResponse<T> {
    const eresult = response.getHeaders()['x-eresult']
    const _eresult = eresult ? parseInt(eresult) : undefined
    if (response.getCode() !== 200) {
        console.log(333333333)
        return {
            eresult: _eresult || EResult.Fail,
            message: response.getText(),
            status: response.getCode(),
        }
    }
    console.log(44444444)
    return {
        eresult: _eresult || EResult.OK,
        status: response.getCode(),
        response: response.getBody<T>()
    }
}

export function parseErrorResult<T>(reason: any): SteamResponse<T> {
    return {
        eresult: EResult.Fail,
        message: reason.message,
        status: reason.status | 0
    }
}

export function parseToken(token: string) {
    const parts = token.split('.')
    return {
        header: JSON.parse(Base64.decode(parts[0])),
        payload: JSON.parse(Base64.decode(parts[1])),
        signature: parts[2]
    }
}
