import { expect } from 'chai';

import {
    AcceptBuyofferInput, AnnounceAuctionInput, AnnounceSaleInput, AtomicMarketActions,
    EosioActionData, EosioActionObject, EosioAuthorizationObject, FulfillTemplateBuyofferInput,
    MarketActionBuilder, MarketActionGenerator, PurchaseSaleInput
} from '../src';

// One asset id, which is every sale a v2 chain holds: announcesale writes no
// other shape. The bundle fixture below is the legacy row that predates it.
const plainSale: PurchaseSaleInput = {
    buyer: 'buyeracct111',
    sale_id: '42',
    asset_ids: ['1099511627776'],
    listing_price: '100.00000000 WAX',
    settlement_symbol: '8,WAX',
    intended_delphi_median: '0',
    token_contract: 'eosio.token',
    taker_marketplace: 'mymarketacct'
};

const bundleSale: PurchaseSaleInput = {
    ...plainSale,
    asset_ids: ['1099511627776', '1099511627777']
};

// A delphi sale lists in USD and settles in WAX at the oracle median, so its
// deposit quantity is derived rather than equal to the listing price.
const delphiSale: PurchaseSaleInput = {
    ...plainSale,
    listing_price: '1.00 USD',
    intended_delphi_median: '401',
    settlement_quantity: '24.93765586 WAX'
};

const listing: AnnounceSaleInput = {
    seller: 'selleracct11',
    asset_ids: ['1099511627776'],
    listing_price: '100.00000000 WAX',
    settlement_symbol: '8,WAX',
    maker_marketplace: 'mymarketacct',
    assets_contract: 'atomicassets'
};

// A day-long auction, the same single asset every v2 listing holds.
const auctionListing: AnnounceAuctionInput = {
    seller: 'selleracct11',
    asset_ids: ['1099511627776'],
    starting_bid: '10.00000000 WAX',
    duration: 86400,
    maker_marketplace: 'mymarketacct',
    assets_contract: 'atomicassets'
};

// The recipient of a buyoffer accepting it: they sign, and they are the sender
// of the offer the contract reads out of the AtomicAssets offers table.
const buyofferAcceptance: AcceptBuyofferInput = {
    recipient: 'selleracct11',
    buyoffer_id: '7',
    asset_ids: ['1099511627776'],
    expected_price: '100.00000000 WAX',
    taker_marketplace: 'mymarketacct',
    assets_contract: 'atomicassets'
};

const bundleBuyofferAcceptance: AcceptBuyofferInput = {
    ...buyofferAcceptance,
    asset_ids: ['1099511627776', '1099511627777']
};

const templateFulfilment: FulfillTemplateBuyofferInput = {
    seller: 'selleracct11',
    buyoffer_id: '9',
    asset_id: '1099511627776',
    expected_price: '100.00000000 WAX',
    taker_marketplace: 'mymarketacct',
    assets_contract: 'atomicassets'
};

describe('MarketActionGenerator royalty action helpers', () => {
    const contract = 'atomicmarket';
    const generator = new MarketActionGenerator(contract);
    const authorization: EosioAuthorizationObject[] = [{actor: 'creator', permission: 'active'}];

    it('setroyalconf emits founders as {recipient, weight}[] with numeric weights and the split/mode fields', async () => {
        const actions = await generator.setroyalconf(authorization, 'mycollection', {
            founders: [{recipient: 'alice', weight: '5000'}, {recipient: 'bob', weight: 5000}],
            attribute_mode: 1,
            split_founders: 5000,
            split_templates: 3000,
            split_attributes: 2000
        });

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'setroyalconf',
            authorization,
            data: {
                collection_name: 'mycollection',
                founders: [{recipient: 'alice', weight: 5000}, {recipient: 'bob', weight: 5000}],
                attribute_mode: 1,
                split_founders: 5000,
                split_templates: 3000,
                split_attributes: 2000
            }
        }]);
    });

    it('settemplroy emits collection_name, template_id and recipients', async () => {
        const actions = await generator.settemplroy(
            authorization, 'mycollection', '42', [{recipient: 'alice', weight: '10000'}]
        );

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'settemplroy',
            authorization,
            data: {
                collection_name: 'mycollection',
                template_id: 42,
                recipients: [{recipient: 'alice', weight: 10000}]
            }
        }]);
    });

    it('deltemplroy emits collection_name and template_id', async () => {
        const actions = await generator.deltemplroy(authorization, 'mycollection', 42);

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'deltemplroy',
            authorization,
            data: {
                collection_name: 'mycollection',
                template_id: 42
            }
        }]);
    });

    it('setattrroy emits source/field/value/rule_weight/recipients with value passed through verbatim', async () => {
        const value: [string, unknown] = ['uint64', '100'];

        const actions = await generator.setattrroy(
            authorization, 'mycollection', 1, 'level', value, '10000', [{recipient: 'alice', weight: '10000'}]
        );

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'setattrroy',
            authorization,
            data: {
                collection_name: 'mycollection',
                source: 1,
                field: 'level',
                value,
                rule_weight: 10000,
                recipients: [{recipient: 'alice', weight: 10000}]
            }
        }]);
        expect(actions[0].data.value).to.equal(value);
    });

    it('delattrroy emits collection_name and rule_id as a string (uint64)', async () => {
        const actions = await generator.delattrroy(authorization, 'mycollection', '7');

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'delattrroy',
            authorization,
            data: {
                collection_name: 'mycollection',
                rule_id: '7'
            }
        }]);
    });

    it('delattrroy passes uint64 rule_id strings above 2^53 through without precision loss', async () => {
        const ruleId = '18446744073709551615';
        const actions = await generator.delattrroy(authorization, 'mycollection', ruleId);

        expect(actions[0].data.rule_id).to.equal(ruleId);
    });

    it('delattrroy passes typical string rule_id input through', async () => {
        const actions = await generator.delattrroy(authorization, 'mycollection', '7');

        expect(actions[0].data.rule_id).to.equal('7');
    });

    it('delroyalconf emits only collection_name', async () => {
        const actions = await generator.delroyalconf(authorization, 'mycollection');

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'delroyalconf',
            authorization,
            data: {
                collection_name: 'mycollection'
            }
        }]);
    });

    it('none of the six royalty actions include an authorized_* key in data', async () => {
        const value: [string, unknown] = ['uint64', '100'];

        const allActions = [
            ...await generator.setroyalconf(authorization, 'mycollection', {
                founders: [{recipient: 'alice', weight: 5000}],
                attribute_mode: 0, split_founders: 5000, split_templates: 3000, split_attributes: 2000
            }),
            ...await generator.settemplroy(authorization, 'mycollection', 1, [{recipient: 'alice', weight: 10000}]),
            ...await generator.setattrroy(authorization, 'mycollection', 1, 'level', value, 10000, [{recipient: 'alice', weight: 10000}]),
            ...await generator.deltemplroy(authorization, 'mycollection', 1),
            ...await generator.delattrroy(authorization, 'mycollection', '1'),
            ...await generator.delroyalconf(authorization, 'mycollection')
        ];

        for (const action of allActions) {
            const authorizedKeys = Object.keys(action.data).filter((key) => key.startsWith('authorized_'));
            expect(authorizedKeys, `${action.name} data keys: ${Object.keys(action.data).join(',')}`).to.have.lengthOf(0);
        }
    });
});

