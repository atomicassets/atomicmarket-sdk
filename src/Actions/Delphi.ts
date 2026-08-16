// Delphi settlement math for sales priced through the oracle.
//
// A delphi sale lists in one symbol (commonly USD) and settles in another at
// the oracle rate, and its `assertsale` pins only the listing terms: nothing
// on chain asserts the settlement amount the buyer deposits. Deriving that
// amount is therefore the integrator's hardest step and the one whose failure
// is a wrong payment, which is why it ships here rather than as README prose.

import { MAX_PRECISION } from './Symbols';

// The pair fields the derivation needs, as `AtomicMarketApi.getConfig()`
// serves them: a supported pair's `invert_delphi_pair` flag plus the three
// precisions on its `data`. A flat projection rather than the response shape
// itself, so callers may assemble one from any source of the same numbers.
export type DelphiPairSpec = {
    median_precision: number,
    base_precision: number,
    quote_precision: number,
    invert_delphi_pair: boolean
};

// The chain's 0-18 precision bound is shared with the symbol readers, and here
// it is what holds the exponent inside the range a real pair can reach.
// delphioracle's own median precision sits far below it, and a value outside it
// belongs to no chain, so a derivation from one would be reproducing a pair that
// cannot exist rather than the one the caller has.
function assertPrecision(value: number, field: string): void {
    if (!Number.isInteger(value) || value < 0 || value > MAX_PRECISION) {
        throw new Error(`${field} ${String(value)} is not an Antelope precision (an integer 0-${MAX_PRECISION})`);
    }
}

// 2^64, the width the contract assigns its converted price into. A double at or
// above this has no `uint64_t` to become: the conversion is undefined in C++
// and traps in the WebAssembly the contract runs as, so there is no settled
// amount to reproduce and no purchase at that price that could land.
const UINT64_LIMIT = 2 ** 64;

// Converts a listing amount into the settlement amount at the given median, by
// reproducing what `calc_settlement_price` computes rather than what it ought
// to. Both amounts are raw integers in their own symbol's smallest unit, as the
// chain stores them, and the median is delphioracle's raw integer at
// `median_precision`. The API response types serve that median as a JS
// number; delphioracle magnitudes sit far below 2^53, and a caller should
// still reject a non-safe-integer before converting (the README walkthrough
// shows the guard), because one that large has already lost precision at
// JSON parse.
//
// The contract divides and scales in binary64 and truncates the result into a
// `uint64_t`, so the amount it charges is not the exact rational floor. On the
// WAX/USD pair at a median of 37 the two part company by one raw unit on about
// 2.7% of listing amounts from $12,124.27 up, the chain landing above. Deriving
// the exact floor leaves the deposit a unit short of what
// `internal_decrease_balance` demands and the purchase throws, unless a standing
// balance quietly covers the difference. So the arithmetic here is the
// contract's, numerical sloppiness included, and the match is exact rather than
// close: JS and the contract's C++ both compute in IEEE-754 binary64 and agree
// bit for bit on these operations, and `Math.pow(10, e)` returns what a C
// `pow(10, e)` returns across the whole exponent range these precisions reach,
// including the single power of ten in that range that no double represents,
// where both round the same way and neither rounds to nearest.
//
// Past 2^53 the double no longer represents the quotient exactly and can sit
// several units off it. That is a limit of what the contract calculates, not of
// this reproduction: the integer returned is still the one the chain charges.
//
// Validation runs before the math: a non-positive median would divide by zero
// on a non-inverted pair (and `'0'` is `purchasesale`'s plain-sale
// discriminator, so a zero median is never a delphi price), and an unbounded
// precision would overflow the power step and be reported as an impossible
// amount rather than as the precision it is.
export function deriveSettlementAmount(listingAmount: bigint, median: bigint, pair: DelphiPairSpec): bigint {
    if (listingAmount < 0n) {
        throw new Error(`listingAmount ${listingAmount.toString()} is not the non-negative integer a raw chain amount requires`);
    }

    if (median <= 0n) {
        throw new Error(`median ${median.toString()} is not the positive integer a delphi sale requires`);
    }

    assertPrecision(pair.median_precision, 'median_precision');
    assertPrecision(pair.base_precision, 'base_precision');
    assertPrecision(pair.quote_precision, 'quote_precision');

    const exponent = pair.invert_delphi_pair
        ? pair.quote_precision - pair.base_precision - pair.median_precision
        : pair.median_precision + pair.base_precision - pair.quote_precision;

    // The contract builds this exponent in unsigned 64-bit arithmetic, because
    // delphioracle types `quoted_precision` as a `uint64_t`
    // (include/delphioracle-interface.hpp:29) and it pulls the two symbol
    // precisions up with it. Wherever the exponent is non-negative the wrapping
    // cancels and the value is the ordinary one, which is why this reads the
    // sign rather than the branch; below zero it wraps to about 1.8e19, `pow`
    // overflows to infinity, and the conversion into a `uint64_t` has no
    // defined result. Such a pairing has no settlement amount, on chain or here,
    // so reproducing one would be inventing it.
    if (exponent < 0) {
        throw new Error(
            `pair exponent ${exponent} is negative, so the contract has no settlement amount to reproduce: `
            + 'it computes the exponent unsigned, where a negative one wraps past 1.8e19 and overflows the '
            + `power step (median_precision ${pair.median_precision}, base_precision ${pair.base_precision}, `
            + `quote_precision ${pair.quote_precision}, invert_delphi_pair ${String(pair.invert_delphi_pair)})`
        );
    }

    const settlement = pair.invert_delphi_pair
        ? Number(listingAmount) * Number(median) * Math.pow(10, exponent)
        : Number(listingAmount) / Number(median) * Math.pow(10, exponent);

    // Negated so that a NaN, which an infinite operand can produce, fails here
    // rather than reaching BigInt as a RangeError naming nothing.
    if (!(settlement < UINT64_LIMIT)) {
        throw new Error(
            `settlement amount ${String(settlement)} does not fit the uint64 the contract converts it into, `
            + `so no purchase at this price can land (listingAmount ${listingAmount.toString()}, `
            + `median ${median.toString()}, exponent ${exponent})`
        );
    }

    return BigInt(Math.trunc(settlement));
}

// Renders a raw integer amount as the chain quantity string an action's
// `asset` field expects ("24.93765586 WAX"). `symbolCode` is the bare code
// ("WAX"), not the "8,WAX" symbol notation a `settlement_symbol` field carries.
//
// The precision is bounded for the same reason the derivation bounds it: a
// negative or fractional one renders a quantity that parses at a precision
// nobody chose ("100000. WAX" reads as 100000 WAX), and the wrong quantity in
// a deposit transfer is a wrong payment with nothing on chain left to catch it.
export function formatQuantity(rawAmount: bigint, precision: number, symbolCode: string): string {
    assertPrecision(precision, 'precision');

    // padStart bounds the precision but not the sign: a negative rawAmount
    // either renders a malformed quantity ("0.00000-123 WAX") or, once the
    // sign digit pushes the string past precision + 1, a valid-looking but
    // negative asset, and either is a wrong payment with nothing on chain
    // left to catch it.
    if (rawAmount < 0n) {
        throw new Error(`rawAmount ${rawAmount.toString()} is not the non-negative integer a quantity requires`);
    }

    const padded = rawAmount.toString().padStart(precision + 1, '0');

    if (precision === 0) {
        return `${padded} ${symbolCode}`;
    }

    const cut = padded.length - precision;

    return `${padded.slice(0, cut)}.${padded.slice(cut)} ${symbolCode}`;
}
