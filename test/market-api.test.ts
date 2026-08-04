import { expect } from 'chai';

import { ApiError, AtomicMarketApi, MarketOfferApiParams } from '../src';

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

describe('AtomicMarketApi offers count and v2 sales endpoints', () => {
    it('countOffers counts /v1/offers with the given filters, comma-joined multi-state included', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(() => ({status: 200, body: {success: true, data: '17'}}), calls);

        // Typed as MarketOfferApiParams to prove the widened type admits a
        // comma-joined state string at compile time.
        const options: MarketOfferApiParams = {sender: 'alice', state: '0,3'};

        expect(await api.countOffers(options)).to.equal(17);
        expect(calls[0].url).to.equal('https://test.api/atomicmarket/v1/offers/_count?sender=alice&state=0%2C3');
    });

    it('getSalesV2 pages /v2/sales with page, limit and the built data options', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(() => ({status: 200, body: {success: true, data: []}}), calls);

        expect(await api.getSalesV2({seller: 'alice'}, 2, 50, [{key: 'rarity', value: 'rare'}])).to.deep.equal([]);
        expect(await api.getSalesV2()).to.deep.equal([]);

        expect(calls[0].url).to.equal('https://test.api/atomicmarket/v2/sales?page=2&limit=50&seller=alice&data.rarity=rare');
        expect(calls[1].url).to.equal('https://test.api/atomicmarket/v2/sales?page=1&limit=100');
    });

    it('countSalesV2 counts /v2/sales and returns the parsed integer', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(() => ({status: 200, body: {success: true, data: '3'}}), calls);

        expect(await api.countSalesV2({seller: 'alice', state: '1'})).to.equal(3);
        expect(calls[0].url).to.equal('https://test.api/atomicmarket/v2/sales/_count?seller=alice&state=1');
    });

    it('a success: false envelope makes the new methods throw ApiError', async () => {
        const api = mockApi(() => ({status: 200, body: {success: false, message: 'boom'}}), []);

        try {
            await api.countSalesV2({seller: 'alice'});
            expect.fail('expected ApiError');
        } catch (error) {
            expect(error).to.be.instanceOf(ApiError);
            expect((error as ApiError).message).to.equal('boom');
        }
    });
});

describe('AtomicMarketApi URL encoding of caller-supplied input', () => {
    // An id carrying '/' walks the request to a different route, and one
    // carrying '?' or '#' grafts a query string or fragment onto it.
    const hostileId = '1/2 ?&#x';
    const encodedId = '1%2F2%20%3F%26%23x';

    it('percent-encodes a hostile id so it stays one path segment', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(() => ({status: 200, body: {success: true, data: {}}}), calls);

        await api.getSale(hostileId);
        await api.getSaleLogs(hostileId);

        expect(calls[0].url).to.equal('https://test.api/atomicmarket/v1/sales/' + encodedId);
        expect(calls[1].url).to.equal('https://test.api/atomicmarket/v1/sales/' + encodedId + '/logs?page=1&limit=100&order=desc');
    });

    it('percent-encodes custom data-filter keys, not only their values', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(() => ({status: 200, body: {success: true, data: []}}), calls);

        // A DataOptions row.key reaches the query key side, where a bare '&'
        // or '=' would split into filters the caller never asked for. The
        // numeric row also covers the ':' the type prefix adds.
        await api.getSalesV2({}, 1, 100, [{key: 'a&b=c', value: 'rare'}, {key: 'x&y', value: 5}]);

        expect(calls[0].url).to.equal(
            'https://test.api/atomicmarket/v2/sales?page=1&limit=100&data.a%26b%3Dc=rare&data%3Anumber.x%26y=5'
        );
    });
});
