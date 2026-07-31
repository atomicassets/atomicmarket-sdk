import type { EosioActionObject, EosioAuthorizationObject } from '@atomichub/atomicassets';

// Single source of truth for the eosio action shapes is the atomicassets SDK;
// re-exported here so consumers of this package alone keep the same names.
export type { EosioActionObject, EosioAuthorizationObject };

// Every action of the AtomicMarket v2 contract, so consumers can reference
// action names without maintaining a parallel string enum.
export const AtomicMarketActions = {
    acceptbuyo: 'acceptbuyo',
    addafeectr: 'addafeectr',
    addbonusfee: 'addbonusfee',
    addconftoken: 'addconftoken',
    adddelphi: 'adddelphi',
    announceauct: 'announceauct',
    announcesale: 'announcesale',
    assertauct: 'assertauct',
    assertsale: 'assertsale',
    auctclaimbuy: 'auctclaimbuy',
    auctclaimsel: 'auctclaimsel',
    auctionbid: 'auctionbid',
    cancelauct: 'cancelauct',
    cancelbuyo: 'cancelbuyo',
    cancelsale: 'cancelsale',
    canceltbuyo: 'canceltbuyo',
    convcounters: 'convcounters',
    createbuyo: 'createbuyo',
    createtbuyo: 'createtbuyo',
    declinebuyo: 'declinebuyo',
    delattrroy: 'delattrroy',
    delbonusfee: 'delbonusfee',
    delroyalconf: 'delroyalconf',
    deltemplroy: 'deltemplroy',
    fulfilltbuyo: 'fulfilltbuyo',
    init: 'init',
    logauctstart: 'logauctstart',
    lognewauct: 'lognewauct',
    lognewbuyo: 'lognewbuyo',
    lognewsale: 'lognewsale',
    lognewtbuyo: 'lognewtbuyo',
    logroyattr: 'logroyattr',
    logroydust: 'logroydust',
    logroyfound: 'logroyfound',
    logroytempl: 'logroytempl',
    logsalestart: 'logsalestart',
    migratebal: 'migratebal',
    payauctram: 'payauctram',
    paybuyoram: 'paybuyoram',
    paysaleram: 'paysaleram',
    purchasesale: 'purchasesale',
    regmarket: 'regmarket',
    setattrroy: 'setattrroy',
    setdefmktcr: 'setdefmktcr',
    setmarketfee: 'setmarketfee',
    setminbidinc: 'setminbidinc',
    setroyalconf: 'setroyalconf',
    settemplroy: 'settemplroy',
    setversion: 'setversion',
    stopbonusfee: 'stopbonusfee',
    withdraw: 'withdraw'
} as const;

export type AtomicMarketActionName = keyof typeof AtomicMarketActions;

// An action before authorization is attached — what the sync builder returns.
export type EosioActionData = Omit<EosioActionObject, 'authorization'>;

// One royalty recipient share. The contract expects an integer weight; the
// builder coerces with Number() so callers may pass numeric strings.
export type RoyaltyRecipientInput = { recipient: string, weight: number | string };

// Normalized on-chain recipient pair.
export type RoyaltyPair = { recipient: string, weight: number };

// setroyalconf founders + category-split + attribute-mode config.
export type RoyaltyConfigInput = {
    founders: RoyaltyRecipientInput[],
    attribute_mode: number,
    split_founders: number,
    split_templates: number,
    split_attributes: number
};

// setattrroy value is an on-chain variant pair `[type, value]`, passed verbatim.
export type AttributeRoyaltyValue = [string, unknown];

// Sync builders for the AtomicMarket v2 royalty-config, sale-lifecycle, and
// RAM-payment actions, returning authorization-free {account, name, data}
// objects. None of these actions carry an `authorized_*` field in `data`. The
// signer is implicit in the transaction authorization, and adding one is not
// in the ABI and throws on encode. Numeric coercion rules follow the ABI:
// uint8/uint32/int32 fields go through Number(), while uint64 fields (rule_id,
// the listing ids, intended_delphi_median) are forwarded as strings because
// Number() corrupts values above 2^53 and eosio serializers accept string
// uint64s. `asset` and `symbol` fields are chain-notation strings
// ("1.00000000 WAX", "8,WAX"), passed verbatim.
export class MarketActionBuilder {
    constructor(readonly contract: string) {
    }

    setroyalconf(collection_name: string, config: RoyaltyConfigInput): EosioActionData[] {
        return this._pack('setroyalconf', {
            collection_name,
            founders: this._pairs(config.founders),
            attribute_mode: Number(config.attribute_mode),
            split_founders: Number(config.split_founders),
            split_templates: Number(config.split_templates),
            split_attributes: Number(config.split_attributes)
        });
    }

    settemplroy(collection_name: string, template_id: number | string, recipients: RoyaltyRecipientInput[]): EosioActionData[] {
        return this._pack('settemplroy', {
            collection_name,
            template_id: Number(template_id),
            recipients: this._pairs(recipients)
        });
    }

    setattrroy(
        collection_name: string, source: number, field: string,
        value: AttributeRoyaltyValue, rule_weight: number | string, recipients: RoyaltyRecipientInput[]
    ): EosioActionData[] {
        return this._pack('setattrroy', {
            collection_name,
            source: Number(source),
            field,
            value,
            rule_weight: Number(rule_weight),
            recipients: this._pairs(recipients)
        });
    }