describe('MarketActionBuilder sync layer', () => {
    const contract = 'atomicmarket';
    const builder = new MarketActionBuilder(contract);
    const generator = new MarketActionGenerator(contract);
    const authorization: EosioAuthorizationObject[] = [{actor: 'creator', permission: 'active'}];

    it('returns authorization-free {account, name, data} actions', () => {
        const actions = builder.settemplroy('mycollection', '42', [{recipient: 'alice', weight: '10000'}]);

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'settemplroy',
            data: {
                collection_name: 'mycollection',
                template_id: 42,
                recipients: [{recipient: 'alice', weight: 10000}]
            }
        }]);
        expect(actions[0]).to.not.have.property('authorization');
    });

    it('the async generator emits the builder payload plus the authorization', async () => {
        const config = {
            founders: [{recipient: 'alice', weight: 5000}],
            attribute_mode: 1, split_founders: 5000, split_templates: 3000, split_attributes: 2000
        };
        const value: [string, unknown] = ['uint64', '100'];

        const cases: Array<[EosioActionData[], EosioActionObject[]]> = [
            [builder.setroyalconf('mycollection', config), await generator.setroyalconf(authorization, 'mycollection', config)],
            [builder.settemplroy('mycollection', 1, config.founders), await generator.settemplroy(authorization, 'mycollection', 1, config.founders)],
            [builder.setattrroy('mycollection', 1, 'level', value, 10000, config.founders), await generator.setattrroy(authorization, 'mycollection', 1, 'level', value, 10000, config.founders)],
            [builder.deltemplroy('mycollection', 1), await generator.deltemplroy(authorization, 'mycollection', 1)],
            [builder.delattrroy('mycollection', '1'), await generator.delattrroy(authorization, 'mycollection', '1')],
            [builder.delroyalconf('mycollection'), await generator.delroyalconf(authorization, 'mycollection')]
        ];

        for (const [sync, generated] of cases) {
            expect(generated).to.deep.equal(sync.map((action) => ({...action, authorization})));
        }
    });

    it('builder delattrroy forwards uint64 rule_id strings verbatim', () => {
        const actions = builder.delattrroy('mycollection', '18446744073709551615');

        expect(actions[0].data.rule_id).to.equal('18446744073709551615');
    });
});

describe('MarketActionBuilder sale and RAM-payment actions', () => {
    const contract = 'atomicmarket';
    const builder = new MarketActionBuilder(contract);
    const generator = new MarketActionGenerator(contract);
    const authorization: EosioAuthorizationObject[] = [{actor: 'buyer', permission: 'active'}];

    it('announcesale emits seller, asset_ids, listing_price, settlement_symbol and maker_marketplace verbatim', () => {
        const actions = builder.announcesale(
            'alice', ['1099511627776', '1099511627777'], '100.00000000 WAX', '8,WAX', 'mymarketacct'
        );

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'announcesale',
            data: {
                seller: 'alice',
                asset_ids: ['1099511627776', '1099511627777'],
                listing_price: '100.00000000 WAX',
                settlement_symbol: '8,WAX',
                maker_marketplace: 'mymarketacct'
            }
        }]);
    });

    it('cancelsale emits sale_id as a string (uint64)', () => {
        const actions = builder.cancelsale('42');

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'cancelsale',
            data: {
                sale_id: '42'
            }
        }]);
    });

    it('assertsale emits sale_id, asset_ids_to_assert, listing_price_to_assert and settlement_symbol_to_assert', () => {
        const actions = builder.assertsale('42', ['1099511627776'], '100.00000000 WAX', '8,WAX');

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'assertsale',
            data: {
                sale_id: '42',
                asset_ids_to_assert: ['1099511627776'],
                listing_price_to_assert: '100.00000000 WAX',
                settlement_symbol_to_assert: '8,WAX'
            }
        }]);
    });

    it('purchasesale emits buyer, sale_id, intended_delphi_median and taker_marketplace', () => {
        const actions = builder.purchasesale('bob', '42', '0', 'mymarketacct');

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'purchasesale',
            data: {
                buyer: 'bob',
                sale_id: '42',
                intended_delphi_median: '0',
                taker_marketplace: 'mymarketacct'
            }
        }]);
    });

    it('paysaleram emits payer and sale_id', () => {
        const actions = builder.paysaleram('mymarketacct', '42');

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'paysaleram',
            data: {
                payer: 'mymarketacct',
                sale_id: '42'
            }
        }]);
    });

    it('payauctram emits payer and auction_id', () => {
        const actions = builder.payauctram('mymarketacct', '42');

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'payauctram',
            data: {
                payer: 'mymarketacct',
                auction_id: '42'
            }
        }]);
    });

    it('paybuyoram emits payer and buyoffer_id', () => {
        const actions = builder.paybuyoram('mymarketacct', '42');

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'paybuyoram',
            data: {
                payer: 'mymarketacct',
                buyoffer_id: '42'
            }
        }]);
    });

    it('the builder emits no authorization and the generator emits the builder payload plus the passed authorization', async () => {
        const cases: Array<[EosioActionData[], EosioActionObject[]]> = [
            [
                builder.announcesale('alice', ['1'], '1.00000000 WAX', '8,WAX', '.'),
                await generator.announcesale(authorization, 'alice', ['1'], '1.00000000 WAX', '8,WAX', '.')
            ],
            [
                builder.purchaseSaleActions(plainSale),
                await generator.purchaseSaleActions(authorization, plainSale)
            ],
            [
                builder.announceSaleActions(listing),
                await generator.announceSaleActions(authorization, listing)
            ],
            [builder.cancelsale('42'), await generator.cancelsale(authorization, '42')],
            [
                builder.assertsale('42', ['1'], '1.00000000 WAX', '8,WAX'),
                await generator.assertsale(authorization, '42', ['1'], '1.00000000 WAX', '8,WAX')
            ],
            [
                builder.purchasesale('bob', '42', '0', '.'),
                await generator.purchasesale(authorization, 'bob', '42', '0', '.')
            ],
            [builder.paysaleram('bob', '42'), await generator.paysaleram(authorization, 'bob', '42')],
            [builder.payauctram('bob', '42'), await generator.payauctram(authorization, 'bob', '42')],
            [builder.paybuyoram('bob', '42'), await generator.paybuyoram(authorization, 'bob', '42')]
        ];

        for (const [sync, generated] of cases) {
            expect(sync[0]).to.not.have.property('authorization');
            expect(generated).to.deep.equal(sync.map((action) => ({...action, authorization})));
        }
    });

    it('uint64 identifiers above 2^53 survive verbatim through cancelsale and purchasesale', () => {
        const max = '18446744073709551615';

        expect(builder.cancelsale(max)[0].data.sale_id).to.equal(max);
        expect(builder.purchasesale('bob', max, max, '.')[0].data.sale_id).to.equal(max);
        expect(builder.purchasesale('bob', '42', max, '.')[0].data.intended_delphi_median).to.equal(max);
    });
});

