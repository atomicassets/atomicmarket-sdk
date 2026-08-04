import { IAsset, ILightCollection, IOffer, ITransfer } from '@atomichub/atomicassets';

import { AuctionState, BuyofferState, SaleState } from './Enums';

export interface IMarketPair {
    listing_symbol: string;
    settlement_symbol: string;
    delphi_pair_name: string;
    invert_delphi_pair: boolean;
    data: {
        contract: string,
        delphi_pair_name: string,
        base_symbol: string,
        base_precision: number,
        quote_symbol: string,
        quote_precision: number,
        median: number,
        median_precision: number,
        updated_at_time: string,
        updated_at_block: string
    };
}

export interface IPriceStats {
    average: string;
    median: string;
    suggested_average: string;
    suggested_median: string;
    min: string;
    max: string;
}

export interface IMarketToken {
    token_precision: number;
    token_contract: string;
    token_symbol: string;
}

export interface IMarketPrice extends IMarketToken {
    amount: string;
    median?: number | null;
}

export interface IMarketplace {
    marketplace_name: string;
    creator: string;
    created_at_block: string;
    created_at_time: string;
}

export interface IMarketConfig {
    atomicassets_contract: string;
    atomicmarket_contract: string;
    delphioracle_contract: string;
    version: string;
    maker_market_fee: number;
    taker_market_fee: number;
    maximum_auction_duration: number;
    minimum_bid_increase: number;
    auction_reset_duration: number;
    supported_tokens: IMarketToken[];
    supported_pairs: IMarketPair[];
}

export interface IMarketAsset extends IAsset {
    sales: Array<{market_contract: string, sale_id: string}>;
    auctions: Array<{market_contract: string, auction_id: string}>;
    prices: Array<{
        market_contract: string,
        token: IMarketToken,
        median: string,
        average: string,
        suggested_median: string,
        suggested_average: string,
        min: string,
        max: string,
        sales: string
    }>;
}

export interface ISale {
    market_contract: string;
    assets_contract: string;
    sale_id: string;
    seller: string;
    buyer: string | null;
    offer_id: string;
    price: IMarketPrice;
    listing_symbol: string;
    listing_price: string;
    assets: IMarketAsset[];
    maker_marketplace: string;
    taker_marketplace: string | null;
    collection: ILightCollection;
    current_collection_fee?: number;
    state: SaleState;
    is_seller_contract: boolean;
    updated_at_block: string;
    updated_at_time: string;
    created_at_block: string;
    created_at_time: string;
}

export interface IAuctionBid {
    number: number;
    account: string;
    amount: string;
    txid: string;
    created_at_block: string;
    created_at_time: string;
}

export interface IAuction {
    market_contract: string;
    assets_contract: string;
    auction_id: string;
    seller: string;
    buyer: string | null;
    price: IMarketPrice;
    assets: IMarketAsset[];
    bids: IAuctionBid[];
    maker_marketplace: string;
    taker_marketplace: string | null;
    claimed_by_buyer: boolean;
    claimed_by_seller: boolean;
    collection: ILightCollection;
    current_collection_fee?: number;
    state: AuctionState;
    is_seller_contract: boolean;
    end_time: string;
    updated_at_block: string;
    updated_at_time: string;
    created_at_block: string;
    created_at_time: string;
}

export interface IBuyoffer {
    market_contract: string;
    assets_contract: string;
    buyoffer_id: string;
    seller: string;
    buyer: string;
    price: IMarketPrice;
    assets: IMarketAsset[];
    maker_marketplace: string;
    taker_marketplace: string | null;
    collection: ILightCollection;
    current_collection_fee?: number;
    state: BuyofferState;
    memo: string;
    decline_memo: string | null;
    is_seller_contract: boolean;
    updated_at_block: string;
    updated_at_time: string;
    created_at_block: string;
    created_at_time: string;
}

export interface IMarketTransfer extends ITransfer {
    assets: IMarketAsset[];
}

export interface IMarketOffer extends IOffer {
    sender_assets: IMarketAsset[];
    recipient_assets: IMarketAsset[];
}

// AtomicMarket v2 royalty read-layer response shapes (/v1/royalties/*).
// These mirror the deployed API's raw config/rule rows, not a matching-engine
// result. The API serializes uint32 splits and rule weights as decimal
// strings, while recipient weights inside pairs are numbers.
export interface IRoyaltyRecipient {
    recipient: string;
    weight: number;
}

export interface IRoyaltyConfig {
    founders: IRoyaltyRecipient[];
    attribute_mode: number;
    split_founders: string;
    split_templates: string;
    split_attributes: string;
}

export interface IRoyaltyTemplateRule {
    template_id: string;
    recipients: IRoyaltyRecipient[];
}

export interface IRoyaltyAttributeRule {
    rule_id: string;
    source: number;
    field: string;
    // Raw deserialized contract variant tuple, e.g. ["uint64", "5"] — the
    // payload is preserved verbatim, never re-parsed.
    value: [string, unknown];
    weight: string;
    recipients: IRoyaltyRecipient[];
}
