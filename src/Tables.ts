import { AttributeRoyaltyValue, RoyaltyPair } from './Actions/Generator';

// Typed rows for AtomicMarket v2 contract tables as returned by
// get_table_rows JSON deserialization. Field widths follow the on-chain ABI:
// uint64 and name fields arrive as strings (uint64 exceeds Number's safe
// range; names are strings), int32/uint32/uint8/float64 arrive as numbers.

// royaltyconf table, scope = collection (royaltyconf_s).
export interface IRoyaltyConfigRow {
    collection: string;
    founders: RoyaltyPair[];
    attribute_mode: number;
    split_founders: number;
    split_templates: number;
    split_attributes: number;
}

// royaltytemp table, scope = collection (royaltytemp_s).
export interface IRoyaltyTemplateRow {
    template_id: number;
    recipients: RoyaltyPair[];
}

// royaltyattr table, scope = collection (royaltyattr_s).
export interface IRoyaltyAttributeRow {
    index: string;
    source: number;
    field: string;
    value: AttributeRoyaltyValue;
    weight: number;
    recipients: RoyaltyPair[];
    lookup_hash: string;
}

// tbuyoffers table (template_buyoffer_s).
export interface ITemplateBuyofferRow {
    buyoffer_id: string;
    buyer: string;
    price: string;
    template_id: string;
    maker_marketplace: string;
    collection_name: string;
    collection_fee: number;
}
