import { AssetFilterParams, DateBoundaryParams, OrderParam, PrimaryBoundaryParams } from '@atomichub/atomicassets';

import { AuctionSort, AuctionState, BuyofferSort, BuyofferState, SaleSort, SaleState } from './Enums';

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
