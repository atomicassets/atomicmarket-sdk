import { expect } from 'chai';

import { ApiError, AtomicMarketApi } from '../src';

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

function guardMessage(value: string): string {
    return `${JSON.stringify(value)} is not an id: it is empty or a dot segment, so it would rewrite the request path`;
}

// One entry per method that puts a caller-supplied value in a path segment,
// each called with the one argument that lands there. This list is
// hand-maintained, not derived from the class: a method added later needs
// its own entry here, or its guard goes untested by this sweep.
const pathMethods: Array<{name: string, call: (api: AtomicMarketApi, value: string) => Promise<unknown>}> = [
    {name: 'getSale', call: (api, value) => api.getSale(value)},
    {name: 'getSaleLogs', call: (api, value) => api.getSaleLogs(value)},
    {name: 'getAuction', call: (api, value) => api.getAuction(value)},
    {name: 'getAuctionLogs', call: (api, value) => api.getAuctionLogs(value)},
    {name: 'getBuyoffer', call: (api, value) => api.getBuyoffer(value)},
    {name: 'getBuyofferLogs', call: (api, value) => api.getBuyofferLogs(value)},
    {name: 'getMarketplace', call: (api, value) => api.getMarketplace(value)},
    {name: 'getRoyaltyConfig', call: (api, value) => api.getRoyaltyConfig(value)},
    {name: 'getRoyaltyTemplateRules', call: (api, value) => api.getRoyaltyTemplateRules(value)},
    {name: 'getRoyaltyAttributeRules', call: (api, value) => api.getRoyaltyAttributeRules(value)},
    {name: 'getRoyaltyAccount', call: (api, value) => api.getRoyaltyAccount(value)},
    {name: 'getAsset', call: (api, value) => api.getAsset(value)},
    {name: 'getOffer', call: (api, value) => api.getOffer(value)}
];

async function expectGuard(promise: Promise<unknown>, value: string, label: string, expectedField?: string): Promise<void> {
    let caught: unknown = null;
    let resolved = false;

    // The assertions sit outside the catch so that a method which resolves
    // reports itself, rather than the catch reading its own failure back.
    try {
        await promise;
        resolved = true;
    } catch (error) {
        caught = error;
    }

    expect(resolved, `${label} accepted ${JSON.stringify(value)} instead of throwing`).to.equal(false);
    expect(caught).to.be.instanceOf(Error);
    // Not an ApiError: the guard fires while the path is assembled, which is
    // before any response exists to carry a status.
    expect(caught).to.not.be.instanceOf(ApiError);
    expect((caught as Error).message).to.include(guardMessage(value));

    if (expectedField !== undefined) {
        expect((caught as Error).message).to.include(expectedField);
    }
}

describe('AtomicMarketApi path segment guard', () => {
    for (const value of ['.', '..', '']) {
        it(`rejects ${JSON.stringify(value)} as a sale id without reaching the network`, async () => {
            const calls: FetchCall[] = [];
            const api = mockApi(() => ({status: 200, body: {success: true, data: {}}}), calls);

            await expectGuard(api.getSale(value), value, 'getSale', 'sale id');

            expect(calls).to.have.length(0);
        });
    }

    it('rejects a missing sale id without reaching the network', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(() => ({status: 200, body: {success: true, data: {}}}), calls);

        for (const value of [undefined, null]) {
            let caught: unknown;
            try {
                await api.getSale(value as unknown as string);
            } catch (error) {
                caught = error;
            }
            expect(caught).to.be.instanceOf(Error);
            expect((caught as Error).message).to.equal('sale id is required');
        }

        expect(calls).to.have.length(0);
    });

    it('rejects a dot-dot segment on every path-building method before it fetches', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(() => ({status: 200, body: {success: true, data: []}}), calls);

        expect(pathMethods).to.have.length(13);

        for (const {name, call} of pathMethods) {
            await expectGuard(call(api, '..'), '..', name);
        }

        expect(calls).to.have.length(0);
    });

    it('still lets a dotted Antelope name reach a real path segment unchanged', async () => {
        const calls: FetchCall[] = [];
        const api = mockApi(() => ({status: 200, body: {success: true, data: {}}}), calls);

        await api.getMarketplace('alice.gg');
        await api.getRoyaltyAccount('mycoll.wam');

        expect(calls.map((call) => call.url)).to.deep.equal([
            'https://test.api/atomicmarket/v1/marketplaces/alice.gg',
            'https://test.api/atomicmarket/v1/royalties/accounts/mycoll.wam'
        ]);
    });
});
