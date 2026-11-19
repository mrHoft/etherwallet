import { NATIVE_TOKEN_SYMBOL, PRICE_CACHE_DURATION_MS, TRONGRID_BASE_URL } from './config'
import { getTokenPrices } from './tokenPrice'
import { getStoredAccounts } from '~/utils/accountBalance'

const GAS_PRICE_CACHE_DURATION_MS = 30 * 1000
const REQUEST_TIMEOUT_MS = 8000

const ENERGY_FEE_KEY = 'getEnergyFee'
const BANDWIDTH_FEE_KEY = 'getTransactionFee'

export interface TronUsdSnapshot {
  value: number
  updatedAt: number
}

export interface TronFeeSnapshot {
  // Both fees are denominated in SUN (1 TRX = 1,000,000 SUN).
  energyPrice: bigint
  bandwidthPrice: bigint
  updatedAt: number
}

interface ChainParameter {
  key?: string
  value?: number
}

interface ChainParametersResponse {
  chainParameter?: ChainParameter[]
}

const isFresh = (updatedAt: number, now: number, duration: number): boolean =>
  Number.isFinite(updatedAt) && now - updatedAt < duration

export class TronState {
  private usdSnapshot: TronUsdSnapshot | null = null
  private usdPending: Promise<number> | null = null
  private feeSnapshot: TronFeeSnapshot | null = null
  private feePending: Promise<TronFeeSnapshot> | null = null

  public async getUsdValue(): Promise<number> {
    const current = this.usdSnapshot

    if (current && isFresh(current.updatedAt, Date.now(), PRICE_CACHE_DURATION_MS)) {
      return current.value
    }

    if (this.usdPending) {
      return this.usdPending
    }

    const request = this.loadUsdValue()
    this.usdPending = request

    try {
      return await request
    } finally {
      if (this.usdPending === request) {
        this.usdPending = null
      }
    }
  }

  public async getGasPrice(): Promise<bigint> {
    const fees = await this.getFees()
    return fees.energyPrice
  }

  public async getBandwidthPrice(): Promise<bigint> {
    const fees = await this.getFees()
    return fees.bandwidthPrice
  }

  public getCachedUsdValue(): number | null {
    if (!this.usdSnapshot || !isFresh(this.usdSnapshot.updatedAt, Date.now(), PRICE_CACHE_DURATION_MS)) {
      return null
    }

    return this.usdSnapshot.value
  }

  public getUsdSnapshot(): TronUsdSnapshot | null {
    return this.usdSnapshot ? { ...this.usdSnapshot } : null
  }

  public getCachedGasPrice(): bigint | null {
    if (!this.feeSnapshot || !isFresh(this.feeSnapshot.updatedAt, Date.now(), GAS_PRICE_CACHE_DURATION_MS)) {
      return null
    }

    return this.feeSnapshot.energyPrice
  }

  public getCachedBandwidthPrice(): bigint | null {
    if (!this.feeSnapshot || !isFresh(this.feeSnapshot.updatedAt, Date.now(), GAS_PRICE_CACHE_DURATION_MS)) {
      return null
    }

    return this.feeSnapshot.bandwidthPrice
  }

  public getFeesSnapshot(): TronFeeSnapshot | null {
    return this.feeSnapshot ? { ...this.feeSnapshot } : null
  }

  public clear(): void {
    this.usdSnapshot = null
    this.feeSnapshot = null
  }

  private async getFees(): Promise<TronFeeSnapshot> {
    const current = this.feeSnapshot

    if (current && isFresh(current.updatedAt, Date.now(), GAS_PRICE_CACHE_DURATION_MS)) {
      return current
    }

    if (this.feePending) {
      return this.feePending
    }

    const request = this.loadFees()
    this.feePending = request

    try {
      return await request
    } finally {
      if (this.feePending === request) {
        this.feePending = null
      }
    }
  }

  private async loadUsdValue(): Promise<number> {
    if (this.usdSnapshot === null) {
      const stored = this.readStoredUsdValue()

      if (stored) {
        this.usdSnapshot = stored
        return stored.value
      }
    }

    const value = await this.fetchUsdValue()
    this.usdSnapshot = { value, updatedAt: Date.now() }
    return value
  }

  private async loadFees(): Promise<TronFeeSnapshot> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(`${TRONGRID_BASE_URL}/wallet/getchainparameters`, {
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`TronGrid request failed with status ${response.status}`)
      }

      const payload = await response.json() as ChainParametersResponse
      const parameters = new Map(
        (payload.chainParameter ?? []).map(parameter => [parameter.key, parameter.value])
      )

      const snapshot: TronFeeSnapshot = {
        energyPrice: this.parseFee(parameters.get(ENERGY_FEE_KEY), 'gas price'),
        bandwidthPrice: this.parseFee(parameters.get(BANDWIDTH_FEE_KEY), 'bandwidth price'),
        updatedAt: Date.now(),
      }

      this.feeSnapshot = snapshot
      return snapshot
    } finally {
      clearTimeout(timeout)
    }
  }

  private parseFee(value: unknown, label: string): bigint {
    const fee = Number(value)

    if (!Number.isInteger(fee) || fee <= 0) {
      throw new Error(`Failed to get ${label}`)
    }

    return BigInt(fee)
  }

  private readStoredUsdValue(): TronUsdSnapshot | null {
    const now = Date.now()
    const accounts = getStoredAccounts()
    let newest: TronUsdSnapshot | null = null

    for (const account of Object.values(accounts)) {
      if (!account || typeof account !== 'object') continue

      const updatedAt = Number(account.updatedAt)
      if (!isFresh(updatedAt, now, PRICE_CACHE_DURATION_MS)) continue

      const value = Number(account.tokens?.[NATIVE_TOKEN_SYMBOL]?.priceUsd)
      if (!Number.isFinite(value) || value <= 0) continue

      if (!newest || updatedAt > newest.updatedAt) {
        newest = { value, updatedAt }
      }
    }

    return newest
  }

  private async fetchUsdValue(): Promise<number> {
    const prices = await getTokenPrices([NATIVE_TOKEN_SYMBOL])
    const value = prices[NATIVE_TOKEN_SYMBOL]

    if (value === undefined || !Number.isFinite(value) || value <= 0) {
      throw new Error('Failed to fetch TRX/USD price')
    }

    return value
  }
}

export const tronState = new TronState()
