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

What the collection has actually paid is a separate read. The indexer keeps one ledger row for every royalty the contract settled, and aggregates one account's rows per token:

```ts
const payouts = await api.getRoyaltyPayouts({
    collection_name: 'mycollection',
    recipient: 'founderacct1',
    category: 'template'
}, 1, 100);

const settled = await api.countRoyaltyPayouts({collection_name: 'mycollection'});

// one row per token symbol the account has been paid in
const earned = await api.getRoyaltyAccount('founderacct1');
```

`amount` is in raw token units, so read it against the `token_precision` of the same row: `5000000` at precision 8 is `0.05000000 WAX`. The same holds for the `amount` on a `getRoyaltyAccount` row, which sums the payouts the filters admit, and its `payout_count` is a decimal string rather than a number.

`category` names the rule that paid, one of `founders`, `template`, `attribute`, or `dust`, and it tells you which linkage the row carries: a template payout sets `template_id`, an attribute payout sets `rule_id`, and a founders or dust payout sets neither. A dust row is the rounding remainder plus the author fallback, paid to the collection author, and it names no asset either. `listing_id` is null when `listing_type` is `unresolved`, which is the row the indexer keeps when it cannot trace a settlement back to the listing that triggered it. A row whose stored value falls outside the vocabulary this SDK serves reads null for both `listing_type` and `category`.

The ledger pages like the listing routes. It sorts newest first by default, takes `sort` of `created` or `amount`, `order` of `asc` or `desc`, a `limit` up to 100, and `lower_bound`, `upper_bound`, or `ids` over `log_global_sequence`. `RoyaltyListingType`, `RoyaltyPayoutCategory`, and `RoyaltyPayoutSort` are exported for the filter values.

On a chain still running AtomicMarket v1 the contract logs no payouts and configures no royalties, so the ledger reads empty, the count is zero, and every collection answers `getRoyaltyConfig` with null. An indexer built before the royalty routes existed is a different case: it answers 404, which arrives as an `ApiError` with `status` 404 from every one of these methods. Only the HTTP 416 that `getRoyaltyConfig` receives for a collection with no royalty config becomes null; the ledger and count routes return empty results instead, never null.

## Writing royalty configuration

Reading needs no signing. To change a collection's royalty split, this SDK builds the action objects and hands them to whatever signing library you already use. It does not sign or broadcast anything itself.

The six royalty actions arrived with v2. A chain still running AtomicMarket v1 carries none of them in its ABI, so on such a chain a signing library cannot serialize what these builders return, let alone submit it.

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

Those three numbers are relative weights, not basis points and not percentages. At settlement each asset is weighed against only the categories that have a payee for it, and the weights are renormalized across those, so that no share is stranded. The 5000/2500/2500 above pays founders two thirds and the template one third on an asset that has a template royalty row and matches no attribute rule, and pays founders the entire fee on an asset with neither. Where no category has a payee, the whole share goes to the collection author.