describe('MarketActionBuilder composed sale flows', () => {
    const contract = 'atomicmarket';
    const builder = new MarketActionBuilder(contract);

    it('purchaseSaleActions emits assertsale, transfer, purchasesale in order, on the market, token and market contracts', () => {
        const actions = builder.purchaseSaleActions(plainSale);

        expect(actions.map((action) => [action.account, action.name])).to.deep.equal([
            [contract, 'assertsale'],
            ['eosio.token', 'transfer'],
            [contract, 'purchasesale']
        ]);
    });

    it('the transfer deposits the listing price into the market contract with memo deposit when no settlement_quantity is given', () => {
        const [, transfer] = builder.purchaseSaleActions(plainSale);

        expect(transfer).to.deep.equal({
            account: 'eosio.token',
            name: 'transfer',
            data: {
                from: 'buyeracct111',
                to: contract,
                quantity: '100.00000000 WAX',
                memo: 'deposit'
            }
        });
    });

    it('a supplied settlement_quantity reaches the transfer verbatim and changes no other action', () => {
        const delphi = builder.purchaseSaleActions(delphiSale);
        const otherQuantity = builder.purchaseSaleActions({...delphiSale, settlement_quantity: '1.00000000 WAX'});

        expect(delphi[1].data.quantity).to.equal('24.93765586 WAX');
        expect(otherQuantity[1].data.quantity).to.equal('1.00000000 WAX');
        expect(delphi[0]).to.deep.equal(otherQuantity[0]);
        expect(delphi[2].data.intended_delphi_median).to.equal('401');
        expect(delphi[2]).to.deep.equal(otherQuantity[2]);
    });

    it('assertsale carries sale_id unsuffixed and the asserted terms in their *_to_assert fields', () => {
        const [assertsale] = builder.purchaseSaleActions(plainSale);

        expect(assertsale).to.deep.equal({
            account: contract,
            name: 'assertsale',
            data: {
                sale_id: '42',
                asset_ids_to_assert: ['1099511627776'],
                listing_price_to_assert: '100.00000000 WAX',
                settlement_symbol_to_assert: '8,WAX'
            }
        });
    });

    it('purchasesale carries buyer, sale_id, intended_delphi_median and taker_marketplace verbatim', () => {
        const [, , purchasesale] = builder.purchaseSaleActions(delphiSale);

        expect(purchasesale).to.deep.equal({
            account: contract,
            name: 'purchasesale',
            data: {
                buyer: 'buyeracct111',
                sale_id: '42',
                intended_delphi_median: '401',
                taker_marketplace: 'mymarketacct'
            }
        });
    });

    it('uint64 values above 2^53 survive verbatim through sale_id, asset_ids and intended_delphi_median', () => {
        const max = '18446744073709551615';
        const actions = builder.purchaseSaleActions({
            ...delphiSale,
            sale_id: max,
            asset_ids: [max],
            intended_delphi_median: max
        });

        expect(actions[0].data.sale_id).to.equal(max);
        expect(actions[0].data.asset_ids_to_assert).to.deep.equal([max]);
        expect(actions[2].data.sale_id).to.equal(max);
        expect(actions[2].data.intended_delphi_median).to.equal(max);
    });

    it('announceSaleActions emits announcesale then the assets contract createoffer of the same assets with memo sale', () => {
        const actions = builder.announceSaleActions(listing);

        expect(actions).to.deep.equal([
            {
                account: contract,
                name: 'announcesale',
                data: {
                    seller: 'selleracct11',
                    asset_ids: ['1099511627776'],
                    listing_price: '100.00000000 WAX',
                    settlement_symbol: '8,WAX',
                    maker_marketplace: 'mymarketacct'
                }
            },
            {
                account: 'atomicassets',
                name: 'createoffer',
                data: {
                    sender: 'selleracct11',
                    recipient: contract,
                    sender_asset_ids: ['1099511627776'],
                    recipient_asset_ids: [],
                    memo: 'sale'
                }
            }
        ]);
    });
});

