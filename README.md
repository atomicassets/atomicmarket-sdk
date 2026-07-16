# @atomichub/atomicmarket

JavaScript/TypeScript SDK for the [AtomicMarket](https://github.com/pinknetworkx/atomicmarket-contract) NFT marketplace contract on Antelope (EOSIO) chains such as WAX. It reads sales, auctions, buyoffers, and royalty configuration through the AtomicMarket Explorer API and builds royalty-config contract actions for signing with any transaction library. This is a maintained fork of the dormant `atomicmarket` package by pink.network, updated for the v2 AtomicMarket contract.

The NFT-standard companion package is [@atomichub/atomicassets](https://github.com/atomicassets/atomicassets-sdk).

## Install

```sh
npm install @atomichub/atomicmarket
```

Requires Node.js >= 20, or any modern browser or bundler. The package ships CJS, ESM, and a browser IIFE bundle (`build/atomicmarket.global.js`, global `atomicmarket`).

```ts
// ESM / TypeScript
import { AtomicMarketApi } from '@atomichub/atomicmarket';

// CommonJS
const { AtomicMarketApi } = require('@atomichub/atomicmarket');
```

## Quickstart

### Read market data

The Explorer API queries a hosted [eosio-contract-api](https://github.com/pinknetworkx/eosio-contract-api) instance. The built-in `fetch` is used unless you pass your own.

```ts
import { AtomicMarketApi } from '@atomichub/atomicmarket';

const api = new AtomicMarketApi('https://wax.api.atomicassets.io', 'atomicmarket', {});

const sales = await api.getSales({ collection_name: 'mycollection' }, 1, 20);

const sale = await api.getSale('100');
```

### Network endpoints

AtomicHub's public endpoints ship as presets, so a client for a supported network needs one call:

```ts
import { marketApiForNetwork } from '@atomichub/atomicmarket';

const api = marketApiForNetwork('wax');
```

Custom or self-hosted deployments still work through the plain constructor shown above.

### Read royalty configuration (v2)

```ts
// null when the collection has no royalty config
const config = await api.getRoyaltyConfig('mycollection');

const templateRules = await api.getRoyaltyTemplateRules('mycollection');
const attributeRules = await api.getRoyaltyAttributeRules('mycollection');
```

### Build royalty actions

`MarketActionBuilder` is synchronous and returns authorization-free `{account, name, data}` objects for the v2 royalty-config actions. Attach authorization when you sign.

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

await session.transact({
    actions: actions.map((action) => ({
        ...action,
        authorization: [{ actor: 'authoracct11', permission: 'active' }]
    }))
});
```

## What's new in 2.0.0

- Zero third-party runtime dependencies: the built-in `fetch` replaces node-fetch (a custom `fetch` can still be injected); the only dependency is the sibling `@atomichub/atomicassets`.
- Dual CJS/ESM output with bundled type declarations, plus a browser IIFE build.
- v2 contract surface: royalty read endpoints (`getRoyaltyConfig`, `getRoyaltyTemplateRules`, `getRoyaltyAttributeRules`), the sync `MarketActionBuilder` for royalty-config actions, typed on-chain table rows, and the `AtomicMarketActions` action-name constants.
- Market API response-object, query-parameter, and enum types are exported from the package root; no deep `build/` imports needed.

## Migrating from atomicmarket 1.x

- Package name: `npm install @atomichub/atomicmarket` and change imports from `'atomicmarket'` to `'@atomichub/atomicmarket'`.
- Deep imports such as `atomicmarket/build/API/Explorer/Params` are replaced by root exports: `import { SaleApiParams } from '@atomichub/atomicmarket'`.
- Numeric ABI fields (`template_id`, weights, splits) are numbers; 64-bit id fields (sale ids, rule ids) remain strings.
- Node.js >= 20 is required.

## Credits and license

Fork of [atomicmarket-js](https://github.com/pinknetworkx/atomicmarket-js) by pink.network. Maintained by AtomicHub.

MIT licensed; see [LICENSE](LICENSE) for the full text including the original pink.network copyright.
