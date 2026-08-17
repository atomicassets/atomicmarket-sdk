import { AssetsApiParams, ILog, TransferApiParams } from '@atomichub/atomicassets';

import ApiError from '../../Errors/ApiError';
import { AuctionApiParams, BaseAssetFilterParams, BuyofferApiParams, MarketOfferApiParams, RoyaltyAccountApiParams, RoyaltyPayoutApiParams, SaleApiParams } from './Params';
import { IAuction, IBuyoffer, IMarketAsset, IMarketConfig, IMarketOffer, IMarketplace, IMarketToken, IMarketTransfer, IPriceStats, IRoyaltyAccountTotal, IRoyaltyAttributeRule, IRoyaltyConfig, IRoyaltyPayout, IRoyaltyTemplateRule, ISale } from './Objects';

type Fetch = typeof fetch;
type ApiArgs = { fetch?: Fetch };

export type DataOptions = Array<{key: string, value: any, type?: string}>;

// Asset ids, listing ids, collection names, marketplace names and account
// names reach the path straight from the caller. Left raw, a value carrying
// `/`, `?` or `#` escapes its own segment and rewrites the request target, so
// every one is encoded where the path is assembled.
//
// Encoding alone does not cover a dot segment. `encodeURIComponent` leaves `.`
// untouched, and the URL parser inside fetch then resolves the segment away
// before the request goes out: `/v1/royalties/..` leaves as `/v1/royalties`,
// and an empty id leaves `/v1/sales/` as the sale list. Both reach a real
// route on the same origin, so the caller reads rows it never asked for
// instead of seeing a failure. Neither value is ever an id, a name or an
// account, so both are refused here rather than encoded into a request that
// quietly reads elsewhere.
//
// A value that equals a sibling route literal such as "_count" or "payouts" is
// a valid segment and passes: that request lands on the neighbouring route,
// which is the caller's error, not a rewrite this helper can detect.
function encodeSegment(value: string, field: string): string {
    // A missing value would travel as the literal segment "undefined" or "null"
    // and read as an API fault instead of the caller's mistake.
    if (value === null || value === undefined) {
        throw new Error(`${field} is required`);
    }

    const segment = String(value);

    if (segment === '' || segment === '.' || segment === '..') {
        throw new Error(`${field} ${JSON.stringify(segment)} is not an id: it is empty or a dot segment, so it would rewrite the request path`);
    }

    return encodeURIComponent(segment);
}

function buildDataOptions(options: {[key: string]: any}, data: DataOptions): {[key: string]: any} {
    const dataFields: {[key: string]: string} = {};

    for (const row of data) {
        const dataType = row.type ?? 'data';

        if (typeof row.value === 'number') {
            dataFields[dataType + ':number.' + row.key] = String(row.value);
        } else if (typeof row.value === 'boolean') {
            dataFields[dataType + ':bool.' + row.key] = row.value ? 'true' : 'false';
        } else {
            dataFields[dataType + '.' + row.key] = row.value;
        }
    }

    return Object.assign({}, options, dataFields);
}

export default class AtomicMarketApi {
    private readonly endpoint: string;
    private readonly namespace: string;

    private readonly fetchBuiltin: Fetch;

    constructor(endpoint: string, namespace: string, args: ApiArgs) {
        this.endpoint = endpoint;
        this.namespace = namespace;

        this.fetchBuiltin = args.fetch ?? fetch;
    }

    async getSales(options: SaleApiParams = {}, page: number = 1, limit: number = 100, data: DataOptions = []): Promise<ISale[]> {
        return await this.fetchEndpoint('/v1/sales', {page, limit, ...buildDataOptions(options, data)});
    }

    async countSales(options: SaleApiParams, data: DataOptions = []): Promise<number> {
        return await this.countEndpoint('/v1/sales', buildDataOptions(options, data));
    }

    async getSale(id: string): Promise<ISale> {
        return await this.fetchEndpoint('/v1/sales/' + encodeSegment(id, 'sale id'), {});
    }

    async getSaleLogs(id: string, page: number = 1, limit: number = 100, order: string = 'desc'): Promise<ILog[]> {
        return await this.fetchEndpoint('/v1/sales/' + encodeSegment(id, 'sale id') + '/logs', {page, limit, order});
    }