The result plugs into a signing library such as [WharfKit](https://wharfkit.com/):

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

The sale, auction, buyoffer, and template-buyoffer actions build the same way: unsigned action objects for your signing library. uint64 fields (the sale, auction, and buyoffer ids, the asset and template ids, and `intended_delphi_median`) are strings so 64-bit values pass through without precision loss. Price fields use chain notation: `'100.00000000 WAX'` for an asset, `'8,WAX'` for a symbol.

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

Several of these flows are not single actions, though, and in each case the action order, the memo literals, and which contract each action belongs to are rules of the contracts rather than choices. Those flows come as composed helpers, so that knowledge lives here instead of in every integration. The actions they compose stay on the builder as well, for anything that needs to assemble its own transaction shape, with two exceptions noted below where building the action alone is not safe.

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

A v2 listing holds exactly one asset. `announcesale` rejects any other size and asks for one sale per asset instead, which one transaction can announce several of. A chain still running v1 takes bundle listings, and this helper builds whatever it is handed either way, since a refused listing is a rejected transaction and nothing is lost to it.

Nothing about the symbols is checked here. `announcesale` takes a listing whose `settlement_symbol` is its price's own symbol if that symbol is a supported token, and one whose settlement symbol is anything else if the two are a registered pair, so both readings are legitimate and which one your listing gets is chain state this helper is not handed.

### Buying a sale

`purchaseSaleActions` returns the purchase triple: `assertsale` pinning the terms you expect to buy, a transfer with memo `deposit` crediting the market contract, then `purchasesale` spending that credit. Only the purchase's place is fixed, since it spends the deposited balance and erases the sale row the assertion reads; the assertion writes nothing, so a transaction assembling itself from the raw builders may equally deposit first.

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

The deposit is a token transfer rather than an AtomicMarket action, which is why the helper needs `token_contract`. `assertsale` is what makes the triple safe against a sale that changed between reading it and the transaction landing: if the ids, the price, or the settlement symbol have moved, the assertion fails and nothing does.

It does not cover a sale of several assets. `purchasesale` on v2 returns early for such a row, declining the offer and erasing the listing before it reaches a balance, while `assertsale` passes on the very ids that made it return and the deposit has already credited the buyer. The transaction commits, and the buyer has paid for nothing and must `withdraw` to get the tokens back. So `purchaseSaleActions` throws on more than one `asset_ids` entry. Bundles are ordinary listings on a chain still running v1, where they purchase correctly, and `allow_v1_bundle_sale: true` is the opt-out for buying one there.

`intended_delphi_median` is `'0'` for a sale listed directly in its settlement token, and that is the whole story for most sales. The contract settles such a sale at its listing price, so `settlement_quantity` may be omitted; supplying it is fine, and common, but it must then equal `listing_price` exactly, since the deposit is what funds the purchase and the purchase spends the listed amount whatever you deposited.

A sale is that one exactly when `settlement_symbol` is `listing_price`'s own symbol, which means the precision as well as the code: `'100.00000000 WAX'` settles `'8,WAX'`, and the same price against `'4,WAX'` names two different symbols and settles through the oracle like any other pair.

### Delphi-priced sales

A sale can be listed in one currency and settled in another at the delphioracle rate, which is what a `settlement_symbol` other than the listing price's own symbol means, and what a non-zero `intended_delphi_median` accompanies. Its two price fields then describe two different symbols: `listing_price` is what the seller asked in the listing currency, and the buyer deposits what that converts to at the median. `assertsale` pins the listing terms only, so no on-chain check stands behind the deposit amount, which makes deriving it the step worth getting right.

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
// separately reports should agree before either is trusted. An indexer
// converts in its own arithmetic rather than the contract's, and the two can
// drift by the last place of the contract's double: one raw unit at ordinary
// magnitudes, proportionally more past 2^53. Anything wider than that is a
// disagreement rather than rounding, and a reason to stop.
const reported = /^\d+$/.test(sale.price.amount) ? BigInt(sale.price.amount) : undefined;
const drift = reported === undefined ? undefined
    : settlement > reported ? settlement - reported : reported - settlement;

// One raw unit, widened by the spacing of doubles at this magnitude.
const tolerance = 1n + settlement / 2n ** 52n;

if (drift === undefined || drift > tolerance) {
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

Amounts on the wire are raw integers in their symbol's smallest unit, and `deriveSettlementAmount` returns the integer the contract charges rather than the exact quotient of those integers. The two are not always the same one. The contract divides and scales in double-precision floating point and truncates the result, so on the WAX/USD pair it lands one raw unit above the exact floor on a small fraction of listing amounts from about $12,124 up, and a deposit derived from the exact floor is then a unit short of what the purchase spends. The derivation reproduces the contract's arithmetic operation for operation so that the amount you deposit is the amount that is taken.

Two cases have no amount to reproduce and throw instead. A pair whose exponent works out negative, meaning the settlement symbol carries fewer decimals than the median and listing symbols together call for, is one the contract cannot convert at all: it computes that exponent in unsigned arithmetic, where a negative one becomes an enormous positive one and the conversion overflows. And a result at or past 2^64 has no integer for the contract to charge. Past 2^53 the derivation keeps returning values, with the caveat that the contract's own double no longer represents the quotient exactly there, so the amount charged can sit some way off it in either direction; that is the contract's arithmetic, and matching it is the point.

`invert_delphi_pair` says which way the underlying price feed is oriented, and it is the reason the listing precision is read off the matching side of the feed rather than assumed.

`settlement_quantity` is required whenever `settlement_symbol` is not the listing price's own symbol, and it must be denominated in that settlement symbol. Without it the helper would deposit the listing price, which on such a sale is an amount in the wrong currency; with a quantity in some third symbol the deposit credits a balance the purchase never spends, while the real settlement amount is drawn from whatever the buyer already holds in the right one. Both throw.

### Auctions

An auction is announced and then activated. `announceauct` writes the row, and the auction becomes biddable only once the seller transfers the assets into the market contract's custody with memo `'auction'`. `announceAuctionActions` returns that pair.

```ts
const auction = builder.announceAuctionActions({
    seller: 'selleracct11',
    asset_ids: ['1099511627776'],
    starting_bid: '10.00000000 WAX',
    duration: 86400, // seconds
    maker_marketplace: '', // '' for none, or your registered marketplace account
    assets_contract: 'atomicassets'
});
```

The order is the contract's rather than the helper's: the transfer's handler looks an announced auction up by its assets and its seller, so a transfer arriving first has nothing to activate and fails. Where a sale takes an AtomicAssets offer, an auction takes a transfer, and the assets sit in the market contract's custody for the auction's whole duration rather than in an offer until someone buys.

`duration` is the one field here read as a number, and it is checked for being a whole number inside the uint32 range before it is packed, so a `NaN` cannot reach your signing library as a `null`. Whether it also falls inside the contract config's minimum and maximum, whether the starting bid's symbol is supported, and whether the marketplace is registered are chain state, and each refusal is a rejected transaction.

The rest of the lifecycle is plain builders:

```ts
// Pair an assertion with a bid the way assertsale pairs with a purchase
const assertion = builder.assertauct('42', ['1099511627776']);
const bid = builder.auctionbid('bidderacct11', '42', '11.00000000 WAX', '');

const claimedByBuyer = builder.auctclaimbuy('42');  // the winner takes the assets
const claimedBySeller = builder.auctclaimsel('42'); // the seller takes the bid, less fees
const cancelled = builder.cancelauct('42');         // only before a bid lands
```

A bid is spent from the bidder's balance inside the market contract rather than from their wallet, so fund it first with a transfer carrying memo `deposit`. An outbid bid returns to its bidder's balance the same way, and `withdraw` is what moves a balance back out.

An auction row holding more than one asset predates v2's removal of bundle listings and can no longer be bid on or claimed. Bidding on one, claiming one, or cancelling one dissolves it instead: the standing bid returns to the bidder's balance, the assets return to the seller, the row is erased, and the transaction commits. Nothing guards against that, since these actions are handed an auction id and this SDK cannot see how many assets the row holds, and a bundle row is an ordinary auction on a chain still running v1. Nothing is stranded either way, which is what keeps it on the documented side of the line.

### Buyoffers

A buyoffer is an unsolicited bid on an asset somebody else owns. The buyer escrows the price with `createbuyo`, and the recipient accepts or declines it.

```ts
const wanted = builder.createbuyo(
    'buyeracct111', 'holderacct11', '100.00000000 WAX', ['1099511627776'], 'please sell', ''
);

const withdrawn = builder.cancelbuyo('7');                // the buyer changes their mind
const refused = builder.declinebuyo('7', 'not for sale'); // the recipient says no
```

`createbuyo` spends the price from the buyer's market balance, the way a bid does, so a deposit transfer usually comes first. Cancelling and declining both return it.

Accepting is a composed flow, because the contract takes no offer id. `acceptbuyo` reads the globally last created row of the AtomicAssets offers table and checks it against the buyoffer, so the offer has to be created in the same transaction, immediately before it:

```ts
const accepted = builder.acceptBuyofferActions({
    recipient: 'holderacct11', // signs the transaction, and sends the offer
    buyoffer_id: '7',
    asset_ids: ['1099511627776'],
    expected_price: '100.00000000 WAX',
    taker_marketplace: '',
    assets_contract: 'atomicassets'
});
```

No other `createoffer` may run between this helper's `createoffer` and the market action: the contract would read that one instead, and every check it makes against the offer would fail against it. Appending further actions after the market action, including another accept flow, is safe, the inline `acceptoffer` having consumed the row by then. Do not accept the offer yourself either, since the market contract sends that `acceptoffer`, and an offer already accepted is gone from the table before the contract can find it. That is why `acceptbuyo` is reachable only through this helper.

`acceptBuyofferActions` throws on more than one entry in `asset_ids`. It is the one place in these families where a mistake commits and leaves damage behind rather than reverting: `acceptbuyo` on v2 returns early for a buyoffer row holding several assets, refunding the buyer and erasing the row before it reads the offers table at all, so the transaction lands with nothing sold and the offer this flow created still in the offers table on the recipient's RAM, neither accepted nor declined, until they cancel it. Bundle buyoffers accept correctly on a chain still running v1, and `allow_v1_bundle_buyoffer: true` is the opt-out for one there.

### Template buyoffers

A template buyoffer is a standing bid on any asset of a template rather than on one particular asset, so any holder of that template can fill it.

```ts
const wanted = builder.createtbuyo('buyeracct111', '100.00000000 WAX', 'mycollection', '1234', '');
const withdrawn = builder.canceltbuyo('9');
```

`template_id` is a uint64 on these actions and passes through as a string, unlike the int32 `template_id` the royalty builders take. They are two different ABI types on different actions.

Filling one reads the offers table exactly as accepting a buyoffer does, with memo `'tbuyoffer'`, and `fulfillTemplateBuyofferActions` composes that pair:

```ts
const fulfilled = builder.fulfillTemplateBuyofferActions({
    seller: 'selleracct11', // signs the transaction, and sends the offer
    buyoffer_id: '9',
    asset_id: '1099511627776', // must carry the template the buyoffer names
    expected_price: '100.00000000 WAX',
    taker_marketplace: '',
    assets_contract: 'atomicassets'
});
```

The same-transaction rule and the no-other-`createoffer` rule hold unchanged, and `fulfilltbuyo` is likewise reachable only through this helper. This one carries no bundle guard, a template buyoffer naming a single asset by construction.

### What the builders validate

Almost nothing, deliberately. These are composition helpers over values you already trust: they emit what you hand them, and checking a sale you read from an API is your side of that line. The exceptions all share one property, that their failure is a wrong payment rather than a rejected transaction, and each names the offending values in the error:

- `purchaseSaleActions` throws on more than one entry in `asset_ids`, unless `allow_v1_bundle_sale` says the chain is still on v1.
- `purchaseSaleActions` requires `settlement_quantity`, denominated in `settlement_symbol`, when that symbol is not the listing price's own; and when it is, requires a supplied one to equal `listing_price` and `intended_delphi_median` to be `'0'`.
- `acceptBuyofferActions` throws on more than one entry in `asset_ids`, unless `allow_v1_bundle_buyoffer` says the chain is still on v1.
- `announceauct` refuses a `duration` that is not a whole number inside the uint32 range, which is a serialization bound rather than a chain rule: the configured minimum and maximum are chain state and go unchecked.
- The delphi utilities reject a non-positive median, a precision outside the 0 to 18 the chain allows, and a pair the contract's own conversion cannot compute.

The symbol checks turn on the discriminator the contract itself uses, whether the sale's two symbol fields name a single symbol, precision and code both.

Two of them do foreclose a purchase the chain would have taken, deliberately. Requiring a supplied `settlement_quantity` to equal `listing_price` rules out depositing more than the sale costs, which the chain accepts and leaves as balance. Requiring one at all on the oracle branch rules out depositing nothing and letting a standing balance pay, which the chain also accepts. Both are legitimate for a caller who means them and indistinguishable from a wrong amount for one who does not, and the helper cannot see a balance to tell them apart. If you want either, assemble the transaction from `assertsale`, your own transfer, and `purchasesale` on the builder, which assert nothing.

Nothing here reads chain state. Whether a symbol is supported, and whether a pairing of two is registered, is chain state, which is why `announceSaleActions` checks nothing at all and why the settlement amount an oracle-settled sale deposits goes unchecked here, the helper never being handed the pair it derives from. Bound anything else you read from a response before you trust it.

## What's new in 2.4.0

Reads the settled royalty ledger, so a consumer no longer has to page the payout logs itself.

### Breaking changes

- `IRoyaltyConfig`, `IRoyaltyTemplateRule`, and `IRoyaltyAttributeRule` gain required `market_contract`, `collection_name`, and timestamp fields, and the attribute rule gains `lookup_hash`. Reading a response is unaffected. Code that builds one of these rows by hand, such as a test mock, must supply the added fields. (#23)

### Features

- `getRoyaltyPayouts`, `countRoyaltyPayouts`, and `getRoyaltyAccount` cover the AtomicMarket v2 payout ledger: every settled royalty, the count behind it, and one account's totals per token symbol. Payout filters travel as `RoyaltyPayoutApiParams`, whose primary boundary ranges over `log_global_sequence`. The account totals take the date window alone, because that route groups the boundary column away. (#23)
- `IRoyaltyPayout` and `IRoyaltyAccountTotal` type the two new row shapes, and `RoyaltyListingType`, `RoyaltyPayoutCategory`, and `RoyaltyPayoutSort` pin the strings the indexer serves and filters on. (#23)
- `IRoyaltyConfig`, `IRoyaltyTemplateRule`, and `IRoyaltyAttributeRule` carry the `market_contract`, `collection_name`, and four timestamps of their rows, and the attribute rule also carries its `lookup_hash`. (#23)

## What's new in 2.3.0

Adds the auction, buy-offer and template-buy-offer builders and aligns the purchase path with the v2 contract.

### Breaking changes

- `purchaseSaleActions` throws when `asset_ids` has more than one entry. On AtomicMarket v2 a bundle purchase commits with the buyer charged and nothing delivered. Set `allow_v1_bundle_sale: true` on chains still running v1, where bundles are ordinary listings. (#19)
- `deriveSettlementAmount` matches the contract's own conversion instead of the exact quotient: where the contract's double arithmetic lands one raw unit above the exact floor, so does the SDK, and that unit is the difference between a deposit that funds the purchase and one that leaves it short. It throws on a pair with a negative exponent and on a result at or past 2^64. (#19)
- `purchaseSaleActions` requires `settlement_quantity` in `settlement_symbol` on the cross-symbol branch, and on a same-symbol sale it must equal `listing_price` with `intended_delphi_median` set to `'0'`. (#19)
- `purchaseSaleActions` picks its branch from the contract's settlement discriminator, full symbol equality between `listing_price` and `settlement_symbol`. A settlement symbol differing from the price in precision alone therefore settles through the oracle rather than reading as a mismatch. (#19)

### Features

- Adds auction, buy-offer and template-buy-offer actions to `MarketActionBuilder` and `MarketActionGenerator`: `announceauct`, `cancelauct`, `auctionbid`, `auctclaimbuy`, `auctclaimsel`, `assertauct`, `createbuyo`, `cancelbuyo`, `declinebuyo`, `createtbuyo`, `canceltbuyo`. (#20)
- `announceAuctionActions`, `acceptBuyofferActions` and `fulfillTemplateBuyofferActions` compose the multi-action flows. `acceptbuyo` and `fulfilltbuyo` read the last created row of the AtomicAssets offers table, so neither is safe to build alone and both are reachable only through these helpers. (#20)
- `AnnounceAuctionInput`, `AcceptBuyofferInput` and `FulfillTemplateBuyofferInput` are exported beside `PurchaseSaleInput` and `AnnounceSaleInput`. (#20)

### Other changes

- `sideEffects: false` in `package.json`, matching the sibling `@atomichub/atomicassets` package, so bundlers may drop the package from builds that import nothing from it. (#19)

## What's new in 2.2.1

### Bug fixes

- The Explorer client percent-encodes caller-supplied path ids and custom data-filter keys, across the twelve path-building methods and the query-string builder. A sale id, marketplace or collection name, or `DataOptions` key carrying `/`, `?`, `#`, `&`, or `=` used to escape its own segment and reshape the request path or query. Hostile input now stays a value. (#17)

### Other changes

- Typed data filters travel as `data%3Anumber.field` rather than `data:number.field`. Standards query parsers percent-decode keys before matching, so servers see the same key. This is confirmed against the live API, where the encoded and raw forms return identical filtered rows. The plain `data.field` form is unchanged. (#17)

## What's new in 2.2.0

Composes the purchase and listing flows and adds the delphi settlement helpers.

### Features

- `purchaseSaleActions` composes `assertsale`, the deposit transfer, and `purchasesale`. `announceSaleActions` composes `announcesale` and the atomicassets `createoffer` carrying the sale memo. Both emit authorization-free action data in the order the market contract expects. (#16)
- `purchaseSaleActions` throws when a delphi-priced sale arrives without a `settlement_quantity`, because that omission pays the wrong amount rather than failing the transaction. (#16)
- `deriveSettlementAmount` reproduces the market contract's settlement math with `BigInt`, the float formula losing precision at on-chain magnitudes. `formatQuantity` renders raw integer amounts as chain quantities. (#16)
- `DelphiPairSpec` projects a supported pair from `getConfig` and rejects a non-positive median or a precision outside the chain's 0 to 18, naming the field in the error. (#16)
- `IMarketPair.data.quote_precision` is typed `number` rather than the literal `2`, so a pair read from the API feeds a `DelphiPairSpec` directly. (#16)
- `regmarket` and `withdraw` action builders cover marketplace registration and market-balance withdrawal. (#15)

## What's new in 2.1.0

Adds the sale lifecycle and RAM payment actions, plus the `/v2/sales` routes.

### Features

- Adds the sale lifecycle actions to `MarketActionBuilder` and `MarketActionGenerator`: `announcesale`, `cancelsale`, `assertsale`, `purchasesale`. The uint64 fields, the listing ids and `intended_delphi_median`, are strings, so 64-bit values pass through without precision loss. (#14)
- RAM payment actions `paysaleram`, `payauctram` and `paybuyoram` move the RAM cost of a listing's table row onto the payer. Any account may pay, signing as the payer. (#14)
- Adds `getSalesV2` and `countSalesV2` for the `/v2/sales` route, a newer materialized index with the same row shape as `/v1/sales`. `/v2/sales` omits Waiting sales, so a state filter that includes Waiting belongs on the v1 route. (#14)
- `countOffers` joins `getOffers`, both taking the new `MarketOfferApiParams`, which widens the state filter to comma-joined multi-state queries like the sale and auction params already allow. (#14)

## What's new in 2.0.1

Corrects the buy-offer state enums and the ESM import graph, and depends on the published `@atomichub/atomicassets`.

### Breaking changes

- `BuyofferState` names the lifecycle the indexer reports (`Pending`, `Declined`, `Canceled`, `Accepted`, `Invalid`) instead of the sale lifecycle. The numeric values are unchanged, so filters built from raw numbers behave the same. Code using the removed `BuyofferState.Listed` and `BuyofferState.Sold` no longer compiles and moves to the corrected names. (#13)

### Features

- `TemplateBuyofferState` is new. The template buyoffer routes number their states from `Listed`, one below the other listing types. (#13)

### Bug fixes

- A bare `import ... from '@atomichub/atomicmarket'` under Node ESM no longer fails with "does not provide an export named 'AtomicHubNetwork'". `Networks.ts` now splits the value import `NETWORK_ENDPOINTS` from the type-only `AtomicHubNetwork`, so esbuild drops the type from the emitted graph. The CJS build was never affected. (#7)

### Other changes

- The `@atomichub/atomicassets` dependency is a registry range, `^2.0.0`, rather than a git ref, so the lockfile carries a tarball with an integrity hash. (#10)
- npm publishing runs through the trusted publisher rather than a stored token, so releases carry provenance with no long-lived publish secret. (#8)

## What's new in 2.0.0

Publishes the AtomicHub fork as `@atomichub/atomicmarket`.

### Breaking changes

- The package name is `@atomichub/atomicmarket`. Install it under that name and change imports from `'atomicmarket'`. (#1)
- Deep imports such as `atomicmarket/build/API/Explorer/Params` are replaced by root exports, for example `import { SaleApiParams } from '@atomichub/atomicmarket'`. (#1)
- Numeric ABI fields (`template_id`, weights, splits) are numbers. The 64-bit id fields, sale ids and rule ids, remain strings. (#1)
- Node.js 20 or newer is required. (#1)

### Features

- The package has no third-party runtime dependencies. The built-in `fetch` replaces node-fetch, and a custom `fetch` can still be injected. The only dependency is the sibling `@atomichub/atomicassets`. (#1)
- Ships dual CJS and ESM output with bundled type declarations, plus a browser IIFE build. (#1)
- Adds the v2 royalty read endpoints `getRoyaltyConfig`, `getRoyaltyTemplateRules` and `getRoyaltyAttributeRules`. (#1)
- Adds `MarketActionBuilder`, a synchronous builder for royalty-config actions, alongside `MarketActionGenerator`, which covers the six royalty-configuration actions and their deletes. (#1)
- Exports typed on-chain table rows and the `AtomicMarketActions` action-name constants. (#1)
- Exports the market API response-object, query-parameter and enum types from the package root, so no deep `build/` imports are needed. (#1)
- Adds `current_collection_fee` to sales, auctions and buyoffers. (#1)

### Bug fixes

- `IBuyoffer` matches what the published `atomicmarket` 1.1.6 returns. It carries `buyoffer_id`, `memo` and `decline_memo`, where it used to carry `auction_id` and neither memo field. (#1)

## Migrating from atomicmarket 1.x

- Package name: `npm install @atomichub/atomicmarket` and change imports from `'atomicmarket'` to `'@atomichub/atomicmarket'`.
- Deep imports such as `atomicmarket/build/API/Explorer/Params` are replaced by root exports: `import { SaleApiParams } from '@atomichub/atomicmarket'`.
- Numeric ABI fields (`template_id`, weights, splits) are numbers; 64-bit id fields (sale ids, rule ids) remain strings.
- Node.js 20 or newer is required.

## Credits and license

Fork of [atomicmarket-js](https://github.com/pinknetworkx/atomicmarket-js) by pink.network, updated for the v2 AtomicMarket contract. Maintained by AtomicHub.

MIT licensed; see [LICENSE](https://github.com/atomicassets/atomicmarket-sdk/blob/main/LICENSE) for the full text including the original pink.network copyright.
