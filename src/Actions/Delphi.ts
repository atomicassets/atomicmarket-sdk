// Delphi settlement math for sales priced through the oracle.
//
// A delphi sale lists in one symbol (commonly USD) and settles in another at
// the oracle rate, and its `assertsale` pins only the listing terms: nothing
// on chain asserts the settlement amount the buyer deposits. Deriving that
// amount is therefore the integrator's hardest step and the one whose failure
// is a wrong payment, which is why it ships here rather than as README prose.

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

// Antelope bounds an asset's precision to 0-18 decimal digits, and
// delphioracle's own median precision sits far below that. The bound is not
// decoration: it is what keeps `10n ** BigInt(exponent)` below the size where
// the power step stops returning.
const MAX_PRECISION = 18;

function assertPrecision(value: number, field: string): void {
    if (!Number.isInteger(value) || value < 0 || value > MAX_PRECISION) {
        throw new Error(`${field} ${String(value)} is not an Antelope precision (an integer 0-${MAX_PRECISION})`);
    }
}

// Converts a listing amount into the settlement amount at the given median.
// Both amounts are raw integers in their own symbol's smallest unit, as the
// chain stores them, and the median is delphioracle's raw integer at
// `median_precision`. The API response types serve that median as a JS
// number; delphioracle magnitudes sit far below 2^53, and a caller should
// still reject a non-safe-integer before converting (the README walkthrough
// shows the guard), because one that large has already lost precision at
// JSON parse.
//
// Integer math over BigInt with a single floor. The equivalent double-precision
// formula loses digits at the magnitudes raw on-chain amounts reach, so the one
// floor here lands on the exact integer the chain's own conversion produces.
//
// Validation runs before the math: a non-positive median would divide by zero
// on a non-inverted pair (and `'0'` is `purchasesale`'s plain-sale
// discriminator, so a zero median is never a delphi price), and an unbounded
// precision reaches the power step as a hang rather than an error.
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
    const numerator = pair.invert_delphi_pair ? listingAmount * median : listingAmount;
    const denominator = pair.invert_delphi_pair ? 1n : median;

    return exponent >= 0
        ? (numerator * 10n ** BigInt(exponent)) / denominator
        : numerator / (denominator * 10n ** BigInt(-exponent));
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
