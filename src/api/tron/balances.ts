import { ethers } from 'ethers'
import { NATIVE_TOKEN_SYMBOL, TOKEN_INFO } from './config'
import { rpcProvider } from './provider'
import { toTronHexAddress } from './address'
import { getTokenPrices } from './tokenPrice'

export interface FormattedBalance {
  raw: string
  formatted: string
  decimals: number
  usdValue?: number
  tokenPriceUsd?: number
}

const TRC20_INTERFACE = new ethers.Interface(['function balanceOf(address) view returns (uint256)'])
const PRICE_WAIT_MS = 3000

const waitForPrices = async (
  pricesPromise: Promise<Record<string, number>>
): Promise<Record<string, number>> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const timeout = new Promise<Record<string, number>>(resolve => {
    timeoutId = setTimeout(() => resolve({}), PRICE_WAIT_MS)
  })

  try {
    return await Promise.race([pricesPromise, timeout])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

const validateSymbols = (symbols: string[]): void => {
  const missingTokens = symbols.filter(symbol => !TOKEN_INFO[symbol])
  if (missingTokens.length) {
    throw new Error(`Unknown token symbols: ${missingTokens.join(', ')}`)
  }
}

const getContractHex = (symbol: string): string => {
  const contractAddress = TOKEN_INFO[symbol]?.contractAddress
  if (!contractAddress) {
    throw new Error(`No TRC20 contract configured for: ${symbol}`)
  }

  return toTronHexAddress(contractAddress)
}

const readBalance = async (provider: ethers.Provider, addressHex: string, symbol: string): Promise<bigint> => {
  if (symbol === NATIVE_TOKEN_SYMBOL) {
    return provider.getBalance(addressHex)
  }

  const callData = TRC20_INTERFACE.encodeFunctionData('balanceOf', [addressHex])
  const result = await provider.call({ to: getContractHex(symbol), data: callData })
  const [balance] = TRC20_INTERFACE.decodeFunctionResult('balanceOf', result)
  return balance
}

/**
 * Reads native TRX and TRC20 balances for a base58 (or hex) Tron address.
 * Token prices come from CoinGecko and are optional: balances still resolve
 * without USD values when the price request fails.
 */
export async function getTokenBalances(
  address: string,
  symbols: string[]
): Promise<Record<string, FormattedBalance>> {
  const uniqueSymbols = [...new Set(symbols)]
  validateSymbols(uniqueSymbols)

  const addressHex = toTronHexAddress(address)
  const provider = rpcProvider.getProvider()
  const pricesPromise = getTokenPrices(uniqueSymbols)

  const results = await Promise.allSettled(
    uniqueSymbols.map(symbol => readBalance(provider, addressHex, symbol))
  )
  const prices = await waitForPrices(pricesPromise)

  const failures = results.filter(result => result.status === 'rejected')
  if (results.length > 0 && failures.length === results.length) {
    const reason = failures[0].status === 'rejected' ? failures[0].reason : null
    throw new Error(
      `Failed to read Tron balances: ${reason instanceof Error ? reason.message : reason}`
    )
  }

  const balances: Record<string, FormattedBalance> = {}

  uniqueSymbols.forEach((symbol, index) => {
    const tokenInfo = TOKEN_INFO[symbol]
    const result = results[index]
    const raw = result.status === 'fulfilled' ? result.value : 0n
    const formatted = ethers.formatUnits(raw, tokenInfo.decimals)
    const price = prices[symbol]

    balances[symbol] = {
      raw: raw.toString(),
      formatted,
      decimals: tokenInfo.decimals,
      tokenPriceUsd: price,
      usdValue: price !== undefined && price > 0 && raw > 0n
        ? parseFloat(formatted) * price
        : undefined,
    }
  })

  return balances
}

export async function getPortfolioValue(
  address: string,
  symbols: string[]
): Promise<{ balances: Record<string, FormattedBalance>; totalUsdValue: number }> {
  const balances = await getTokenBalances(address, symbols)

  let totalUsdValue = 0
  for (const balance of Object.values(balances)) {
    if (balance.usdValue) {
      totalUsdValue += balance.usdValue
    }
  }

  return { balances, totalUsdValue }
}
