import { expect } from 'chai';

import { DelphiPairSpec, deriveSettlementAmount, formatQuantity } from '../src';

// The WAX/USD pair as the market config serves it: a listing in USD settling in
// WAX at a median quoted in USD per WAX, which is every delphi sale on WAX
// today. The contract's exponent here is 4 + 8 - 2, the ten this file's
// divergence cases turn on.
const waxSettlement: DelphiPairSpec = {
    median_precision: 4,
    base_precision: 8,
    quote_precision: 2,
    invert_delphi_pair: false
};

// The same pair read the other way, listing in WAX and settling in USD. Its
// exponent is -4 + 2 - 8, which the contract cannot compute at all.
const usdSettlement: DelphiPairSpec = {
    median_precision: 4,
    base_precision: 8,
    quote_precision: 2,
    invert_delphi_pair: true
};

// The exact rational floor, which is what the derivation returned before it was
// keyed to the contract's own arithmetic, kept here as the yardstick the
// divergence cases are measured against.
function exactFloor(listingAmount: bigint, median: bigint, pair: DelphiPairSpec): bigint {
    const exponent = pair.invert_delphi_pair
        ? pair.quote_precision - pair.base_precision - pair.median_precision
        : pair.median_precision + pair.base_precision - pair.quote_precision;
    const numerator = pair.invert_delphi_pair ? listingAmount * median : listingAmount;
    const denominator = pair.invert_delphi_pair ? 1n : median;

    return exponent >= 0
        ? (numerator * 10n ** BigInt(exponent)) / denominator
        : numerator / (denominator * 10n ** BigInt(-exponent));
}

