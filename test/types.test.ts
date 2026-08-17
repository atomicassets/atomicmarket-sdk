import { expect } from 'chai';

import { AuctionState, BuyofferState, IAuction, IBuyoffer, IRoyaltyAccountTotal, IRoyaltyAttributeRule, IRoyaltyConfig, IRoyaltyPayout, IRoyaltyTemplateRule, ISale, RoyaltyListingType, RoyaltyPayoutCategory, RoyaltyPayoutSort, SaleState, TemplateBuyofferState } from '../src';

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

describe('royalty read-layer types', () => {
    // The indexer stores each of these as a number and translates on the way
    // out, so the names below are the whole vocabulary a filter may use. They
    // pin the LISTING_TYPE_BY_NAME and PAYOUT_CATEGORY_BY_NAME maps and the
    // sort allowedValues in atomicassets-api
    // src/api/namespaces/atomicmarket/handlers/royalties.ts.
    it('pins the payout enums to the strings the indexer serves and filters on', () => {
        expect(namedMembers(RoyaltyListingType)).to.deep.equal({
            Unresolved: 'unresolved',
            Sale: 'sale',
            Auction: 'auction',
            Buyoffer: 'buyoffer',
            TemplateBuyoffer: 'template_buyoffer'
        });

        expect(namedMembers(RoyaltyPayoutCategory)).to.deep.equal({
            Founders: 'founders', Template: 'template', Attribute: 'attribute', Dust: 'dust'
        });

        expect(namedMembers(RoyaltyPayoutSort)).to.deep.equal({Created: 'created', Amount: 'amount'});
    });

    it('type-checks the payout, account total, config and rule rows against indexer shapes', () => {
        const attributePayout: IRoyaltyPayout = {
            market_contract: 'atomicmarket',
            log_global_sequence: '4126381854',
            payout_index: 2,
            listing_type: RoyaltyListingType.Auction,
            listing_id: '2199023255700',
            category: RoyaltyPayoutCategory.Attribute,
            collection_name: 'royaltycol11',
            asset_id: '1099512960221',
            template_id: null,
            rule_id: '3',
            recipient: 'jacktestr125',
            amount: '2500000',
            token_symbol: 'WAX',
            token_precision: 8,
            token_contract: 'eosio.token',
            txid: 'b1c2d3e4f5061728394a5b6c7d8e9f00112233445566778899aabbccddeeff01',
            created_at_block: '221419712',
            created_at_time: '1750000000000'
        };

        // A dust payout of an unresolved settlement: no listing, no asset, no
        // template, no rule, and the collection author as the recipient.
        const dustPayout: IRoyaltyPayout = {
            ...attributePayout,
            payout_index: 0,
            listing_type: RoyaltyListingType.Unresolved,
            listing_id: null,
            category: RoyaltyPayoutCategory.Dust,
            asset_id: null,
            rule_id: null,
            recipient: 'royaltyauth1',
            amount: '3'
        };

        // A row whose stored value falls outside the vocabulary this SDK
        // serves: the indexer keeps it rather than drop it.
        const unmappedPayout: IRoyaltyPayout = {
            ...attributePayout,
            payout_index: 1,
            listing_type: null,
            category: null
        };

        const accountTotal: IRoyaltyAccountTotal = {
            token_symbol: 'WAX',
            token_precision: 8,
            token_contract: 'eosio.token',
            amount: '150000000',
            payout_count: '3'
        };

        const config: IRoyaltyConfig = {
            market_contract: 'atomicmarket',
            collection_name: 'royaltycol11',
            founders: [{recipient: 'jacktestr125', weight: 1}],
            attribute_mode: 1,
            split_founders: '5000',
            split_templates: '2500',
            split_attributes: '2500',
            updated_at_block: '221419712',
            updated_at_time: '1750000000000',
            created_at_block: '221419700',
            created_at_time: '1749999000000'
        };

        const templateRule: IRoyaltyTemplateRule = {
            market_contract: 'atomicmarket',
            collection_name: 'royaltycol11',
            template_id: '703531',
            recipients: [{recipient: 'jacktestr125', weight: 1}],
            updated_at_block: '221419712',
            updated_at_time: '1750000000000',
            created_at_block: '221419700',
            created_at_time: '1749999000000'
        };

        const attributeRule: IRoyaltyAttributeRule = {
            market_contract: 'atomicmarket',
            collection_name: 'royaltycol11',
            rule_id: '3',
            source: 0,
            field: 'rarity',
            value: ['string', 'legendary'],
            weight: '1',
            recipients: [{recipient: 'jacktestr125', weight: 1}],
            lookup_hash: '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b',
            updated_at_block: '221419712',
            updated_at_time: '1750000000000',
            created_at_block: '221419700',
            created_at_time: '1749999000000'
        };

        expect(attributePayout.template_id).to.equal(null);
        expect(attributePayout.rule_id).to.equal('3');
        expect(dustPayout.listing_id).to.equal(null);
        expect(dustPayout.asset_id).to.equal(null);
        expect(unmappedPayout.listing_type).to.equal(null);
        expect(unmappedPayout.category).to.equal(null);
        expect(accountTotal.payout_count).to.equal('3');
        expect(config.market_contract).to.equal('atomicmarket');
        expect(templateRule.created_at_time).to.equal('1749999000000');
        expect(attributeRule.lookup_hash).to.have.lengthOf(64);
    });
});