// purchaseSaleActions checks the one pairing whose failure is a wrong payment
// rather than a rejected transaction, and it reads the contract's own
// discriminator to know which sale it is looking at: whether listing_price and
// settlement_symbol name a single symbol, precision and code both. What that
// classification must not reject is as much of this as what it rejects, since a
// sale settling a symbol it never priced in is meant to name two symbols and
// two amounts.
describe('MarketActionBuilder composed-flow guards', () => {
    const contract = 'atomicmarket';
    const builder = new MarketActionBuilder(contract);
    const generator = new MarketActionGenerator(contract);
    const authorization: EosioAuthorizationObject[] = [{actor: 'buyer', permission: 'active'}];

    // Same code, different precision, which is a different symbol on chain and
    // reaches the registered-pair lookup exactly as a USD listing does.
    const differingPrecision: PurchaseSaleInput = {...plainSale, settlement_symbol: '4,WAX'};

    it('a sale settling the symbol it priced in accepts a settlement_quantity equal to listing_price and deposits it', () => {
        const actions = builder.purchaseSaleActions({...plainSale, settlement_quantity: '100.00000000 WAX'});

        expect(actions[1].data.quantity).to.equal('100.00000000 WAX');
    });

    it('a settlement_quantity diverging from listing_price on that sale throws, naming both amounts', () => {
        const diverging: PurchaseSaleInput = {...plainSale, settlement_quantity: '1.00000000 WAX'};

        expect(() => builder.purchaseSaleActions(diverging)).to.throw(/settlement_quantity/);
        expect(() => builder.purchaseSaleActions(diverging)).to.throw(/1\.00000000 WAX/);
        expect(() => builder.purchaseSaleActions(diverging)).to.throw(/100\.00000000 WAX/);
    });

    it('a nonzero intended_delphi_median on that sale throws, mirroring the contract requiring zero there', () => {
        const withMedian: PurchaseSaleInput = {...plainSale, intended_delphi_median: '401'};

        expect(() => builder.purchaseSaleActions(withMedian)).to.throw(/intended_delphi_median/);
        expect(() => builder.purchaseSaleActions(withMedian)).to.throw(/401/);
        expect(() => builder.purchaseSaleActions(withMedian)).to.throw(/8,WAX/);
    });

    it('omitting settlement_quantity on that sale stays accepted, the listing price being what settles', () => {
        expect(() => builder.purchaseSaleActions(plainSale)).to.not.throw();
    });

    it('a sale listing one symbol and settling another is not compared against listing_price', () => {
        expect(() => builder.purchaseSaleActions(delphiSale)).to.not.throw();
        expect(builder.purchaseSaleActions(delphiSale)[1].data.quantity).to.equal('24.93765586 WAX');
    });

    it('a settlement_symbol differing from the price in precision alone is one of those sales, not a mismatch', () => {
        const settled: PurchaseSaleInput = {...differingPrecision, settlement_quantity: '100.0000 WAX'};

        expect(() => builder.purchaseSaleActions(settled)).to.not.throw();
        expect(builder.purchaseSaleActions(settled)[1].data.quantity).to.equal('100.0000 WAX');
        expect(() => builder.purchaseSaleActions({...settled, intended_delphi_median: '401'})).to.not.throw();
    });

    it('and therefore takes a settlement_quantity, the error naming both fields', () => {
        expect(() => builder.purchaseSaleActions(differingPrecision)).to.throw(/settlement_quantity/);
        expect(() => builder.purchaseSaleActions(differingPrecision)).to.throw(/4,WAX/);
        expect(() => builder.purchaseSaleActions(differingPrecision)).to.throw(/100\.00000000 WAX/);
    });

    it('a precision-0 sale settles the symbol it priced in, its price carrying no decimal point', () => {
        const zeroPrecision: PurchaseSaleInput = {...plainSale, listing_price: '100 CREDIT', settlement_symbol: '0,CREDIT'};

        expect(() => builder.purchaseSaleActions({...zeroPrecision, settlement_quantity: '100 CREDIT'})).to.not.throw();
        expect(() => builder.purchaseSaleActions({...zeroPrecision, settlement_quantity: '99 CREDIT'})).to.throw(/99 CREDIT/);
        expect(() => builder.purchaseSaleActions({...zeroPrecision, settlement_symbol: '2,CREDIT'})).to.throw(/settlement_quantity/);
    });

    it('a notation neither reader can parse is not shown to name one symbol, so it takes a settlement_quantity', () => {
        const unparseable: PurchaseSaleInput = {...plainSale, listing_price: 'free'};

        expect(() => builder.purchaseSaleActions(unparseable)).to.throw(/settlement_quantity/);
        expect(() => builder.purchaseSaleActions({...unparseable, settlement_quantity: '100.00000000 WAX'})).to.not.throw();
    });

    it('a settlement_quantity in a symbol other than settlement_symbol throws, naming both', () => {
        const wrongSymbol: PurchaseSaleInput = {...delphiSale, settlement_quantity: '24.93765586 USD'};

        expect(() => builder.purchaseSaleActions(wrongSymbol)).to.throw(/settlement_quantity/);
        expect(() => builder.purchaseSaleActions(wrongSymbol)).to.throw(/24\.93765586 USD/);
        expect(() => builder.purchaseSaleActions(wrongSymbol)).to.throw(/8,WAX/);
    });

    it('and a settlement_quantity at the settlement symbol\'s code but not its precision is one of those', () => {
        // An Antelope symbol is precision and code together, so a quantity
        // carrying four decimals is not '8,WAX' and the deposit credits a
        // balance the purchase never reaches.
        const wrongPrecision: PurchaseSaleInput = {...delphiSale, settlement_quantity: '24.9376 WAX'};

        expect(() => builder.purchaseSaleActions(wrongPrecision)).to.throw(/24\.9376 WAX/);
        expect(() => builder.purchaseSaleActions({...delphiSale, settlement_quantity: 'free'})).to.throw(/settlement_quantity/);
    });

    it('a purchase of several assets throws, that transaction committing rather than reverting', () => {
        expect(() => builder.purchaseSaleActions(bundleSale)).to.throw(/asset_ids carries 2 ids/);
        expect(() => builder.purchaseSaleActions(bundleSale)).to.throw(/allow_v1_bundle_sale/);
    });

    it('allow_v1_bundle_sale builds it anyway, for a chain still running v1', () => {
        const actions = builder.purchaseSaleActions({...bundleSale, allow_v1_bundle_sale: true});

        expect(actions).to.have.lengthOf(3);
        expect(actions[0].data.asset_ids_to_assert).to.deep.equal(['1099511627776', '1099511627777']);
        expect(actions[1].data.quantity).to.equal('100.00000000 WAX');
    });

    it('the bundle check reads the ids alone, before either symbol branch', () => {
        // A bundle whose other fields are the ones that would throw anyway,
        // so the error a caller sees is the one that costs them money.
        const both: PurchaseSaleInput = {...bundleSale, settlement_symbol: '4,WAX'};

        expect(() => builder.purchaseSaleActions(both)).to.throw(/asset_ids/);
        expect(() => builder.purchaseSaleActions(both)).to.not.throw(/settlement_quantity is required/);
    });

    it('one asset id and none at all both pass the bundle check, an empty purchase only being refused on chain', () => {
        expect(() => builder.purchaseSaleActions(plainSale)).to.not.throw();
        expect(() => builder.purchaseSaleActions({...plainSale, asset_ids: []})).to.not.throw();
    });

    it('announceSaleActions builds every listing it is handed, supported symbols and pairs being chain state', () => {
        const listings: AnnounceSaleInput[] = [
            listing,
            {...listing, settlement_symbol: '4,WAX'},
            {...listing, listing_price: '30.00 USD', settlement_symbol: '8,WAX'},
            {...listing, listing_price: 'free'},
            {...listing, settlement_symbol: 'WAX'},
            // A bundle listing, which v2's announcesale refuses outright. That
            // refusal is a rejected transaction rather than a wrong payment,
            // so it stays on the chain's side of the line.
            {...listing, asset_ids: ['1099511627776', '1099511627777']}
        ];

        for (const candidate of listings) {
            const [announcesale] = builder.announceSaleActions(candidate);

            expect(announcesale.data.listing_price).to.equal(candidate.listing_price);
            expect(announcesale.data.settlement_symbol).to.equal(candidate.settlement_symbol);
        }
    });

    it('the guard holds on the async generator surface, where announcing rejects nothing', async () => {
        const messages: string[] = [];

        for (const attempt of [
            generator.purchaseSaleActions(authorization, {...plainSale, settlement_quantity: '1.00000000 WAX'}),
            generator.announceSaleActions(authorization, {...listing, settlement_symbol: '4,WAX'})
        ]) {
            try {
                await attempt;
                messages.push('resolved');
            } catch (error) {
                messages.push((error as Error).message);
            }
        }

        expect(messages[0]).to.match(/settlement_quantity/);
        expect(messages[1]).to.equal('resolved');
    });

    it('the guard leaves every already-valid composed flow byte-identical', async () => {
        expect(builder.purchaseSaleActions(plainSale)).to.have.lengthOf(3);
        expect(await generator.announceSaleActions(authorization, listing)).to.have.lengthOf(2);
    });
});

