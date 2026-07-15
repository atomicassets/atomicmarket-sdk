import { AtomicHubNetwork, NETWORK_ENDPOINTS } from '@atomichub/atomicassets';

import AtomicMarketApi from './API/Explorer';

// AtomicHub's public API endpoints, baked in as convenient defaults.
// Any compatible deployment can still be passed straight to the constructor.

export { AtomicHubNetwork, NETWORK_ENDPOINTS };

export function marketApiForNetwork(
    network: AtomicHubNetwork, options?: ConstructorParameters<typeof AtomicMarketApi>[2]
): AtomicMarketApi {
    return new AtomicMarketApi(NETWORK_ENDPOINTS[network].api, 'atomicmarket', options ?? {});
}
