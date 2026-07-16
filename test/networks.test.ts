import { expect } from 'chai';

import { AtomicMarketApi, NETWORK_ENDPOINTS, marketApiForNetwork } from '../src';

describe('Network endpoint presets', () => {
    it('marketApiForNetwork wires the client to the network api endpoint', () => {
        const api = marketApiForNetwork('wax');

        expect(api).to.be.instanceOf(AtomicMarketApi);
        expect((api as any).endpoint).to.equal(NETWORK_ENDPOINTS['wax'].api);
        expect((api as any).endpoint).to.equal('https://wax.api.atomicassets.io');
        expect((api as any).namespace).to.equal('atomicmarket');
    });
});
