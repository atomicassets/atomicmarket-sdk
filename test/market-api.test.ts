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