describe('MarketActionBuilder auction actions', () => {
    const contract = 'atomicmarket';
    const builder = new MarketActionBuilder(contract);

    it('announceauct emits seller, asset_ids, starting_bid, duration and maker_marketplace, the duration as a number', () => {
        const actions = builder.announceauct('alice', ['1099511627776'], '10.00000000 WAX', '86400', 'mymarketacct');

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'announceauct',
            data: {
                seller: 'alice',
                asset_ids: ['1099511627776'],
                starting_bid: '10.00000000 WAX',
                duration: 86400,
                maker_marketplace: 'mymarketacct'
            }
        }]);
    });

    it('cancelauct emits only auction_id, as a string (uint64)', () => {
        const actions = builder.cancelauct('42');

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'cancelauct',
            data: {
                auction_id: '42'
            }
        }]);
    });

    it('auctionbid emits bidder, auction_id, bid and taker_marketplace', () => {
        const actions = builder.auctionbid('bob', '42', '11.00000000 WAX', 'mymarketacct');

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'auctionbid',
            data: {
                bidder: 'bob',
                auction_id: '42',
                bid: '11.00000000 WAX',
                taker_marketplace: 'mymarketacct'
            }
        }]);
    });

    it('auctclaimbuy emits only auction_id', () => {
        expect(builder.auctclaimbuy('42')).to.deep.equal([{
            account: contract,
            name: 'auctclaimbuy',
            data: {
                auction_id: '42'
            }
        }]);
    });

    it('auctclaimsel emits only auction_id', () => {
        expect(builder.auctclaimsel('42')).to.deep.equal([{
            account: contract,
            name: 'auctclaimsel',
            data: {
                auction_id: '42'
            }
        }]);
    });

    it('assertauct emits auction_id and asset_ids_to_assert', () => {
        const actions = builder.assertauct('42', ['1099511627776']);

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'assertauct',
            data: {
                auction_id: '42',
                asset_ids_to_assert: ['1099511627776']
            }
        }]);
    });

    it('uint64 auction ids and asset ids above 2^53 survive verbatim across the auction family', () => {
        const max = '18446744073709551615';

        expect(builder.announceauct('alice', [max], '10.00000000 WAX', 1, '.')[0].data.asset_ids).to.deep.equal([max]);
        expect(builder.cancelauct(max)[0].data.auction_id).to.equal(max);
        expect(builder.auctionbid('bob', max, '11.00000000 WAX', '.')[0].data.auction_id).to.equal(max);
        expect(builder.auctclaimbuy(max)[0].data.auction_id).to.equal(max);
        expect(builder.auctclaimsel(max)[0].data.auction_id).to.equal(max);
        expect(builder.assertauct(max, [max])[0].data.asset_ids_to_assert).to.deep.equal([max]);
    });

    it('announceauct refuses a fractional, negative or above-uint32 duration, naming the field and the value', () => {
        for (const duration of [86400.5, -1, 4294967296, '86400.5', 'a day']) {
            expect(() => builder.announceauct('alice', ['1'], '10.00000000 WAX', duration, '.'), String(duration))
                .to.throw(/duration/);
            expect(() => builder.announceauct('alice', ['1'], '10.00000000 WAX', duration, '.'), String(duration))
                .to.throw(new RegExp(String(duration).replace('.', '\\.')));
        }
    });

    it('announceauct refuses NaN and Infinity rather than packing a duration that serializes as null', () => {
        for (const duration of [NaN, Infinity, -Infinity]) {
            expect(() => builder.announceauct('alice', ['1'], '10.00000000 WAX', duration, '.'), String(duration))
                .to.throw(/duration/);
        }
    });

    it('announceauct builds at both ends of the uint32 range, the configured bounds being chain state', () => {
        expect(builder.announceauct('alice', ['1'], '10.00000000 WAX', 0, '.')[0].data.duration).to.equal(0);
        expect(builder.announceauct('alice', ['1'], '10.00000000 WAX', 4294967295, '.')[0].data.duration).to.equal(4294967295);
        expect(builder.announceauct('alice', ['1'], '10.00000000 WAX', '4294967295', '.')[0].data.duration).to.equal(4294967295);
    });
});