    // The /v2/sales route is the API's newer materialized sales index. Its row
    // shape is identical to /v1/sales, so both return ISale rows.
    async getSalesV2(options: SaleApiParams = {}, page: number = 1, limit: number = 100, data: DataOptions = []): Promise<ISale[]> {
        return await this.fetchEndpoint('/v2/sales', {page, limit, ...buildDataOptions(options, data)});
    }

    async countSalesV2(options: SaleApiParams, data: DataOptions = []): Promise<number> {
        return await this.countEndpoint('/v2/sales', buildDataOptions(options, data));
    }

    async getAuctions(options: AuctionApiParams = {}, page: number = 1, limit: number = 100, data: DataOptions = []): Promise<IAuction[]> {
        return await this.fetchEndpoint('/v1/auctions', {page, limit, ...buildDataOptions(options, data)});
    }

    async countAuctions(options: AuctionApiParams, data: DataOptions = []): Promise<number> {
        return await this.countEndpoint('/v1/auctions', buildDataOptions(options, data));
    }

    async getAuction(id: string): Promise<IAuction> {
        return await this.fetchEndpoint('/v1/auctions/' + encodeSegment(id, 'auction id'), {});
    }

    async getAuctionLogs(id: string, page: number = 1, limit: number = 100, order: string = 'desc'): Promise<ILog[]> {
        return await this.fetchEndpoint('/v1/auctions/' + encodeSegment(id, 'auction id') + '/logs', {page, limit, order});
    }

    async getBuyoffers(options: BuyofferApiParams = {}, page: number = 1, limit: number = 100, data: DataOptions = []): Promise<IBuyoffer[]> {
        return await this.fetchEndpoint('/v1/buyoffers', {page, limit, ...buildDataOptions(options, data)});
    }

    async countBuyoffers(options: BuyofferApiParams, data: DataOptions = []): Promise<number> {
        return await this.countEndpoint('/v1/buyoffers', buildDataOptions(options, data));
    }

    async getBuyoffer(id: string): Promise<IBuyoffer> {
        return await this.fetchEndpoint('/v1/buyoffers/' + encodeSegment(id, 'buyoffer id'), {});
    }

    async getBuyofferLogs(id: string, page: number = 1, limit: number = 100, order: string = 'desc'): Promise<ILog[]> {
        return await this.fetchEndpoint('/v1/buyoffers/' + encodeSegment(id, 'buyoffer id') + '/logs', {page, limit, order});
    }

    async getMarketplaces(): Promise<IMarketplace[]> {
        return await this.fetchEndpoint('/v1/marketplaces', {});
    }

    async getMarketplace(name: string): Promise<IMarketplace> {
        return await this.fetchEndpoint('/v1/marketplaces/' + encodeSegment(name, 'marketplace name'), {});
    }

    async getConfig(): Promise<IMarketConfig> {
        return await this.fetchEndpoint('/v1/config', {});
    }

    /* ROYALTY API (AtomicMarket v2 read layer) */

    // The API responds 416 for a collection with no royalty config — that is
    // the normal "no config" case, mapped to null here, never an error.
    async getRoyaltyConfig(collection: string): Promise<IRoyaltyConfig | null> {
        try {
            return await this.fetchEndpoint('/v1/royalties/' + encodeSegment(collection, 'collection name'), {});
        } catch (error) {
            if (error instanceof ApiError && error.status === 416) {
                return null;
            }

            throw error;
        }
    }

    async getRoyaltyTemplateRules(collection: string, page: number = 1, limit: number = 100): Promise<IRoyaltyTemplateRule[]> {
        return await this.fetchEndpoint('/v1/royalties/' + encodeSegment(collection, 'collection name') + '/templates', {page, limit});
    }

    async getRoyaltyAttributeRules(collection: string, page: number = 1, limit: number = 100): Promise<IRoyaltyAttributeRule[]> {
        return await this.fetchEndpoint('/v1/royalties/' + encodeSegment(collection, 'collection name') + '/attributes', {page, limit});
    }

    // The settled payout ledger, newest first, one row for each entry in a
    // settlement log's payout vector. A chain still running AtomicMarket v1 logs no payouts, so
    // there the route answers an empty array rather than an error. An indexer
    // built before the royalty routes answers 404, which arrives as an
    // ApiError and is a different case from the 416 above.
    async getRoyaltyPayouts(options: RoyaltyPayoutApiParams = {}, page: number = 1, limit: number = 100): Promise<IRoyaltyPayout[]> {
        return await this.fetchEndpoint('/v1/royalties/payouts', {page, limit, ...options});
    }

