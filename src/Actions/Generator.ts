import type { EosioActionObject, EosioAuthorizationObject } from '@atomichub/atomicassets';
import { ActionBuilder } from '@atomichub/atomicassets';

import { namesSameSymbol } from './Symbols';

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

// Everything the purchase triple needs. uint64-shaped fields (sale_id, the
// asset_ids entries, intended_delphi_median) are verbatim strings per this
// package's numeric policy; listing_price and settlement_quantity are chain
// quantity strings and settlement_symbol is chain symbol notation.
export type PurchaseSaleInput = {
    buyer: string,
    sale_id: string,
    // Exactly one id on AtomicMarket v2: announcesale rejects a listing of any
    // other size, so every sale row it writes holds a single asset. A row
    // holding more is a legacy bundle, and buying one on v2 costs the buyer the
    // deposit and returns nothing. allow_v1_bundle_sale below is the opt-out
    // for a chain running v1, where bundles are ordinary listings.
    asset_ids: string[],
    listing_price: string,
    settlement_symbol: string,
    intended_delphi_median: string,
    // Required whenever settlement_symbol is not listing_price's own symbol:
    // such a sale settles through the oracle, in a symbol the listing price is
    // not denominated in, so the deposit cannot reuse listing_price. Optional
    // when the two name one symbol, where the contract settles the listed
    // quantity itself; supplying it there is fine and common, but it must equal
    // listing_price exactly.
    settlement_quantity?: string,
    token_contract: string,
    taker_marketplace: string,
    // Opt out of the single-asset rule, for a buyer on a chain still running
    // AtomicMarket v1. Bundle sales are ordinary listings there and purchase
    // correctly, v1 having neither v2's early return nor its single-asset
    // check. On v2 the same transaction commits with the buyer paid and nothing
    // delivered, which is why it is off unless asked for.
    allow_v1_bundle_sale?: boolean
};

// Everything the listing pair needs. assets_contract is the AtomicAssets
// contract the offered assets live on ('atomicassets' on every current chain).
export type AnnounceSaleInput = {
    seller: string,
    // One id per listing on v2, where announcesale refuses a bundle outright
    // and asks for one sale per asset instead; several sales may still be
    // announced in a single transaction. A chain still on v1 takes bundles.
    asset_ids: string[],
    listing_price: string,
    settlement_symbol: string,
    maker_marketplace: string,
    assets_contract: string
};