describe('MarketActionBuilder buyoffer and template-buyoffer actions', () => {
    const contract = 'atomicmarket';
    const builder = new MarketActionBuilder(contract);
    const generator = new MarketActionGenerator(contract);

    it('createbuyo emits buyer, recipient, price, asset_ids, memo and maker_marketplace', () => {
        const actions = builder.createbuyo('bob', 'alice', '100.00000000 WAX', ['1099511627776'], 'please sell', 'mymarketacct');

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'createbuyo',
            data: {
                buyer: 'bob',
                recipient: 'alice',
                price: '100.00000000 WAX',
                asset_ids: ['1099511627776'],
                memo: 'please sell',
                maker_marketplace: 'mymarketacct'
            }
        }]);
    });

    it('cancelbuyo emits only buyoffer_id, as a string (uint64)', () => {
        expect(builder.cancelbuyo('7')).to.deep.equal([{
            account: contract,
            name: 'cancelbuyo',
            data: {
                buyoffer_id: '7'
            }
        }]);
    });

    it('declinebuyo emits buyoffer_id and decline_memo', () => {
        const actions = builder.declinebuyo('7', 'not for sale');

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'declinebuyo',
            data: {
                buyoffer_id: '7',
                decline_memo: 'not for sale'
            }
        }]);
    });

    it('createtbuyo emits buyer, price, collection_name, template_id and maker_marketplace, its uint64 template_id uncoerced', () => {
        const actions = builder.createtbuyo('bob', '100.00000000 WAX', 'mycollection', '1234', 'mymarketacct');

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'createtbuyo',
            data: {
                buyer: 'bob',
                price: '100.00000000 WAX',
                collection_name: 'mycollection',
                template_id: '1234',
                maker_marketplace: 'mymarketacct'
            }
        }]);
    });

    it('canceltbuyo emits only buyoffer_id, as a string (uint64)', () => {
        expect(builder.canceltbuyo('9')).to.deep.equal([{
            account: contract,
            name: 'canceltbuyo',
            data: {
                buyoffer_id: '9'
            }
        }]);
    });

    it('uint64 buyoffer ids, asset ids and template ids above 2^53 survive verbatim', () => {
        const max = '18446744073709551615';

        expect(builder.createbuyo('bob', 'alice', '1.00000000 WAX', [max], '', '.')[0].data.asset_ids).to.deep.equal([max]);
        expect(builder.cancelbuyo(max)[0].data.buyoffer_id).to.equal(max);
        expect(builder.declinebuyo(max, '')[0].data.buyoffer_id).to.equal(max);
        expect(builder.createtbuyo('bob', '1.00000000 WAX', 'mycollection', max, '.')[0].data.template_id).to.equal(max);
        expect(builder.canceltbuyo(max)[0].data.buyoffer_id).to.equal(max);
    });

    it('neither the builder nor the generator exposes acceptbuyo or fulfilltbuyo, the composed helpers being the only path', () => {
        const surfaces: Record<string, unknown>[] = [
            builder as unknown as Record<string, unknown>,
            generator as unknown as Record<string, unknown>
        ];

        for (const surface of surfaces) {
            for (const name of ['acceptbuyo', 'fulfilltbuyo']) {
                expect(surface[name], name).to.equal(undefined);
            }
        }
    });
});

describe('MarketActionGenerator auction and buyoffer parity', () => {
    const contract = 'atomicmarket';
    const builder = new MarketActionBuilder(contract);
    const generator = new MarketActionGenerator(contract);
    const authorization: EosioAuthorizationObject[] = [{actor: 'seller', permission: 'active'}];

    it('the builder emits no authorization and the generator emits the builder payload plus the passed authorization', async () => {
        const cases: Array<[EosioActionData[], EosioActionObject[]]> = [
            [
                builder.announceauct('alice', ['1'], '10.00000000 WAX', 86400, '.'),
                await generator.announceauct(authorization, 'alice', ['1'], '10.00000000 WAX', 86400, '.')
            ],
            [builder.cancelauct('42'), await generator.cancelauct(authorization, '42')],
            [
                builder.auctionbid('bob', '42', '11.00000000 WAX', '.'),
                await generator.auctionbid(authorization, 'bob', '42', '11.00000000 WAX', '.')
            ],
            [builder.auctclaimbuy('42'), await generator.auctclaimbuy(authorization, '42')],
            [builder.auctclaimsel('42'), await generator.auctclaimsel(authorization, '42')],
            [builder.assertauct('42', ['1']), await generator.assertauct(authorization, '42', ['1'])],
            [
                builder.createbuyo('bob', 'alice', '100.00000000 WAX', ['1'], 'please sell', '.'),
                await generator.createbuyo(authorization, 'bob', 'alice', '100.00000000 WAX', ['1'], 'please sell', '.')
            ],
            [builder.cancelbuyo('7'), await generator.cancelbuyo(authorization, '7')],
            [builder.declinebuyo('7', 'no'), await generator.declinebuyo(authorization, '7', 'no')],
            [
                builder.createtbuyo('bob', '100.00000000 WAX', 'mycollection', '1234', '.'),
                await generator.createtbuyo(authorization, 'bob', '100.00000000 WAX', 'mycollection', '1234', '.')
            ],
            [builder.canceltbuyo('9'), await generator.canceltbuyo(authorization, '9')]
        ];

        expect(cases).to.have.lengthOf(11);

        for (const [sync, generated] of cases) {
            expect(sync[0]).to.not.have.property('authorization');
            expect(generated).to.deep.equal(sync.map((action) => ({...action, authorization})));
        }
    });
});

