import { MarketActionBuilder, MarketActionGenerator } from './Actions/Generator';
import AtomicMarketApi from './API/Explorer';
import ApiError from './Errors/ApiError';

export { AtomicMarketApi, MarketActionBuilder, MarketActionGenerator, ApiError };

// Action-builder argument and output shapes, plus the contract's action-name
// constants. EosioActionObject/EosioAuthorizationObject are re-exports of the
// @atomichub/atomicassets types.
export {
    AcceptBuyofferInput, AnnounceAuctionInput, AnnounceSaleInput, AtomicMarketActionName,
    AtomicMarketActions, AttributeRoyaltyValue, EosioActionData, EosioActionObject,
    EosioAuthorizationObject, FulfillTemplateBuyofferInput, PurchaseSaleInput,
    RoyaltyConfigInput, RoyaltyPair, RoyaltyRecipientInput
} from './Actions/Generator';

// Settlement math for delphi-priced sales: the deposit amount a purchase
// transfers is derived, not read off the sale, and nothing on chain asserts it.
export type { DelphiPairSpec } from './Actions/Delphi';
export { deriveSettlementAmount, formatQuantity } from './Actions/Delphi';

// AtomicHub public endpoint presets (re-exported from @atomichub/atomicassets)
// and the preconfigured market client factory.
export type { AtomicHubNetwork } from './Networks';
export { NETWORK_ENDPOINTS, marketApiForNetwork } from './Networks';

// Typed rows for the contract's on-chain tables (get_table_rows shapes).
export * from './Tables';

// Market API response object types, query-parameter types, and enums (the
// enums ship as runtime values). Exported from the package root so consumers
// no longer reach into deep build/ paths.
export * from './API/Explorer/Objects';
export * from './API/Explorer/Params';
export * from './API/Explorer/Enums';
