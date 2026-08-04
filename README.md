# @atomichub/atomicmarket

[![npm version](https://img.shields.io/npm/v/@atomichub/atomicmarket.svg)](https://www.npmjs.com/package/@atomichub/atomicmarket)
[![license](https://img.shields.io/npm/l/@atomichub/atomicmarket.svg)](https://github.com/atomicassets/atomicmarket-sdk/blob/main/LICENSE)

Read NFT market data from the [AtomicMarket](https://github.com/atomicassets/atomicmarket-contract) contract in JavaScript or TypeScript.

AtomicMarket is the marketplace contract that sits on top of the AtomicAssets NFT standard on WAX and other Antelope chains. It is where listings, auctions, buyoffers, and collection royalties live. This SDK gives you typed access to all of it, so asking what is currently for sale in a collection, and for how much, is one call that comes back with prices, token symbols, and the assets themselves already resolved.

If you are building a marketplace front end, a price tracker, a bot that posts sales, or anything that reports on NFT trading on these chains, this is the client library for it.

For the NFTs themselves rather than the market around them, use the companion package [@atomichub/atomicassets](https://github.com/atomicassets/atomicassets-sdk).

## Install

```sh
npm install @atomichub/atomicmarket
```

On Node.js the package requires version 20 or newer. Browsers and bundlers are supported through the ESM and IIFE builds. The package ships CJS, ESM, and a browser IIFE bundle (`build/atomicmarket.global.js`, global `atomicmarket`). Its only dependency is the sibling `@atomichub/atomicassets`.

## Quickstart

List what is currently for sale in a collection:

```ts
import { marketApiForNetwork, SaleState } from '@atomichub/atomicmarket';

const api = marketApiForNetwork('wax');

const sales = await api.getSales(
    { collection_name: 'mycollection', state: SaleState.Listed },
    1,
    20
);

for (const sale of sales) {
    const { amount, token_symbol, token_precision } = sale.price;

    // amount is an integer string in the token's smallest unit, so scale it
    // with BigInt. Dividing through a JS number loses digits once the value
    // passes 2^53.
    const unit = 10n ** BigInt(token_precision);
    const whole = BigInt(amount) / unit;
    const fraction = (BigInt(amount) % unit).toString().padStart(token_precision, '0');
    const price = token_precision > 0 ? `${whole}.${fraction}` : `${whole}`;

    console.log(sale.sale_id, sale.seller, `${price} ${token_symbol}`);
}
```

There is nothing to configure first. `marketApiForNetwork` points at AtomicHub's public endpoint for the network you name.

Examples here use top-level `await`, which needs an ES module. Under CommonJS, wrap them in an `async` function.

Prices arrive as integer strings with a separate precision, which is how the chain stores them. Scale with `BigInt` rather than dividing through a JS number: past 2^53 a number drops digits, so `123456789012345678` at precision 8 renders as `1234567890.12345672` instead of `...78`. Keep the raw string for comparing and storing, and convert only to display.

## Sales, auctions, and buyoffers

The three listing types have parallel methods, so what you learn on one carries to the others:

```ts
const sales = await api.getSales({ collection_name: 'mycollection' });
const auctions = await api.getAuctions({ collection_name: 'mycollection' });
const buyoffers = await api.getBuyoffers({ collection_name: 'mycollection' });

// One listing by id
const sale = await api.getSale('100');

// Totals for the same filters, which is what pagination needs
const total = await api.countSales({ collection_name: 'mycollection' });

// The history behind a listing
const logs = await api.getSaleLogs('100');
```

`SaleState` says where a listing stands: `Waiting`, `Listed`, `Canceled`, `Sold`, or `Invalid`. Filter on `SaleState.Listed` for "currently buyable", because the unfiltered call returns every sale the contract has ever recorded.

Each sale carries its `assets`, so rendering a listing usually needs no second call to the AtomicAssets API.

`getSalesV2` and `countSalesV2` query the `/v2/sales` route, a newer materialized index with the same row shape as `/v1/sales`. Note that `/v2/sales` omits `Waiting` sales, so state filters including `Waiting` belong on the v1 route.

### Supported networks

`wax`, `wax-testnet`, `vaulta`, `xpr`, `xpr-testnet`, `jungle4`.

Behind those endpoints is a hosted [atomicassets-api](https://github.com/atomicassets/atomicassets-api) indexer. Pass the constructor your own host if you run one, or a public host for a network without a preset:

```ts
import { AtomicMarketApi } from '@atomichub/atomicmarket';

const api = new AtomicMarketApi('https://my-indexer.example.com', 'atomicmarket', {});
```

The built-in `fetch` is used unless you pass your own in the options argument.

## Royalties

AtomicMarket v2 moved royalty configuration on chain, so a collection can split its fee between founders, specific templates, and assets matching an attribute. Those splits are readable:

```ts
// null when the collection has not configured royalties
const config = await api.getRoyaltyConfig('mycollection');

const templateRules = await api.getRoyaltyTemplateRules('mycollection');
const attributeRules = await api.getRoyaltyAttributeRules('mycollection');
```

## Writing royalty configuration

Reading needs no signing. To change a collection's royalty split, this SDK builds the action objects and hands them to whatever signing library you already use. It does not sign or broadcast anything itself.

```ts
import { MarketActionBuilder } from '@atomichub/atomicmarket';

const builder = new MarketActionBuilder('atomicmarket');

const actions = builder.setroyalconf('mycollection', {
    founders: [{ recipient: 'founderacct1', weight: 1 }],
    attribute_mode: 0,
    split_founders: 5000,
    split_templates: 2500,
    split_attributes: 2500
});
```

Splits are basis points, so those three are 50 percent, 25 percent, and 25 percent. The result plugs into a signing library such as [WharfKit](https://wharfkit.com/):

```ts
await session.transact({
    actions: actions.map((action) => ({
        ...action,
        authorization: [{ actor: 'authoracct11', permission: 'active' }]
    }))
});
```

`MarketActionBuilder` is synchronous and returns authorization-free `{account, name, data}` objects. If you would rather have authorization attached for you, `MarketActionGenerator` wraps the same builders.

## Building market actions

The sale lifecycle actions build the same way: unsigned action objects for your signing library. uint64 fields (the listing ids and `intended_delphi_median`) are strings so 64-bit values pass through without precision loss. Price fields use chain notation: `'100.00000000 WAX'` for an asset, `'8,WAX'` for a symbol.

```ts
import { MarketActionBuilder } from '@atomichub/atomicmarket';

const builder = new MarketActionBuilder('atomicmarket');

// Take a listing down
const cancel = builder.cancelsale('42');
```

The RAM payment actions move the RAM cost of a listing's table row onto the payer; the row itself is unchanged. Any account may pay, signing as the payer; no authority over the listing is needed. Marketplaces run them to sponsor their sellers' RAM.

```ts
const actions = builder.paysaleram('payeracct111', '42');
const auctionRam = builder.payauctram('payeracct111', '42');
const buyofferRam = builder.paybuyoram('payeracct111', '7');
```

Listing an asset and buying one are not single actions, though, and in both cases the action order, the memo literals, and which contract each action belongs to are rules of the contracts rather than choices. Those two flows come as composed helpers, so that knowledge lives here instead of in every integration. The actions they compose stay on the builder as well, for anything that needs to assemble its own transaction shape.

### Listing an asset

`announceSaleActions` returns the pair a listing takes: `announcesale` on the market contract, then AtomicAssets' `createoffer` handing the assets over to it with memo `'sale'`.

```ts
const listing = builder.announceSaleActions({
    seller: 'selleracct11',
    asset_ids: ['1099511627776'],
    listing_price: '100.00000000 WAX',
    settlement_symbol: '8,WAX',
    maker_marketplace: '', // '' for none, or your registered marketplace account
    assets_contract: 'atomicassets'
});
```

Announcing alone lists nothing and offering alone leaves the assets in an offer nobody accepts, so the two belong in one transaction.

### Buying a sale

`purchaseSaleActions` returns the purchase triple in the one order the contract accepts: `assertsale` pinning the terms you expect to buy, a transfer with memo `deposit` crediting the market contract, then `purchasesale` spending that credit.

```ts
const purchase = builder.purchaseSaleActions({
    buyer: 'buyeracct111',
    sale_id: '42',
    asset_ids: ['1099511627776'],
    listing_price: '100.00000000 WAX',
    settlement_symbol: '8,WAX',
    intended_delphi_median: '0',
    token_contract: 'eosio.token', // the settlement token's own contract, from IMarketToken.token_contract
    taker_marketplace: '' // '' for none, or your registered marketplace account
});
```

The deposit is a token transfer rather than an AtomicMarket action, which is why the helper needs `token_contract`. `assertsale` is what makes the triple safe to sign: if the sale changed between reading it and the transaction landing, the assertion fails and nothing moves.

`intended_delphi_median` is `'0'` for a sale listed directly in its settlement token, and that is the whole story for most sales.

### Delphi-priced sales

A sale can be listed in one currency and settled in another at the delphioracle rate, which is what a non-zero `intended_delphi_median` means. Its two price fields then describe two different symbols: `listing_price` is what the seller asked in the listing currency, and the buyer deposits what that converts to at the median. `assertsale` pins the listing terms only, so no on-chain check stands behind the deposit amount, which makes deriving it the step worth getting right.

`getConfig` carries the pair, `deriveSettlementAmount` converts, and `formatQuantity` renders the result as the quantity string the transfer takes:

```ts
import { deriveSettlementAmount, formatQuantity, marketApiForNetwork } from '@atomichub/atomicmarket';

const api = marketApiForNetwork('wax');
const sale = await api.getSale('42');
const config = await api.getConfig();

const pair = config.supported_pairs.find(
    (candidate) => candidate.listing_symbol === sale.listing_symbol
        && candidate.settlement_symbol === sale.price.token_symbol
);

if (!pair || !sale.price.median) {
    throw new Error(`sale ${sale.sale_id} is not a delphi sale this pair set covers`);
}

// Bound what the API served before converting it. A median past 2^53 has
// already lost precision at JSON parse, and a non-integer listing_price
// would surface as an opaque BigInt error instead of a named one.
if (!Number.isSafeInteger(sale.price.median) || sale.price.median <= 0) {
    throw new Error(`sale ${sale.sale_id}: median ${sale.price.median} is not a positive safe integer`);
}

if (!/^\d+$/.test(sale.listing_price)) {
    throw new Error(`sale ${sale.sale_id}: listing_price ${sale.listing_price} is not a raw integer amount`);
}

// The listing symbol sits on one side of the price feed or the other, and
// takes that side's precision.
const listingPrecision = sale.listing_symbol === pair.data.base_symbol
    ? pair.data.base_precision
    : pair.data.quote_precision;

const settlement = deriveSettlementAmount(BigInt(sale.listing_price), BigInt(sale.price.median), {
    median_precision: pair.data.median_precision,
    base_precision: pair.data.base_precision,
    quote_precision: pair.data.quote_precision,
    invert_delphi_pair: pair.invert_delphi_pair
});

// Whoever serves getConfig also controls the numbers deriveSettlementAmount
// works from, so the amount it derives and the amount this same response
// separately reports must agree before either is trusted.
if (!/^\d+$/.test(sale.price.amount) || BigInt(sale.price.amount) !== settlement) {
    throw new Error(`sale ${sale.sale_id}: price.amount ${sale.price.amount} does not match the median-derived expectation ${settlement.toString()} for listing_price ${sale.listing_price} ${sale.listing_symbol} at median ${sale.price.median}`);
}

const purchase = builder.purchaseSaleActions({
    buyer: 'buyeracct111',
    sale_id: sale.sale_id,
    asset_ids: sale.assets.map((asset) => asset.asset_id),
    listing_price: formatQuantity(BigInt(sale.listing_price), listingPrecision, sale.listing_symbol),
    settlement_symbol: `${sale.price.token_precision},${sale.price.token_symbol}`,
    settlement_quantity: formatQuantity(settlement, sale.price.token_precision, sale.price.token_symbol),
    intended_delphi_median: String(sale.price.median),
    token_contract: sale.price.token_contract,
    taker_marketplace: ''
});
```

Amounts on the wire are raw integers in their symbol's smallest unit, and the derivation stays in `BigInt` with a single floor, so it lands on the same integer the contract's own conversion produces rather than a value that drifts by a unit at large magnitudes. `invert_delphi_pair` says which way the underlying price feed is oriented, and it is the reason the listing precision is read off the matching side of the feed rather than assumed.

`settlement_quantity` is required whenever `intended_delphi_median` is not `'0'`. Without it the helper would deposit the listing price, which on a delphi sale is an amount in the wrong currency, so it throws instead.

### What the builders validate

Almost nothing, deliberately. These are composition helpers over values you already trust: they emit what you hand them, and checking a sale you read from an API is your side of that line. Two exceptions exist because their failure is a wrong payment rather than a rejected transaction: the missing `settlement_quantity` above, and the delphi utilities rejecting a non-positive median or a precision outside the 0 to 18 the chain allows, naming the field in the error. Bound anything else you read from a response before you trust it.

## What's new in 2.2.0

- `purchaseSaleActions` and `announceSaleActions` on `MarketActionBuilder` and `MarketActionGenerator`, composing the purchase triple and the listing pair.
- `deriveSettlementAmount` and `formatQuantity` for delphi-priced sales, with `DelphiPairSpec` projecting a supported pair from `getConfig`.
- `IMarketPair.data.quote_precision` is typed `number` rather than the literal `2`, so a pair reads straight into a `DelphiPairSpec`.

## What's new in 2.1.0

- Sale lifecycle actions on `MarketActionBuilder` and `MarketActionGenerator`: `announcesale`, `cancelsale`, `assertsale`, and `purchasesale`.
- RAM payment actions: `paysaleram`, `payauctram`, and `paybuyoram`.
- `getSalesV2` and `countSalesV2` for the `/v2/sales` route.
- `countOffers`, with `MarketOfferApiParams` widening `state` to comma-joined multi-state filters, and now shared by `getOffers`.

## What's new in 2.0.0

- Zero third-party runtime dependencies: the built-in `fetch` replaces node-fetch (a custom `fetch` can still be injected); the only dependency is the sibling `@atomichub/atomicassets`.
- Dual CJS/ESM output with bundled type declarations, plus a browser IIFE build.
- v2 royalty read endpoints: `getRoyaltyConfig`, `getRoyaltyTemplateRules`, and `getRoyaltyAttributeRules`.
- `MarketActionBuilder`, a synchronous builder for royalty-config actions.
- Typed on-chain table rows and the `AtomicMarketActions` action-name constants.
- Market API response-object, query-parameter, and enum types are exported from the package root; no deep `build/` imports needed.

## Migrating from atomicmarket 1.x

- Package name: `npm install @atomichub/atomicmarket` and change imports from `'atomicmarket'` to `'@atomichub/atomicmarket'`.
- Deep imports such as `atomicmarket/build/API/Explorer/Params` are replaced by root exports: `import { SaleApiParams } from '@atomichub/atomicmarket'`.
- Numeric ABI fields (`template_id`, weights, splits) are numbers; 64-bit id fields (sale ids, rule ids) remain strings.
- Node.js 20 or newer is required.

## Credits and license

Fork of [atomicmarket-js](https://github.com/pinknetworkx/atomicmarket-js) by pink.network, updated for the v2 AtomicMarket contract. Maintained by AtomicHub.

MIT licensed; see [LICENSE](https://github.com/atomicassets/atomicmarket-sdk/blob/main/LICENSE) for the full text including the original pink.network copyright.
