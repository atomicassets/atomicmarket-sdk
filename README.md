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
