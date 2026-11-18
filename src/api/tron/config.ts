export interface TokenInfo {
  name: string
  symbol: string
  decimals: number
  contractAddress?: string
  coingeckoId: string
}

// TRX is native and has no contract address.
export const TOKEN_INFO: Record<string, TokenInfo> = {
  TRX: { name: 'Tron', symbol: 'TRX', decimals: 6, coingeckoId: 'tron' },
  USDT: {
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 6,
    contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    coingeckoId: 'tether',
  },
}

export const NATIVE_TOKEN_SYMBOL = 'TRX'

export const PRICE_CACHE_DURATION_MS = 5 * 60 * 1000

export const TRONGRID_BASE_URL = 'https://api.trongrid.io'

// Default Tron Mainnet Remote Procedure Call providers.
// Used until a custom provider list is stored in settings.
export const RPC_URLS = [
  'https://api.trongrid.io/jsonrpc',
  'https://tron.rpc.sentio.xyz',
]

export const NETWORK_ID = 728126428