// Sync builders for the AtomicMarket v2 royalty-config, sale-lifecycle,
// RAM-payment, marketplace-registration, and balance-withdrawal actions,
// returning authorization-free {account, name, data} objects. None of
// these actions carry an `authorized_*` field in `data`. The signer is
// implicit in the transaction authorization, and adding one is not in the
// ABI and throws on encode. Numeric coercion rules follow the ABI:
// uint8/uint32/int32 fields go through Number(), while uint64 fields
// (rule_id, the listing ids, intended_delphi_median) are forwarded as
// strings because Number() corrupts values above 2^53 and eosio
// serializers accept string uint64s. `asset` and `symbol` fields are
// chain-notation strings ("1.00000000 WAX", "8,WAX"), passed verbatim.
//
// The six royalty builders address actions v2 introduced. A chain still running
// v1 carries none of them in its ABI, so a signing library there fails to
// serialize the data rather than reaching a chain that would refuse it:
// on-chain royalty configuration is a v2 capability, not something a v1
// collection can be talked into.
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

    // regmarket registers a marketplace name for use in the sale/auction
    // actions' *_marketplace fields; withdraw returns balance tokens to their
    // owner.
    //
    // withdraw needs the owner's own authority and nothing else. regmarket
    // needs the creator's as its first gate, and then the name itself decides
    // what else: a marketplace_name that is already an account needs that
    // account's authorization too, one carrying a suffix needs the suffix's,
    // and a name that is neither must be exactly 12 characters. So a
    // marketplace cannot be registered under a name someone else answers to
    // without them signing for it, and a transaction authorized by the creator
    // alone still fails on any name that is not 12 characters.
    regmarket(creator: string, marketplace_name: string): EosioActionData[] {
        return this._pack('regmarket', {creator, marketplace_name});
    }

    withdraw(owner: string, token_to_withdraw: string): EosioActionData[] {
        return this._pack('withdraw', {owner, token_to_withdraw});
    }

    // Neither a purchase nor a listing is a single action, and each one's
    // action order, memo literals, and owning contract are contract rules
    // rather than caller preferences. The two helpers below compose them so
    // that knowledge lives here instead of in every integration.

    // The purchase triple: assert the terms being bought, deposit the
    // settlement quantity into the market contract's balance, then purchase
    // against that balance. The transfer belongs to the settlement token's own
    // contract, not to AtomicMarket.
    //
    // Only the purchase's place is fixed. It spends the deposited balance and
    // erases the sale row assertsale reads, so both of the others must precede
    // it, while assertsale reads the sales table and writes nothing, leaving it
    // and the deposit free to swap. This is the order the helper emits rather
    // than the only order the contract takes.
    purchaseSaleActions(input: PurchaseSaleInput): EosioActionData[] {
        // The contract's own discriminator: calc_settlement_price returns the
        // listing price unchanged when the sale's two symbol fields name one
        // symbol, and converts through the oracle when they do not. It is the
        // whole symbol that decides, precision included, so a sale listing
        // '30.00 WAX' against '8,WAX' names two symbols and settles through a
        // registered pair like any other. Whether that pair is registered is
        // chain state, and none of these checks are entitled to an opinion
        // on it.
        const settlesItsListingSymbol = namesSameSymbol(input.listing_price, input.settlement_symbol);

        // The only caller error found that the chain neither reverts nor
        // refuses. purchasesale on v2 returns early for a sale row holding more
        // than one asset id: it declines the offer, erases the row, and returns
        // before reaching any balance. assertsale has already passed, the ids,
        // price and symbol all matching the row it is asserting, and the
        // deposit has already credited the buyer, so the transaction commits
        // with the buyer paid, nothing delivered, and the tokens recoverable
        // only through a separate withdraw. It is decidable from asset_ids
        // alone, which is what puts it on this side of the line.
        if (input.asset_ids.length > 1 && !input.allow_v1_bundle_sale) {
            throw new Error(
                `asset_ids carries ${input.asset_ids.length} ids and a purchase takes exactly one: `
                + 'AtomicMarket v2 declines a sale of several assets and erases it without paying out, '
                + 'after the deposit has already credited the buyer, so the buyer pays and receives nothing. '
                + 'Pass allow_v1_bundle_sale to buy a bundle on a chain still running AtomicMarket v1'
            );
        }

        if (settlesItsListingSymbol) {
            // The precondition the plain branch of calc_settlement_price
            // carries, mirrored because it is decidable from the two fields the
            // contract itself compares: a nonzero median on a sale that settles
            // what it lists is a transaction no chain state can make land.
            if (input.intended_delphi_median !== '0') {
                throw new Error(
                    `intended_delphi_median "${input.intended_delphi_median}" must be "0" when listing_price `
                    + `"${input.listing_price}" and settlement_symbol "${input.settlement_symbol}" name one symbol: `
                    + 'the contract reads a median only for a sale settling a symbol it did not price in'
                );
            }

            // The check nothing on chain stands behind. That same branch settles
            // the listed quantity itself, so a divergent settlement_quantity deposits
            // an amount the purchase never spends: short, and it draws the
            // difference from whatever balance the buyer already holds; over, and
            // the surplus stays in the market's balance table until they withdraw
            // it. Only a supplied one is checked, because omitting it is how the
            // type documents this case and the transfer then reuses listing_price
            // anyway.
            if (input.settlement_quantity !== undefined && input.settlement_quantity !== input.listing_price) {
                throw new Error(
                    `settlement_quantity "${input.settlement_quantity}" does not match `
                    + `listing_price "${input.listing_price}": a sale settling the symbol it priced in `
                    + 'settles that exact quantity'
                );
            }
        } else {
            // The settlement amount is then the oracle conversion of the listing
            // price, which listing_price is not, so falling back to it would
            // deposit an amount denominated in the wrong symbol with nothing on
            // chain to catch it: assertsale pins the listing terms, never the
            // deposit.
            if (input.settlement_quantity === undefined) {
                throw new Error(
                    `settlement_quantity is required when listing_price "${input.listing_price}" and `
                    + `settlement_symbol "${input.settlement_symbol}" name different symbols: `
                    + 'such a sale settles the oracle conversion of its listing price, not the price itself'
                );
            }

            // Requiring the quantity says nothing about what it is denominated
            // in, and the same wrong-payment failure the plain branch guards
            // sits here: a deposit in another symbol credits a balance the
            // purchase never spends, while the settlement amount is drawn from
            // whatever the buyer already holds in the symbol that settles.
            if (!namesSameSymbol(input.settlement_quantity, input.settlement_symbol)) {
                throw new Error(
                    `settlement_quantity "${input.settlement_quantity}" is not denominated in `
                    + `settlement_symbol "${input.settlement_symbol}": the deposit funds the purchase, `
                    + 'and the purchase spends the settlement symbol'
                );
            }
        }

        return [
            ...this.assertsale(input.sale_id, input.asset_ids, input.listing_price, input.settlement_symbol),
            {
                account: input.token_contract,
                name: 'transfer',
                data: {
                    from: input.buyer,
                    to: this.contract,
                    quantity: input.settlement_quantity ?? input.listing_price,
                    memo: 'deposit'
                }
            },
            ...this.purchasesale(input.buyer, input.sale_id, input.intended_delphi_median, input.taker_marketplace)
        ];
    }

    // The listing pair. Announcing alone lists nothing and offering alone
    // dangles, so the two belong in one transaction; the offer is an
    // AtomicAssets action, built by that contract's own builder.
    //
    // Nothing about the symbols is checked. announcesale accepts a listing
    // priced in its settlement symbol if that symbol is a supported token, and
    // one priced in another if the two are a registered pair, and both of those
    // are chain state this helper is not handed. Either refusal is a
    // transaction the chain rejects, which is the far side of the line these
    // helpers hold.
    announceSaleActions(input: AnnounceSaleInput): EosioActionData[] {
        return [
            ...this.announcesale(
                input.seller, input.asset_ids, input.listing_price, input.settlement_symbol, input.maker_marketplace
            ),
            new ActionBuilder(input.assets_contract).createoffer(
                input.seller, this.contract, input.asset_ids, [], 'sale'
            )
        ];
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

    async regmarket(
        authorization: EosioAuthorizationObject[], creator: string, marketplace_name: string
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.regmarket(creator, marketplace_name));
    }

    async withdraw(
        authorization: EosioAuthorizationObject[], owner: string, token_to_withdraw: string
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.withdraw(owner, token_to_withdraw));
    }

    async purchaseSaleActions(
        authorization: EosioAuthorizationObject[], input: PurchaseSaleInput
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.purchaseSaleActions(input));
    }

    async announceSaleActions(
        authorization: EosioAuthorizationObject[], input: AnnounceSaleInput
    ): Promise<EosioActionObject[]> {
        return this._authorize(authorization, this.builder.announceSaleActions(input));
    }

    protected _authorize(authorization: EosioAuthorizationObject[], actions: EosioActionData[]): EosioActionObject[] {
        return actions.map((action) => ({...action, authorization}));
    }
}
