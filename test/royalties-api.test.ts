import { expect } from 'chai';

import { ApiError, AtomicMarketApi, IRoyaltyConfig } from '../src';

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
        founders: [{recipient: 'alice', weight: 5000}],
        attribute_mode: 1,
        split_founders: '5000',
        split_templates: '3000',
        split_attributes: '2000'
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
});
