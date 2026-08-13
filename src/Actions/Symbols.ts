// Readers for the two ways Antelope writes a symbol: inside a quantity string,
// alongside the amount ("100.00000000 WAX"), and in symbol notation, alongside
// nothing else ("8,WAX").
//
// A sale names one of each, in fields that describe a single symbol when it
// settles what it lists and two symbols when it settles through the oracle.
// Telling those apart is the one thing this file exists for. Nothing here is
// exported from the package: a consumer holding a quantity string already knows
// its own symbol.

// Antelope bounds an asset's precision to 0-18 decimal digits. Both readers
// below and the delphi derivation hold to that one bound rather than each
// restating it.
export const MAX_PRECISION = 18;

// A symbol code is 1-7 uppercase letters on chain; anything else is not a
// symbol the serializer will accept.
const SYMBOL_CODE = /^[A-Z]{1,7}$/;

type QuantitySpec = { decimals: number, code: string };

type SymbolSpec = { precision: number, code: string };

// Splits a chain quantity ("100.00000000 WAX") into its decimal count and
// symbol code. A precision-0 quantity carries no decimal point ("100 CREDIT"),
// read here as zero decimals rather than as malformed.
//
// Returns undefined on anything that does not parse, rather than throwing, so
// the caller decides what an unreadable field means for it.
function parseQuantitySpec(quantity: string): QuantitySpec | undefined {
    const parts = quantity.split(' ');

    if (parts.length !== 2) {
        return undefined;
    }

    const [amount, code] = parts;

    if (!/^\d+(\.\d+)?$/.test(amount) || !SYMBOL_CODE.test(code)) {
        return undefined;
    }

    const dot = amount.indexOf('.');
    const decimals = dot === -1 ? 0 : amount.length - dot - 1;

    return decimals > MAX_PRECISION ? undefined : {decimals, code};
}

// Splits symbol notation ("8,WAX") into its precision and code, on the same
// undefined-rather-than-throw contract as parseQuantitySpec.
function parseSymbolSpec(symbol: string): SymbolSpec | undefined {
    const parts = symbol.split(',');

    if (parts.length !== 2) {
        return undefined;
    }

    const [rawPrecision, code] = parts;

    // Digits first, because Number() reads '', '8.0' and '0x8' as 0, 8 and 8,
    // which would let a malformed precision through as a plausible one.
    if (!/^\d+$/.test(rawPrecision) || !SYMBOL_CODE.test(code)) {
        return undefined;
    }

    const precision = Number(rawPrecision);

    return precision > MAX_PRECISION ? undefined : {precision, code};
}

// Whether a quantity and a symbol name the same Antelope symbol. An Antelope
// symbol packs precision and code into one value, and the chain compares that
// whole value, so agreement means both: a quantity's decimal count is its own
// precision, and '100.00000000 WAX' therefore names '8,WAX' and no other
// symbol, '4,WAX' included.
//
// A field neither reader can parse counts as disagreement. Nothing here can
// show such a value to name the same symbol as another, and the serializer
// rejects it before a chain sees it either way.
export function namesSameSymbol(quantity: string, symbol: string): boolean {
    const price = parseQuantitySpec(quantity);
    const settlement = parseSymbolSpec(symbol);

    return price !== undefined && settlement !== undefined
        && price.code === settlement.code && price.decimals === settlement.precision;
}
