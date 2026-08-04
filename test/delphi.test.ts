import { expect } from 'chai';

import { DelphiPairSpec, deriveSettlementAmount, formatQuantity } from '../src';

// Both orientations of the same real WAX/USD price, as the market config
// serves them. Non-inverted lists in the pair's quote symbol and settles in
// its base (USD in, WAX out, median in USD per WAX); inverted is the mirror.
const waxSettlement: DelphiPairSpec = {
    median_precision: 4,
    base_precision: 8,
    quote_precision: 2,
    invert_delphi_pair: false
};

const usdSettlement: DelphiPairSpec = {
    median_precision: 4,
    base_precision: 8,
    quote_precision: 2,
    invert_delphi_pair: true
};

describe('deriveSettlementAmount', () => {
    it('scales a listing amount through the median on a non-inverted pair (positive exponent)', () => {
        // 1.00 USD at 0.0401 USD per WAX: 100 * 10^(4+8-2) / 401.
        expect(deriveSettlementAmount(100n, 401n, waxSettlement)).to.equal(2493765586n);
    });

    it('multiplies by the median on an inverted pair, with the inverted exponent', () => {
        // The same price read the other way, 24.9377 WAX per USD, on a pair
        // whose base is the USD side: 100 * 249377 * 10^(8-2-4).
        const inverted: DelphiPairSpec = {
            median_precision: 4,
            base_precision: 2,
            quote_precision: 8,
            invert_delphi_pair: true
        };

        expect(deriveSettlementAmount(100n, 249377n, inverted)).to.equal(2493770000n);
    });

    it('divides rather than multiplies when the exponent is negative, on both orientations', () => {
        // Inverted, exponent -10: 1.00000000 WAX at 0.0401 settles 0.04 USD.
        expect(deriveSettlementAmount(100000000n, 401n, usdSettlement)).to.equal(4n);

        // Non-inverted, exponent -2: the median stays in the divisor.
        const nonInverted: DelphiPairSpec = {
            median_precision: 4,
            base_precision: 2,
            quote_precision: 8,
            invert_delphi_pair: false
        };

        expect(deriveSettlementAmount(100000000n, 249377n, nonInverted)).to.equal(4n);
    });

    it('floors toward zero exactly once, keeping an exact quotient exact', () => {
        // 100.00000000 WAX at 0.0401 is exactly 4.01 USD, no remainder.
        expect(deriveSettlementAmount(10000000000n, 401n, usdSettlement)).to.equal(401n);

        // One raw unit below, the true value is 4.009999999599 USD, which
        // truncates down rather than rounding to the exact neighbour above.
        expect(deriveSettlementAmount(9999999999n, 401n, usdSettlement)).to.equal(400n);
    });

    it('throws naming the median when it is zero or negative, before any math runs', () => {
        expect(() => deriveSettlementAmount(100n, 0n, waxSettlement)).to.throw(/median/);
        expect(() => deriveSettlementAmount(100n, -1n, waxSettlement)).to.throw(/median/);
    });

    it('throws naming the listing amount when it is negative', () => {
        expect(() => deriveSettlementAmount(-1n, 401n, waxSettlement)).to.throw(/listingAmount/);
    });

    it('throws naming the offending precision when one falls outside 0-18', () => {
        expect(() => deriveSettlementAmount(100n, 401n, {...waxSettlement, median_precision: -1}))
            .to.throw(/median_precision/);
        expect(() => deriveSettlementAmount(100n, 401n, {...waxSettlement, base_precision: 8.5}))
            .to.throw(/base_precision/);
        expect(() => deriveSettlementAmount(100n, 401n, {...waxSettlement, quote_precision: 19}))
            .to.throw(/quote_precision/);
    });

    it('rejects an unbounded precision instead of reaching the power step', function () {
        // 10n ** 1e9n does not return in any useful time, so this test failing
        // by timeout rather than by assertion is the regression it guards.
        this.timeout(2000);

        expect(() => deriveSettlementAmount(100n, 401n, {...waxSettlement, base_precision: 1e9}))
            .to.throw(/base_precision/);
        expect(() => deriveSettlementAmount(100n, 401n, {...waxSettlement, quote_precision: 1e9}))
            .to.throw(/quote_precision/);
    });
});

describe('formatQuantity', () => {
    it('renders precision 0 with no decimal point at all', () => {
        expect(formatQuantity(5n, 0, 'WAX')).to.equal('5 WAX');
        expect(formatQuantity(0n, 0, 'WAX')).to.equal('0 WAX');
    });

    it('pads the fractional digits out to the precision and keeps the symbol code', () => {
        expect(formatQuantity(42n, 8, 'WAX')).to.equal('0.00000042 WAX');
        expect(formatQuantity(2493765586n, 8, 'WAX')).to.equal('24.93765586 WAX');
        expect(formatQuantity(0n, 2, 'USD')).to.equal('0.00 USD');
    });

    it('throws naming the precision when it falls outside 0-18', () => {
        expect(() => formatQuantity(100000n, -1, 'WAX')).to.throw(/precision/);
        expect(() => formatQuantity(100000n, 8.5, 'WAX')).to.throw(/precision/);
        expect(() => formatQuantity(100000n, 19, 'WAX')).to.throw(/precision/);
    });

    it('throws naming the amount when rawAmount is negative', () => {
        expect(() => formatQuantity(-1n, 8, 'WAX')).to.throw(/rawAmount/);
    });

    it('round trips a derived amount into a quantity carrying exactly the settlement precision', () => {
        const settlementPrecision = waxSettlement.base_precision;
        const quantity = formatQuantity(deriveSettlementAmount(100n, 401n, waxSettlement), settlementPrecision, 'WAX');

        expect(quantity).to.equal('24.93765586 WAX');
        expect(quantity.split(' ')[0].split('.')[1]).to.have.lengthOf(settlementPrecision);
    });
});
