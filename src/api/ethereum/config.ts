export interface TokenInfo {
  name: string
  symbol: string
  decimals: number
  contractAddress: string
  chainlinkFeed: string
  coingeckoId: string
  interestBearing?: {
    protocol: string
    pool: string
    underlying: string
  }
}

export const TOKEN_INFO: Record<string, TokenInfo> = {
  ETH: { name: 'Ethereum', symbol: 'ETH', decimals: 18, contractAddress: '0x0000000000000000000000000000000000000000', chainlinkFeed: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', coingeckoId: 'ethereum' },
  USDT: { name: 'Tether USD', symbol: 'USDT', decimals: 6, contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', chainlinkFeed: '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D', coingeckoId: 'tether' },
  USDC: { name: 'USD Coin', symbol: 'USDC', decimals: 6, contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chainlinkFeed: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6', coingeckoId: 'usd-coin' },
  WETH: { name: 'Wrapped Ethereum', symbol: 'WETH', decimals: 18, contractAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', chainlinkFeed: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', coingeckoId: 'weth' },
  stETH: { name: 'Lido Staked Ether', symbol: 'stETH', decimals: 18, contractAddress: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', chainlinkFeed: '0xCfE54B5cD566aB89272946F602D76Ea879CAb4a8', coingeckoId: 'staked-ether' },
  aEthUSDC: {
    name: 'Aave Ethereum USDC', symbol: 'aEthUSDC', decimals: 6, contractAddress: '0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c', chainlinkFeed: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6', coingeckoId: 'usd-coin',
    interestBearing: {
      protocol: 'aave-v3',
      pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
      underlying: 'USDC',
    }
  }
}

// Default Ethereum Mainnet Remote Procedure Call providers.
// Used until a custom provider list is stored in settings.
export const RPC_URLS = [
  'https://0xrpc.io/eth',
  'https://mainnet.gateway.tenderly.co',
]

export const MAX_PRICE_AGE_SECONDS = 3600 * 4

export const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11'

export const UNISWAP_V2_ROUTER_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'

export const PRICE_CACHE_DURATION_MS = MAX_PRICE_AGE_SECONDS * 1000

export const NETWORK_ID = 1

export const AAVE_V3_POOL_ADDRESS = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'

export const LIDO_WITHDRAWAL_QUEUE_ADDRESS = '0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1'

export const REBASE_TOKEN_SYMBOLS = new Set(['stETH', 'aEthUSDC'])