    deltemplroy(collection_name: string, template_id: number | string): EosioActionData[] {
        return this._pack('deltemplroy', {
            collection_name,
            template_id: Number(template_id)
        });
    }

    delattrroy(collection_name: string, rule_id: string): EosioActionData[] {
        return this._pack('delattrroy', {
            collection_name,
            rule_id
        });
    }

    delroyalconf(collection_name: string): EosioActionData[] {
        return this._pack('delroyalconf', {collection_name});
    }

    announcesale(
        seller: string, asset_ids: string[], listing_price: string,
        settlement_symbol: string, maker_marketplace: string
    ): EosioActionData[] {
        return this._pack('announcesale', {
            seller,
            asset_ids,
            listing_price,
            settlement_symbol,
            maker_marketplace
        });
    }

    cancelsale(sale_id: string): EosioActionData[] {
        return this._pack('cancelsale', {sale_id});
    }

    assertsale(
        sale_id: string, asset_ids_to_assert: string[],
        listing_price_to_assert: string, settlement_symbol_to_assert: string
    ): EosioActionData[] {
        return this._pack('assertsale', {
            sale_id,
            asset_ids_to_assert,
            listing_price_to_assert,
            settlement_symbol_to_assert
        });
    }

    purchasesale(buyer: string, sale_id: string, intended_delphi_median: string, taker_marketplace: string): EosioActionData[] {
        return this._pack('purchasesale', {
            buyer,
            sale_id,
            intended_delphi_median,
            taker_marketplace
        });
    }

    // The RAM actions require only the payer's own authority on chain; they
    // are open actions any account may sign, in practice run by marketplaces
    // as maintenance.
    paysaleram(payer: string, sale_id: string): EosioActionData[] {
        return this._pack('paysaleram', {payer, sale_id});
    }

    payauctram(payer: string, auction_id: string): EosioActionData[] {
        return this._pack('payauctram', {payer, auction_id});
    }

    paybuyoram(payer: string, buyoffer_id: string): EosioActionData[] {
        return this._pack('paybuyoram', {payer, buyoffer_id});
    }

    protected _pairs(recipients: RoyaltyRecipientInput[]): RoyaltyPair[] {
        return recipients.map(({recipient, weight}) => ({recipient, weight: Number(weight)}));
    }

    protected _pack(name: string, data: any): EosioActionData[] {
        return [{account: this.contract, name, data}];
    }
}

// AtomicMarket v2 action generator. Mirrors the atomicassets ActionGenerator
// surface (async, authorization-first); the action payloads come from the sync
// MarketActionBuilder above.
export class MarketActionGenerator {
    protected readonly builder: MarketActionBuilder;

    constructor(readonly contract: string) {
        this.builder = new MarketActionBuilder(contract);
    }

    async setroyalconf(
        authorization: EosioAuthorizationObject[], collection_name: string, config: RoyaltyConfigInput
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.setroyalconf(collection_name, config));
    }

    async settemplroy(
        authorization: EosioAuthorizationObject[], collection_name: string,
        template_id: number | string, recipients: RoyaltyRecipientInput[]
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.settemplroy(collection_name, template_id, recipients));
    }

    async setattrroy(
        authorization: EosioAuthorizationObject[], collection_name: string, source: number,
        field: string, value: AttributeRoyaltyValue, rule_weight: number | string, recipients: RoyaltyRecipientInput[]
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.setattrroy(collection_name, source, field, value, rule_weight, recipients));
    }

    async deltemplroy(
        authorization: EosioAuthorizationObject[], collection_name: string, template_id: number | string
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.deltemplroy(collection_name, template_id));
    }

    async delattrroy(
        authorization: EosioAuthorizationObject[], collection_name: string, rule_id: string
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.delattrroy(collection_name, rule_id));
    }

    async delroyalconf(
        authorization: EosioAuthorizationObject[], collection_name: string
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.delroyalconf(collection_name));
    }

    async announcesale(
        authorization: EosioAuthorizationObject[], seller: string, asset_ids: string[],
        listing_price: string, settlement_symbol: string, maker_marketplace: string
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.announcesale(seller, asset_ids, listing_price, settlement_symbol, maker_marketplace));
    }

    async cancelsale(
        authorization: EosioAuthorizationObject[], sale_id: string
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.cancelsale(sale_id));
    }

    async assertsale(
        authorization: EosioAuthorizationObject[], sale_id: string, asset_ids_to_assert: string[],
        listing_price_to_assert: string, settlement_symbol_to_assert: string
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.assertsale(sale_id, asset_ids_to_assert, listing_price_to_assert, settlement_symbol_to_assert));
    }

    async purchasesale(
        authorization: EosioAuthorizationObject[], buyer: string, sale_id: string,
        intended_delphi_median: string, taker_marketplace: string
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.purchasesale(buyer, sale_id, intended_delphi_median, taker_marketplace));
    }

    async paysaleram(
        authorization: EosioAuthorizationObject[], payer: string, sale_id: string
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.paysaleram(payer, sale_id));
    }

    async payauctram(
        authorization: EosioAuthorizationObject[], payer: string, auction_id: string
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.payauctram(payer, auction_id));
    }

    async paybuyoram(
        authorization: EosioAuthorizationObject[], payer: string, buyoffer_id: string
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.paybuyoram(payer, buyoffer_id));
    }

    protected _authorize(authorization: EosioAuthorizationObject[], actions: EosioActionData[]): EosioActionObject[] {
        return actions.map((action) => ({...action, authorization}));
    }
}