// Both offer-consuming flows turn on the contract reading the globally last
// created row of the AtomicAssets offers table rather than an offer id it is
// handed, so what each helper emits and the order it emits them in is the
// contract's rule and not a preference.
describe('MarketActionBuilder composed auction and buyoffer flows', () => {
    const contract = 'atomicmarket';
    const builder = new MarketActionBuilder(contract);
    const generator = new MarketActionGenerator(contract);
    const authorization: EosioAuthorizationObject[] = [{actor: 'seller', permission: 'active'}];

    it('announceAuctionActions emits announceauct then the assets contract transfer of the same assets to the market with memo auction', () => {
        const actions = builder.announceAuctionActions(auctionListing);

        expect(actions).to.deep.equal([
            {
                account: contract,
                name: 'announceauct',
                data: {
                    seller: 'selleracct11',
                    asset_ids: ['1099511627776'],
                    starting_bid: '10.00000000 WAX',
                    duration: 86400,
                    maker_marketplace: 'mymarketacct'
                }
            },
            {
                account: 'atomicassets',
                name: 'transfer',
                data: {
                    from: 'selleracct11',
                    to: contract,
                    asset_ids: ['1099511627776'],
                    memo: 'auction'
                }
            }
        ]);
    });

    it('announceAuctionActions builds every auction it is handed, durations, symbols and marketplaces being chain state', () => {
        const auctions: AnnounceAuctionInput[] = [
            auctionListing,
            {...auctionListing, duration: 1},
            {...auctionListing, duration: 4294967295},
            {...auctionListing, starting_bid: '0.00000000 WAX'},
            {...auctionListing, starting_bid: '10.0000 UNKNOWN'},
            {...auctionListing, maker_marketplace: 'notregistered'},
            // A bundle auction, which v2's announceauct refuses outright. That
            // refusal is a rejected transaction, so it stays on the chain's
            // side of the line the sale helpers hold.
            {...auctionListing, asset_ids: ['1099511627776', '1099511627777']}
        ];

        for (const candidate of auctions) {
            const [announceauct, transfer] = builder.announceAuctionActions(candidate);

            expect(announceauct.data.starting_bid).to.equal(candidate.starting_bid);
            expect(announceauct.data.duration).to.equal(Number(candidate.duration));
            expect(transfer.data.asset_ids).to.deep.equal(candidate.asset_ids);
        }
    });

    it('announceAuctionActions reads assets_contract for the transfer account, not a hardcoded atomicassets', () => {
        const actions = builder.announceAuctionActions({...auctionListing, assets_contract: 'aa.custom'});

        expect(actions[1].account).to.equal('aa.custom');
    });

    it('acceptBuyofferActions emits the createoffer with memo buyoffer immediately followed by acceptbuyo, and nothing else', () => {
        const actions = builder.acceptBuyofferActions(buyofferAcceptance);

        expect(actions).to.deep.equal([
            {
                account: 'atomicassets',
                name: 'createoffer',
                data: {
                    sender: 'selleracct11',
                    recipient: contract,
                    sender_asset_ids: ['1099511627776'],
                    recipient_asset_ids: [],
                    memo: 'buyoffer'
                }
            },
            {
                account: contract,
                name: 'acceptbuyo',
                data: {
                    buyoffer_id: '7',
                    expected_asset_ids: ['1099511627776'],
                    expected_price: '100.00000000 WAX',
                    taker_marketplace: 'mymarketacct'
                }
            }
        ]);
    });

    it('acceptBuyofferActions reads assets_contract for the createoffer account, not a hardcoded atomicassets', () => {
        const actions = builder.acceptBuyofferActions({...buyofferAcceptance, assets_contract: 'aa.custom'});

        expect(actions[0].account).to.equal('aa.custom');
    });

    it('fulfillTemplateBuyofferActions emits the createoffer with memo tbuyoffer immediately followed by fulfilltbuyo, and nothing else', () => {
        const actions = builder.fulfillTemplateBuyofferActions(templateFulfilment);

        expect(actions).to.deep.equal([
            {
                account: 'atomicassets',
                name: 'createoffer',
                data: {
                    sender: 'selleracct11',
                    recipient: contract,
                    sender_asset_ids: ['1099511627776'],
                    recipient_asset_ids: [],
                    memo: 'tbuyoffer'
                }
            },
            {
                account: contract,
                name: 'fulfilltbuyo',
                data: {
                    seller: 'selleracct11',
                    buyoffer_id: '9',
                    asset_id: '1099511627776',
                    expected_price: '100.00000000 WAX',
                    taker_marketplace: 'mymarketacct'
                }
            }
        ]);
    });

    it('fulfillTemplateBuyofferActions reads assets_contract for the createoffer account, not a hardcoded atomicassets', () => {
        const actions = builder.fulfillTemplateBuyofferActions({...templateFulfilment, assets_contract: 'aa.custom'});

        expect(actions[0].account).to.equal('aa.custom');
    });

    it('uint64 ids above 2^53 survive verbatim through both offer-consuming flows', () => {
        const max = '18446744073709551615';
        const accept = builder.acceptBuyofferActions({...buyofferAcceptance, buyoffer_id: max, asset_ids: [max]});
        const fulfil = builder.fulfillTemplateBuyofferActions({...templateFulfilment, buyoffer_id: max, asset_id: max});

        expect(accept[0].data.sender_asset_ids).to.deep.equal([max]);
        expect(accept[1].data.buyoffer_id).to.equal(max);
        expect(accept[1].data.expected_asset_ids).to.deep.equal([max]);
        expect(fulfil[0].data.sender_asset_ids).to.deep.equal([max]);
        expect(fulfil[1].data.buyoffer_id).to.equal(max);
        expect(fulfil[1].data.asset_id).to.equal(max);
    });

    it('acceptBuyofferActions throws on two or more asset ids, naming the count', () => {
        expect(() => builder.acceptBuyofferActions(bundleBuyofferAcceptance)).to.throw(/asset_ids carries 2 ids/);
        expect(() => builder.acceptBuyofferActions(bundleBuyofferAcceptance)).to.throw(/allow_v1_bundle_buyoffer/);
    });

    it('allow_v1_bundle_buyoffer builds the same shape, for a chain still running v1', () => {
        const actions = builder.acceptBuyofferActions({...bundleBuyofferAcceptance, allow_v1_bundle_buyoffer: true});

        expect(actions.map((action) => [action.account, action.name])).to.deep.equal([
            ['atomicassets', 'createoffer'],
            [contract, 'acceptbuyo']
        ]);
        expect(actions[0].data.sender_asset_ids).to.deep.equal(['1099511627776', '1099511627777']);
        expect(actions[1].data.expected_asset_ids).to.deep.equal(['1099511627776', '1099511627777']);
    });

    it('one asset id and none at all both pass the bundle check, an empty acceptance only being refused on chain', () => {
        expect(() => builder.acceptBuyofferActions(buyofferAcceptance)).to.not.throw();
        expect(() => builder.acceptBuyofferActions({...buyofferAcceptance, asset_ids: []})).to.not.throw();
    });

    it('the three composed helpers hold their parity on the async generator surface', async () => {
        const cases: Array<[EosioActionData[], EosioActionObject[]]> = [
            [
                builder.announceAuctionActions(auctionListing),
                await generator.announceAuctionActions(authorization, auctionListing)
            ],
            [
                builder.acceptBuyofferActions(buyofferAcceptance),
                await generator.acceptBuyofferActions(authorization, buyofferAcceptance)
            ],
            [
                builder.fulfillTemplateBuyofferActions(templateFulfilment),
                await generator.fulfillTemplateBuyofferActions(authorization, templateFulfilment)
            ]
        ];

        for (const [sync, generated] of cases) {
            expect(sync).to.have.lengthOf(2);
            expect(sync[0]).to.not.have.property('authorization');
            expect(generated).to.deep.equal(sync.map((action) => ({...action, authorization})));
        }
    });

    it('the bundle guard reaches the async generator surface, where announcing an auction rejects nothing', async () => {
        const messages: string[] = [];

        for (const attempt of [
            generator.acceptBuyofferActions(authorization, bundleBuyofferAcceptance),
            generator.announceAuctionActions(authorization, {...auctionListing, asset_ids: ['1', '2']})
        ]) {
            try {
                await attempt;
                messages.push('resolved');
            } catch (error) {
                messages.push((error as Error).message);
            }
        }

        expect(messages[0]).to.match(/asset_ids carries 2 ids/);
        expect(messages[1]).to.equal('resolved');
    });
});