    async countRoyaltyPayouts(options: RoyaltyPayoutApiParams = {}): Promise<number> {
        return await this.countEndpoint('/v1/royalties/payouts', options);
    }

    // What one account has been paid, one row per token symbol. An account
    // paid in two tokens returns two rows, and one never paid returns none.
    async getRoyaltyAccount(account: string, options: RoyaltyAccountApiParams = {}): Promise<IRoyaltyAccountTotal[]> {
        return await this.fetchEndpoint('/v1/royalties/accounts/' + encodeSegment(account, 'account'), options);
    }

    /* PRICE API */
    async getPriceHistory(
        options: BaseAssetFilterParams & {symbol?: string} = {}
    ): Promise<Array<IMarketToken & {sale_id?: string, auction_id?: string, buyoffer_id?: string, template_mint: string, price: string, block_time: string}>> {
        return await this.fetchEndpoint('/v1/prices/sales', options);
    }

    async getPriceHistoryByDays(
        options: BaseAssetFilterParams & {symbol?: string} = {}
    ): Promise<Array<IMarketToken & {average: string, median: string, time: string}>> {
        return await this.fetchEndpoint('/v1/prices/sales/days', options);
    }

    async getTemplatePriceStats(
        options: BaseAssetFilterParams & {symbol?: string} = {}
    ): Promise<Array<IMarketToken & IPriceStats & {collection_name: string, template_id: string}>> {
        return await this.fetchEndpoint('/v1/prices/templates', options);
    }

    async getAssetPrices(
        options: AssetsApiParams, data: DataOptions = []
    ): Promise<Array<IMarketToken & IPriceStats>> {
        return await this.fetchEndpoint('/v1/prices/assets', {...buildDataOptions(options, data)});
    }

    /* WRAPPED AtomicAssets APIs */
    async getAssets(options: AssetsApiParams = {}, page: number = 1, limit: number = 100, data: DataOptions = []): Promise<IMarketAsset[]> {
        return await this.fetchEndpoint('/v1/assets', {page, limit, ...buildDataOptions(options, data)});
    }

    async getAsset(id: string): Promise<IMarketAsset> {
        return await this.fetchEndpoint('/v1/assets/' + encodeSegment(id, 'asset id'), {});
    }

    async getTransfers(options: TransferApiParams = {}, page: number = 1, limit: number = 100): Promise<IMarketTransfer[]> {
        return await this.fetchEndpoint('/v1/transfers', {page, limit, ...options});
    }

    async getOffers(options: MarketOfferApiParams = {}, page: number = 1, limit: number = 100): Promise<IMarketOffer[]> {
        return await this.fetchEndpoint('/v1/offers', {page, limit, ...options});
    }

    async countOffers(options: MarketOfferApiParams): Promise<number> {
        return await this.countEndpoint('/v1/offers', options);
    }

    async getOffer(id: string): Promise<IMarketOffer> {
        return await this.fetchEndpoint('/v1/offers/' + encodeSegment(id, 'offer id'), {});
    }

    // path is literals plus encodeSegment output; this method validates nothing.
    async fetchEndpoint<T>(path: string, args: any): Promise<T> {
        let response, json;

        const f = this.fetchBuiltin;
        const queryString = Object.keys(args).map((key) => {
            let value = args[key];

            if (value === true) {
                value = 'true';
            }

            if (value === false) {
                value = 'false';
            }

            return encodeURIComponent(key) + '=' + encodeURIComponent(value);
        }).join('&');

        try {
            response = await f(this.endpoint + '/' + this.namespace + path + (queryString.length > 0 ? '?' + queryString : ''));

            json = await response.json();
        } catch (e) {
            throw new ApiError((e as Error).message, 500);
        }

        if (response.status !== 200) {
            throw new ApiError(json.message, response.status);
        }

        if (!json.success) {
            throw new ApiError(json.message, response.status);
        }

        return json.data;
    }

    async countEndpoint(path: string, args: any): Promise<number> {
        const res = await this.fetchEndpoint<string>(path + '/_count', args);

        return parseInt(res, 10);
    }
}
