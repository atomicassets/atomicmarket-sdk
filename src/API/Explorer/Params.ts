import { AssetFilterParams, DateBoundaryParams, OfferApiParams, OfferState, OrderParam, PrimaryBoundaryParams } from '@atomichub/atomicassets';

import { AuctionSort, AuctionState, BuyofferSort, BuyofferState, RoyaltyListingType, RoyaltyPayoutCategory, RoyaltyPayoutSort, SaleSort, SaleState } from './Enums';

export interface ListingFilterParams {
    max_assets?: number;
    min_assets?: number;
    show_seller_contracts?: boolean;
    contract_whitelist?: string;
    seller_blacklist?: string;
    buyer_blacklist?: string;
    marketplace?: string;
    maker_marketplace?: string;
    taker_marketplace?: string;
    symbol?: string;
    seller?: string;
    buyer?: string;
    min_price?: number;
    max_price?: number;
    min_template_mint?: number;
    max_template_mint?: number;
}

export interface BaseAssetFilterParams {
    collection_name?: string;
    template_id?: string;
    schema_name?: string;
    asset_id?: string;
}

export interface AuctionApiParams extends ListingFilterParams, AssetFilterParams, PrimaryBoundaryParams, DateBoundaryParams {
    participant?: string;
    bidder?: string;
    state?: AuctionState | string;
    sort?: AuctionSort | string;
    order?: OrderParam;
    [key: string]: any;
}

export interface SaleApiParams extends ListingFilterParams, AssetFilterParams, PrimaryBoundaryParams, DateBoundaryParams {
    state?: SaleState | string;
    sort?: SaleSort | string;
    order?: OrderParam;
    [key: string]: any;
}

export interface BuyofferApiParams extends ListingFilterParams, AssetFilterParams, PrimaryBoundaryParams, DateBoundaryParams {
    state?: BuyofferState | string;
    sort?: BuyofferSort | string;
    order?: OrderParam;
    [key: string]: any;
}

// The atomicassets package pins OfferApiParams.state to the OfferState enum;
// widened here to admit comma-joined multi-state filters, matching how the
// sale, auction, and buyoffer params above widen their `state`. It also
// carries the same `[key: string]: any` index signature as those three, so
// getOffers and countOffers share one filter surface.
export type MarketOfferApiParams = Omit<OfferApiParams, 'state'> & { state?: OfferState | string, [key: string]: any };

// Filters for the settled royalty payout ledger. recipient, collection_name,
// asset_id, symbol, and category each take one value or several joined with
// commas, as the sibling list filters do. The primary boundary (ids,
// lower_bound, upper_bound) ranges over log_global_sequence, the payout
// ledger's primary column.
export interface RoyaltyPayoutApiParams extends PrimaryBoundaryParams, DateBoundaryParams {
    recipient?: string;
    collection_name?: string;
    asset_id?: string;
    symbol?: string;
    listing_type?: RoyaltyListingType | string;
    listing_id?: string;
    category?: RoyaltyPayoutCategory | string;
    sort?: RoyaltyPayoutSort | string;
    order?: OrderParam;
    [key: string]: any;
}

// Filters for the per-account totals. The route groups the payouts by token
// symbol, so it has no primary column left to bound and takes the date window
// alone.
export interface RoyaltyAccountApiParams extends DateBoundaryParams {
    collection_name?: string;
    symbol?: string;
    [key: string]: any;
}