describe('MarketActionBuilder marketplace and balance actions', () => {
    const contract = 'atomicmarket';
    const builder = new MarketActionBuilder(contract);
    const generator = new MarketActionGenerator(contract);
    const authorization: EosioAuthorizationObject[] = [{actor: 'alice', permission: 'active'}];

    it('regmarket emits creator and marketplace_name', () => {
        const actions = builder.regmarket('alice', 'mymarketacct');

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'regmarket',
            data: {
                creator: 'alice',
                marketplace_name: 'mymarketacct'
            }
        }]);
    });

    it('withdraw emits owner and token_to_withdraw as a chain-notation asset string', () => {
        const actions = builder.withdraw('alice', '1.00000000 WAX');

        expect(actions).to.deep.equal([{
            account: contract,
            name: 'withdraw',
            data: {
                owner: 'alice',
                token_to_withdraw: '1.00000000 WAX'
            }
        }]);
    });

    it('the builder emits no authorization and the generator emits the builder payload plus the passed authorization', async () => {
        const cases: Array<[EosioActionData[], EosioActionObject[]]> = [
            [
                builder.regmarket('alice', 'mymarketacct'),
                await generator.regmarket(authorization, 'alice', 'mymarketacct')
            ],
            [
                builder.withdraw('alice', '1.00000000 WAX'),
                await generator.withdraw(authorization, 'alice', '1.00000000 WAX')
            ]
        ];

        for (const [sync, generated] of cases) {
            expect(sync[0]).to.not.have.property('authorization');
            expect(generated).to.deep.equal(sync.map((action) => ({...action, authorization})));
        }
    });
});

describe('AtomicMarketActions action-name constants', () => {
    it('every entry maps an action name to itself', () => {
        for (const [key, value] of Object.entries(AtomicMarketActions)) {
            expect(value).to.equal(key);
        }
    });

    it('includes the v2 royalty and template-buyoffer action names from the ABI', () => {
        const expected = [
            'setroyalconf', 'settemplroy', 'setattrroy', 'deltemplroy', 'delattrroy', 'delroyalconf',
            'createtbuyo', 'canceltbuyo', 'fulfilltbuyo', 'lognewtbuyo',
            'announcesale', 'purchasesale', 'auctionbid', 'createbuyo'
        ];

        for (const name of expected) {
            expect(AtomicMarketActions).to.have.property(name, name);
        }
    });

    it('is what the generator methods actually emit', async () => {
        const authorization: EosioAuthorizationObject[] = [{actor: 'creator', permission: 'active'}];
        const generator = new MarketActionGenerator('atomicmarket');
        const [action] = await generator.delroyalconf(authorization, 'mycollection');

        expect(action.name).to.equal(AtomicMarketActions.delroyalconf);
    });

    it('is what each auction, buyoffer and template-buyoffer builder emits', () => {
        const builder = new MarketActionBuilder('atomicmarket');

        const emitted: EosioActionData[][] = [
            builder.announceauct('alice', ['1'], '10.00000000 WAX', 86400, '.'),
            builder.cancelauct('42'),
            builder.auctionbid('bob', '42', '11.00000000 WAX', '.'),
            builder.auctclaimbuy('42'),
            builder.auctclaimsel('42'),
            builder.assertauct('42', ['1']),
            builder.createbuyo('bob', 'alice', '100.00000000 WAX', ['1'], '', '.'),
            builder.cancelbuyo('7'),
            builder.declinebuyo('7', ''),
            builder.createtbuyo('bob', '100.00000000 WAX', 'mycollection', '1234', '.'),
            builder.canceltbuyo('9')
        ];

        const names = emitted.map(([action]) => action.name);

        expect(names).to.deep.equal([
            AtomicMarketActions.announceauct, AtomicMarketActions.cancelauct, AtomicMarketActions.auctionbid,
            AtomicMarketActions.auctclaimbuy, AtomicMarketActions.auctclaimsel, AtomicMarketActions.assertauct,
            AtomicMarketActions.createbuyo, AtomicMarketActions.cancelbuyo, AtomicMarketActions.declinebuyo,
            AtomicMarketActions.createtbuyo, AtomicMarketActions.canceltbuyo
        ]);
    });

    it('is what the composed helpers emit for the two actions they alone reach', () => {
        const builder = new MarketActionBuilder('atomicmarket');

        expect(builder.acceptBuyofferActions(buyofferAcceptance)[1].name).to.equal(AtomicMarketActions.acceptbuyo);
        expect(builder.fulfillTemplateBuyofferActions(templateFulfilment)[1].name).to.equal(AtomicMarketActions.fulfilltbuyo);
        expect(builder.announceAuctionActions(auctionListing)[0].name).to.equal(AtomicMarketActions.announceauct);
    });
});
