// Listing state values as the API reports and filters them. Each listing type
// numbers its own states, and the numbering does not agree between them: state
// 1 is Listed for a sale, Declined for a buyoffer, and Canceled for a template
// buyoffer. Reusing one listing type's enum against another therefore reads
// plausibly and returns the wrong rows, so they are kept separate here.
//
// Some of these are stored by the indexer and some are computed per request, and
// which is which differs by listing type: a sale is stored as sold, an auction
// never is. The per-member comments below mark the computed ones, because a
// state the indexer derives never appears in the column it derives from.

export enum AuctionState {
    Waiting = 0,
    Listed = 1,
    Canceled = 2,
    // Derived: the auction ended with a bidder. The indexer stores no Sold.
    Sold = 3,
    // Derived: the auction ended without a bid.
    Invalid = 4
}

export enum SaleState {
    Waiting = 0,
    Listed = 1,
    Canceled = 2,
    Sold = 3,
    // Derived: the sale is listed but its underlying offer is no longer pending.
    Invalid = 4
}

export enum BuyofferState {
    Pending = 0,
    Declined = 1,
    Canceled = 2,
    Accepted = 3,
    // Derived: the recipient no longer owns every asset the offer covers.
    Invalid = 4
}

// The template buyoffer routes number their states from Listed, one below the
// other listing types, and report no derived states.
export enum TemplateBuyofferState {
    Listed = 0,
    Canceled = 1,
    Sold = 2
}

export enum SortOrder {
    Asc = 'asc',
    Desc = 'desc'
}

export enum AuctionSort {
    Created = 'created',
    Updated = 'updated',
    Ending = 'ending',
    AuctionId = 'auction_id',
    Price = 'price',
    TemplateMint = 'template_mint'
}

export enum BuyofferSort {
    Created = 'created',
    Updated = 'updated',
    BuyofferId = 'buyoffer_id',
    Price = 'price',
    TemplateMint = 'template_mint'
}

export enum SaleSort {
    Created = 'created',
    Updated = 'updated',
    SaleId = 'sale_id',
    Price = 'price',
    TemplateMint = 'template_mint'
}

export enum AssetSort {
    AssetId = 'asset_id',
    Minted = 'minted',
    Updated = 'updated',
    TemplateMint = 'template_mint'
}

export enum TransferSort {
    Created = 'created'
}

export enum OfferSort {
    Created = 'created'
}