describe('deriveSettlementAmount', () => {
    it('scales a listing amount through the median on a non-inverted pair', () => {
        // 1.00 USD at 0.0401 USD per WAX: 100 / 401 * 10^(4+8-2).
        expect(deriveSettlementAmount(100n, 401n, waxSettlement)).to.equal(2493765586n);
    });

    it('multiplies by the median on an inverted pair, with the inverted exponent', () => {
        // The same price read the other way, 24.9377 WAX per USD, on a pair
        // whose base is the USD side: 100 * 249377 * 10^(-4+8-2).
        const inverted: DelphiPairSpec = {
            median_precision: 4,
            base_precision: 2,
            quote_precision: 8,
            invert_delphi_pair: true
        };

        expect(deriveSettlementAmount(100n, 249377n, inverted)).to.equal(2493770000n);
    });

    it('reproduces the contract where its double arithmetic lands a unit above the exact floor', () => {
        // The divergence threshold on waxpusd at median 37. One cent below it
        // the contract's double and the exact quotient agree; at it they part
        // company, the contract landing one raw unit high, and deriving the
        // exact floor would deposit a unit less than the purchase spends.
        expect(deriveSettlementAmount(1212426n, 37n, waxSettlement)).to.equal(327682702702702n);
        expect(exactFloor(1212426n, 37n, waxSettlement)).to.equal(327682702702702n);

        expect(deriveSettlementAmount(1212427n, 37n, waxSettlement)).to.equal(327682972972973n);
        expect(exactFloor(1212427n, 37n, waxSettlement)).to.equal(327682972972972n);
    });

    it('agrees with the exact floor below that threshold, on every amount from 1 cent up', () => {
        for (let listingAmount = 1n; listingAmount < 1212427n; listingAmount++) {
            if (deriveSettlementAmount(listingAmount, 37n, waxSettlement) !== exactFloor(listingAmount, 37n, waxSettlement)) {
                throw new Error(`listingAmount ${listingAmount.toString()} diverges below the threshold`);
            }
        }
    });

    it('diverges on a minority of amounts above it, always by exactly one unit upward', () => {
        const deltas = new Set<string>();
        let diverged = 0;
        let sampled = 0;

        for (let listingAmount = 1212427n; listingAmount < 1312427n; listingAmount++) {
            const delta = deriveSettlementAmount(listingAmount, 37n, waxSettlement)
                - exactFloor(listingAmount, 37n, waxSettlement);

            sampled++;

            if (delta !== 0n) {
                diverged++;
                deltas.add(delta.toString());
            }
        }

        expect([...deltas]).to.deep.equal(['1']);
        expect(diverged / sampled).to.be.within(0.02, 0.035);
    });

    it('truncates toward zero, keeping an exact quotient exact', () => {
        // 4.01 USD at 0.0401 is exactly 100.00000000 WAX, no remainder.
        expect(deriveSettlementAmount(401n, 401n, waxSettlement)).to.equal(10000000000n);

        // One raw unit below, the true value is 99.97506234... WAX, which
        // truncates down rather than rounding to the neighbour above.
        expect(deriveSettlementAmount(400n, 401n, waxSettlement)).to.equal(9975062344n);
    });

    it('returns amounts past 2^53, carrying the contract\'s own imprecision rather than correcting it', () => {
        // Still exact: the double behind this one is the integer itself.
        expect(deriveSettlementAmount(900719925n, 1n, waxSettlement)).to.equal(9007199250000000000n);

        // Not exact: the product is 18446744070000000000, but no double sits
        // there, so the contract truncates the nearest one and charges 1024
        // more. Returning the exact product would be describing a purchase the
        // chain does not make.
        const inexact = deriveSettlementAmount(1844674407n, 1n, waxSettlement);

        expect(inexact).to.equal(18446744070000001024n);
        expect(exactFloor(1844674407n, 1n, waxSettlement)).to.equal(18446744070000000000n);
    });

    it('throws rather than reproducing a uint64 conversion the contract has no defined result for', () => {
        // One raw unit further and the double passes 2^64, where the contract's
        // cast is undefined in C++ and traps in the WebAssembly it runs as.
        expect(() => deriveSettlementAmount(1844674408n, 1n, waxSettlement))
            .to.throw(/does not fit the uint64/);
        expect(() => deriveSettlementAmount(1844674408n, 1n, waxSettlement)).to.throw(/exponent 10/);
    });

    it('throws on a pair whose exponent is negative, the contract wrapping it unsigned', () => {
        // Listing in WAX and settling in USD on the same pair: -4 + 2 - 8. The
        // contract computes that in unsigned 64-bit arithmetic, where it
        // becomes about 1.8e19 and overflows the power step, so no purchase at
        // such a pairing can land and there is nothing to derive.
        expect(() => deriveSettlementAmount(100000000n, 401n, usdSettlement)).to.throw(/exponent -10 is negative/);

        // Non-inverted, exponent -2: the same refusal on the other branch.
        const nonInverted: DelphiPairSpec = {
            median_precision: 4,
            base_precision: 2,
            quote_precision: 8,
            invert_delphi_pair: false
        };

        expect(() => deriveSettlementAmount(100000000n, 249377n, nonInverted)).to.throw(/exponent -2 is negative/);
    });

    it('names the precisions and the orientation in the negative-exponent error', () => {
        expect(() => deriveSettlementAmount(100n, 401n, usdSettlement)).to.throw(/median_precision 4/);
        expect(() => deriveSettlementAmount(100n, 401n, usdSettlement)).to.throw(/base_precision 8/);
        expect(() => deriveSettlementAmount(100n, 401n, usdSettlement)).to.throw(/quote_precision 2/);
        expect(() => deriveSettlementAmount(100n, 401n, usdSettlement)).to.throw(/invert_delphi_pair true/);
    });

    it('takes an exponent of zero, where the wrap the contract risks cancels exactly', () => {
        const flat: DelphiPairSpec = {
            median_precision: 4,
            base_precision: 2,
            quote_precision: 6,
            invert_delphi_pair: false
        };

        expect(deriveSettlementAmount(1000n, 4n, flat)).to.equal(250n);
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

    it('rejects an unbounded precision as the precision it is, not as an exponent', () => {
        // An exponent built from these would overflow the power step to
        // infinity and read as an amount too large, which describes the wrong
        // fault: no chain serves a precision of 1e9.
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
