import { expect } from 'chai';

import { AuctionState, BuyofferState, IAuction, IBuyoffer, ISale, SaleState, TemplateBuyofferState } from '../src';

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

// The indexer numbers each listing type's states independently, so a value only
// means something alongside the listing type it came from. These pin the SDK to
// what atomicassets-api reports, per the *ApiState enums and state filters in
// that repository's src/api/namespaces/atomicmarket/ (index.ts and utils.ts).
// A TypeScript enum carries reverse mappings too, so compare the named members
// alone. deep.include would pass while an extra member sat alongside them, and
// catching exactly that is why these exist.
function namedMembers(enumObject: object): Record<string, number> {
    return Object.fromEntries(
        Object.entries(enumObject).filter(([key]) => Number.isNaN(Number(key)))
    ) as Record<string, number>;
}

describe('listing state enums', () => {
    it('numbers sale and auction states identically, including the derived tail', () => {
        const expected = {Waiting: 0, Listed: 1, Canceled: 2, Sold: 3, Invalid: 4};

        expect(namedMembers(SaleState)).to.deep.equal(expected);
        expect(namedMembers(AuctionState)).to.deep.equal(expected);
    });

    it('numbers buyoffer states on the offer lifecycle, not the sale lifecycle', () => {
        expect(namedMembers(BuyofferState)).to.deep.equal({
            Pending: 0, Declined: 1, Canceled: 2, Accepted: 3, Invalid: 4
        });
    });

    it('numbers template buyoffer states one below the other listing types', () => {
        expect(namedMembers(TemplateBuyofferState)).to.deep.equal({Listed: 0, Canceled: 1, Sold: 2});
    });

    it('carries no sale vocabulary on the buyoffer enums', () => {
        // The defect this replaced: buyoffer states named Listed and Sold, which
        // read plausibly and selected the wrong rows.
        expect(namedMembers(BuyofferState)).to.not.have.any.keys('Listed', 'Sold', 'Waiting');
        expect(namedMembers(TemplateBuyofferState)).to.not.have.any.keys('Pending', 'Declined', 'Accepted');
    });

    it('disagrees between listing types at the same numeric value', () => {
        expect(SaleState.Listed).to.equal(1);
        expect(BuyofferState.Declined).to.equal(1);
        expect(TemplateBuyofferState.Canceled).to.equal(1);

        expect(SaleState.Canceled).to.equal(2);
        expect(TemplateBuyofferState.Sold).to.equal(2);
    });
});
