import { ethers } from 'ethers'
import { TOKEN_INFO } from './config'
import { rpcProvider } from './provider'
import { getStoredAccounts } from '~/utils/accountBalance'

const ETH_USD_CACHE_DURATION_MS = 24 * 60 * 60 * 1000
const GAS_PRICE_CACHE_DURATION_MS = 30 * 1000

interface EthUsdSnapshot {
  value: number
  updatedAt: number
}

interface GasPriceSnapshot {
  value: bigint
  updatedAt: number
}

const PRICE_FEED_ABI = new ethers.Interface([
  'function decimals() view returns (uint8)',
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
])

const isFresh = (updatedAt: number, now: number, duration: number): boolean =>
  Number.isFinite(updatedAt) && now - updatedAt < duration

export class EthState {
  private usdSnapshot: EthUsdSnapshot | null = null
  private usdPending: Promise<number> | null = null
  private gasPriceSnapshot: GasPriceSnapshot | null = null
  private gasPricePending: Promise<bigint> | null = null

  public async getUsdValue(provider?: ethers.Provider): Promise<number> {
    const current = this.usdSnapshot

    if (current && isFresh(current.updatedAt, Date.now(), ETH_USD_CACHE_DURATION_MS)) {
      return current.value
    }

    if (this.usdPending) {
      return this.usdPending
    }

    const request = this.loadUsdValue(provider)
    this.usdPending = request

    try {
      return await request
    } finally {
      if (this.usdPending === request) {
        this.usdPending = null
      }
    }
  }

  public async getGasPrice(provider?: ethers.Provider): Promise<bigint> {
    const current = this.gasPriceSnapshot

    if (current && isFresh(current.updatedAt, Date.now(), GAS_PRICE_CACHE_DURATION_MS)) {
      return current.value
    }

    if (this.gasPricePending) {
      return this.gasPricePending
    }

    const request = this.loadGasPrice(provider)
    this.gasPricePending = request

    try {
      return await request
    } finally {
      if (this.gasPricePending === request) {
        this.gasPricePending = null
      }
    }
  }

  public getCachedUsdValue(): number | null {
    if (!this.usdSnapshot || !isFresh(this.usdSnapshot.updatedAt, Date.now(), ETH_USD_CACHE_DURATION_MS)) {
      return null
    }

    return this.usdSnapshot.value
  }

  public getUsdSnapshot(): EthUsdSnapshot | null {
    return this.usdSnapshot ? { ...this.usdSnapshot } : null
  }

  public clear(): void {
    this.usdSnapshot = null
    this.gasPriceSnapshot = null
  }

  private async loadUsdValue(provider?: ethers.Provider): Promise<number> {
    if (this.usdSnapshot === null) {
      const stored = this.readStoredUsdValue()

      if (stored) {
        this.usdSnapshot = stored
        return stored.value
      }
    }

    const value = await this.fetchUsdValueFromProvider(provider)
    this.usdSnapshot = { value, updatedAt: Date.now() }
    return value
  }

  private async loadGasPrice(provider?: ethers.Provider): Promise<bigint> {
    const rpc = provider ?? rpcProvider.getProvider()
    const feeData = await rpc.getFeeData()

    if (feeData.gasPrice === null) {
      throw new Error('Failed to get gas price')
    }

    this.gasPriceSnapshot = { value: feeData.gasPrice, updatedAt: Date.now() }
    return feeData.gasPrice
  }

  private readStoredUsdValue(): EthUsdSnapshot | null {
    const now = Date.now()
    const accounts = getStoredAccounts()
    let newest: EthUsdSnapshot | null = null

    for (const account of Object.values(accounts)) {
      if (!account || typeof account !== 'object') continue

      const updatedAt = Number(account.updatedAt)
      if (!isFresh(updatedAt, now, ETH_USD_CACHE_DURATION_MS)) continue

      const value = Number(account.tokens?.ETH?.usdValue)
      if (!Number.isFinite(value) || value <= 0) continue

      if (!newest || updatedAt > newest.updatedAt) {
        newest = { value, updatedAt }
      }
    }

    return newest
  }

  private async fetchUsdValueFromProvider(provider?: ethers.Provider): Promise<number> {
    const rpc = provider ?? rpcProvider.getProvider()
    const feedAddress = TOKEN_INFO.ETH?.chainlinkFeed

    if (!feedAddress) {
      throw new Error('ETH/USD price feed is not configured')
    }

    const [decimalsData, roundData] = await Promise.all([
      rpc.call({ to: feedAddress, data: PRICE_FEED_ABI.encodeFunctionData('decimals') }),
      rpc.call({ to: feedAddress, data: PRICE_FEED_ABI.encodeFunctionData('latestRoundData') }),
    ])

    if (!decimalsData || !roundData) {
      throw new Error('Failed to fetch the ETH/USD price')
    }

    const [decimals] = PRICE_FEED_ABI.decodeFunctionResult(
      'decimals',
      decimalsData
    ) as unknown as [bigint]
    const [, answer] = PRICE_FEED_ABI.decodeFunctionResult(
      'latestRoundData',
      roundData
    ) as unknown as [bigint, bigint, bigint, bigint, bigint]

    const value = Number(ethers.formatUnits(answer, Number(decimals)))

    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('Invalid ETH/USD price from provider')
    }

    return value
  }
}

export const ethState = new EthState()
