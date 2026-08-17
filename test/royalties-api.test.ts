import { expect } from 'chai';

import { OrderParam } from '@atomichub/atomicassets';

import { ApiError, AtomicMarketApi, IRoyaltyAccountTotal, IRoyaltyConfig, IRoyaltyPayout, RoyaltyListingType, RoyaltyPayoutCategory, RoyaltyPayoutSort } from '../src';

type FetchCall = { url: string };

function mockApi(handler: (url: string) => {status: number, body: any}, calls: FetchCall[]): AtomicMarketApi {
    const fetchMock = async (input: any): Promise<any> => {
        const url = String(input);

        calls.push({url});

        const {status, body} = handler(url);

        return {status, json: async () => body};
    };

    return new AtomicMarketApi('https://test.api', 'atomicmarket', {fetch: fetchMock as any});
}

describe('AtomicMarketApi royalty read endpoints', () => {
    const config: IRoyaltyConfig = {
        market_contract: 'atomicmarket',
        collection_name: 'mycollection',
        founders: [{recipient: 'alice', weight: 5000}],
        attribute_mode: 1,
        split_founders: '5000',
        split_templates: '3000',
        split_attributes: '2000',
        updated_at_block: '221419712',
        updated_at_time: '1750000000000',
        created_at_block: '221419700',
        created_at_time: '1749999000000'
    };

    it('getRoyaltyConfig fetches /v1/royalties/{collection} and returns the config', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(() => ({status: 200, body: {success: true, data: config}}), calls);

        const result = await api.getRoyaltyConfig('mycollection');

        expect(result).to.deep.equal(config);
        expect(calls[0].url).to.equal('https://test.api/atomicmarket/v1/royalties/mycollection');
    });

    it('getRoyaltyConfig maps the 416 "no config" response to null', async () => {
        const api = mockApi(() => ({status: 416, body: {success: false, message: 'no royalty config'}}), []);

        expect(await api.getRoyaltyConfig('mycollection')).to.equal(null);
    });

    it('getRoyaltyConfig rethrows non-416 errors', async () => {
        const api = mockApi(() => ({status: 500, body: {success: false, message: 'boom'}}), []);

        try {
            await api.getRoyaltyConfig('mycollection');
            expect.fail('expected ApiError');
        } catch (error) {
            expect(error).to.be.instanceOf(ApiError);
            expect((error as ApiError).status).to.equal(500);
        }
    });

    it('getRoyaltyTemplateRules and getRoyaltyAttributeRules hit the paged rule endpoints', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(() => ({status: 200, body: {success: true, data: []}}), calls);

        expect(await api.getRoyaltyTemplateRules('mycollection', 2, 50)).to.deep.equal([]);
        expect(await api.getRoyaltyAttributeRules('mycollection')).to.deep.equal([]);

        expect(calls[0].url).to.equal('https://test.api/atomicmarket/v1/royalties/mycollection/templates?page=2&limit=50');
        expect(calls[1].url).to.equal('https://test.api/atomicmarket/v1/royalties/mycollection/attributes?page=1&limit=100');
    });

    it('percent-encodes a hostile collection without swallowing the /templates suffix', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(() => ({status: 200, body: {success: true, data: []}}), calls);

        await api.getRoyaltyTemplateRules('1/2 ?&#x', 2, 50);

        expect(calls[0].url).to.equal('https://test.api/atomicmarket/v1/royalties/1%2F2%20%3F%26%23x/templates?page=2&limit=50');
    });

    // A payout row as the WAX testnet indexer serves it: hex txid, decimal
    // string amount, and the template linkage set while rule_id stays null.
    const payout: IRoyaltyPayout = {
        market_contract: 'atomicmarket',
        log_global_sequence: '4126381854',
        payout_index: 1,
        listing_type: RoyaltyListingType.Sale,
        listing_id: '2199023255614',
        category: RoyaltyPayoutCategory.Template,
        collection_name: 'royaltycol11',
        asset_id: '1099512960221',
        template_id: '703531',
        rule_id: null,
        recipient: 'jacktestr125',
        amount: '5000000',
        token_symbol: 'WAX',
        token_precision: 8,
        token_contract: 'eosio.token',
        txid: 'a5f2ab8f2a0f6d3e4f1c8b7d9e0a1b2c3d4e5f60718293a4b5c6d7e8f9012345',
        created_at_block: '221419712',
        created_at_time: '1750000000000'
    };

    const accountTotal: IRoyaltyAccountTotal = {
        token_symbol: 'WAX',
        token_precision: 8,
        token_contract: 'eosio.token',
        amount: '150000000',
        payout_count: '3'
    };

    it('getRoyaltyPayouts pages the ledger and carries the filters into the query', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(() => ({status: 200, body: {success: true, data: [payout]}}), calls);

        const rows = await api.getRoyaltyPayouts({
            recipient: 'jacktestr125',
            collection_name: 'royaltycol11',
            category: RoyaltyPayoutCategory.Template,
            listing_type: RoyaltyListingType.Sale,
            sort: RoyaltyPayoutSort.Amount,
            order: OrderParam.Asc
        }, 2, 50);

        expect(rows).to.deep.equal([payout]);
        expect(calls[0].url).to.equal(
            'https://test.api/atomicmarket/v1/royalties/payouts' +
            '?page=2&limit=50&recipient=jacktestr125&collection_name=royaltycol11' +
            '&category=template&listing_type=sale&sort=amount&order=asc'
        );
    });

    it('countRoyaltyPayouts reads the count route and parses the decimal string', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(() => ({status: 200, body: {success: true, data: '20'}}), calls);

        expect(await api.countRoyaltyPayouts({collection_name: 'royaltycol11'})).to.equal(20);

        expect(calls[0].url).to.equal('https://test.api/atomicmarket/v1/royalties/payouts/_count?collection_name=royaltycol11');
    });

    it('getRoyaltyAccount returns the per-token totals for one recipient', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(() => ({status: 200, body: {success: true, data: [accountTotal]}}), calls);

        expect(await api.getRoyaltyAccount('jacktestr125', {collection_name: 'royaltycol11'})).to.deep.equal([accountTotal]);

        expect(calls[0].url).to.equal('https://test.api/atomicmarket/v1/royalties/accounts/jacktestr125?collection_name=royaltycol11');
    });

    it('percent-encodes a hostile account name in the path', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(() => ({status: 200, body: {success: true, data: []}}), calls);

        await api.getRoyaltyAccount('1/2 ?&#x');

        expect(calls[0].url).to.equal('https://test.api/atomicmarket/v1/royalties/accounts/1%2F2%20%3F%26%23x');
    });
});
