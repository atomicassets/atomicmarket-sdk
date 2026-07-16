import { expect } from 'chai';

import { IAuction, IBuyoffer, ISale } from '../src';

describe('v2 current_collection_fee type field', () => {
    it('ISale/IAuction/IBuyoffer type-check without current_collection_fee and read undefined', () => {
        const sale = {} as ISale;
        const auction = {} as IAuction;
        const buyoffer = {} as IBuyoffer;

        expect(sale.current_collection_fee).to.equal(undefined);
        expect(auction.current_collection_fee).to.equal(undefined);
        expect(buyoffer.current_collection_fee).to.equal(undefined);
    });

    it('ISale/IAuction/IBuyoffer type-check with current_collection_fee and read the number', () => {
        const sale = {current_collection_fee: 500} as Partial<ISale>;
        const auction = {current_collection_fee: 500} as Partial<IAuction>;
        const buyoffer = {current_collection_fee: 500} as Partial<IBuyoffer>;

        expect(sale.current_collection_fee).to.equal(500);
        expect(auction.current_collection_fee).to.equal(500);
        expect(buyoffer.current_collection_fee).to.equal(500);
    });
});
