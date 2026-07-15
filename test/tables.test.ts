import { expect } from 'chai';

import {
    IRoyaltyAttributeRow, IRoyaltyConfigRow, IRoyaltyTemplateRow, ITemplateBuyofferRow
} from '../src';

// Compile-checks: literals matching the ABI struct shapes (uint64/name/asset
// as strings, int32/uint32/uint8/float64 as numbers) must satisfy the row
// types; the runtime assertions just pin a representative field per row.
describe('contract table row types', () => {
    it('IRoyaltyConfigRow matches royaltyconf_s', () => {
        const row: IRoyaltyConfigRow = {
            collection: 'mycollection',
            founders: [{recipient: 'alice', weight: 5000}],
            attribute_mode: 1,
            split_founders: 5000,
            split_templates: 3000,
            split_attributes: 2000
        };

        expect(row.split_founders).to.equal(5000);
    });

    it('IRoyaltyTemplateRow matches royaltytemp_s', () => {
        const row: IRoyaltyTemplateRow = {
            template_id: 42,
            recipients: [{recipient: 'alice', weight: 10000}]
        };

        expect(row.template_id).to.equal(42);
    });

    it('IRoyaltyAttributeRow matches royaltyattr_s with a string uint64 index', () => {
        const row: IRoyaltyAttributeRow = {
            index: '18446744073709551615',
            source: 1,
            field: 'level',
            value: ['uint64', '100'],
            weight: 10000,
            recipients: [{recipient: 'alice', weight: 10000}],
            lookup_hash: 'a'.repeat(64)
        };

        expect(row.index).to.equal('18446744073709551615');
    });

    it('ITemplateBuyofferRow matches template_buyoffer_s with string uint64 ids', () => {
        const row: ITemplateBuyofferRow = {
            buyoffer_id: '7',
            buyer: 'alice',
            price: '10.00000000 WAX',
            template_id: '42',
            maker_marketplace: 'atomichubmkt',
            collection_name: 'mycollection',
            collection_fee: 0.05
        };

        expect(row.buyoffer_id).to.equal('7');
        expect(row.collection_fee).to.equal(0.05);
    });
});
