export type ApiInterface = 'TwoFactor' | 'Econ'

export type ApiMethod = TwoFactorMethod | EconMethod

type TwoFactorMethod = 'QueryTime' | 'RemoveAuthenticator' | 'RemoveAuthenticatorViaChallengeContinue' | 'RemoveAuthenticatorViaChallengeStart'
| 'SendEmail' | 'UpdateTokenVersion' | 'ValidateToken'

type EconMethod = 'FlushAssetAppearanceCache' | 'FlushContextCache' | 'FlushInventoryCache' | 'GetAssetClassInfo' | 'GetAssetPropertySchema'
| 'GetInventoryItemsWithDescriptions' | 'GetTradeHistory' | 'GetTradeHoldDurations' | 'GetTradeOffer' | 'GetTradeOffers'
| 'GetTradeOffersSummary' | 'GetTradeStatus'

export type ApiVersion = 1 | 2

export default function getEndpoints(apiInterface: ApiInterface, apiMethod: ApiMethod, apiVersion: ApiVersion){
    return `https://api.steampowered.com/I${apiInterface}Service/${apiMethod}/v${apiVersion}/`
}
