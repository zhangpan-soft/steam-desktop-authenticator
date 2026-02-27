export type ApiInterface = 'TwoFactor' | 'Econ' | 'MobileDevice'

export type ApiMethod = TwoFactorMethod | EconMethod | MobileDeviceMethod

type TwoFactorMethod =
    'AddAuthenticator'
    | 'CreateEmergencyCodes'
    | 'DestroyEmergencyCodes'
    | 'FinalizeAddAuthenticator'
    | 'QueryStatus'
    | 'QueryTime'
    | 'RemoveAuthenticator'
    | 'RemoveAuthenticatorViaChallengeContinue'
    | 'RemoveAuthenticatorViaChallengeStart'
    | 'SendEmail'
    | 'UpdateTokenVersion'
    | 'ValidateToken'

type EconMethod =
    'FlushAssetAppearanceCache'
    | 'FlushContextCache'
    | 'FlushInventoryCache'
    | 'GetAssetClassInfo'
    | 'GetAssetPropertySchema'
    | 'GetInventoryItemsWithDescriptions'
    | 'GetTradeHistory'
    | 'GetTradeHoldDurations'
    | 'GetTradeOffer'
    | 'GetTradeOffers'
    | 'GetTradeOffersSummary'
    | 'GetTradeStatus'

type MobileDeviceMethod = 'RegisterMobileDevice' | 'DeregisterMobileDevice'

export type ApiVersion = 1 | 2

export default function getEndpoints(apiInterface: ApiInterface, apiMethod: ApiMethod, apiVersion: ApiVersion) {
    return `https://api.steampowered.com/I${apiInterface}Service/${apiMethod}/v${apiVersion}/`
}

export const STEAM_COMMUNITY_BASE = 'https://steamcommunity.com'

export const PHONE_AJAX_URL = `${STEAM_COMMUNITY_BASE}/steamguard/phoneajax`

export const COMMUNITY_ENDPOINTS = {
    confirmations: `${STEAM_COMMUNITY_BASE}/mobileconf/getlist`,
    confirmationDetail: `${STEAM_COMMUNITY_BASE}/mobileconf/detailspace/`,
    ajaxop: `${STEAM_COMMUNITY_BASE}/mobileconf/ajaxop`,
}
