export const TOKEN_INFO: Record<string, { name: string, symbol: string, decimals: number, contractAddress: string, chainlinkFeed: string }> = {
  ETH: { name: 'Ethereum', symbol: 'ETH', decimals: 18, contractAddress: '0x0000000000000000000000000000000000000000', chainlinkFeed: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419' },
  USDT: { name: 'Tether USD', symbol: 'USDT', decimals: 6, contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', chainlinkFeed: '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D' },
  USDC: { name: 'USD Coin', symbol: 'USDC', decimals: 6, contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chainlinkFeed: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6' },
  // WETH: { name: 'Wrapped Ethereum', symbol: 'WETH', decimals: 18, contractAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', chainlinkFeed: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419' },
}

// Ethereum Mainnet Remote Procedure Call providers
export const RPC_URLS = [
  'https://0xrpc.io/eth',
  // 'https://mainnet.gateway.tenderly.co',
]

export const MAX_PRICE_AGE_SECONDS = 3600 * 4;

// Multicall3 address (same on all chains)
export const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';

// Cache configuration
export const PRICE_CACHE_DURATION_MS = MAX_PRICE_AGE_SECONDS * 1000;
