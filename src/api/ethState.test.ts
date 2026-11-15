/// <reference types="jest" />

import { ethers } from 'ethers'
import { EthState, ethState } from './ethState'
import { rpcProvider } from './provider'
import { getStoredAccounts } from '../utils/accountBalance'

jest.mock('./provider', () => ({
  rpcProvider: {
    getProvider: jest.fn(),
  },
}))

jest.mock('../utils/accountBalance', () => ({
  getStoredAccounts: jest.fn(),
}))

const PRICE_FEED_ABI = new ethers.Interface([
  'function decimals() view returns (uint8)',
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
])

const DECIMALS_CALL = PRICE_FEED_ABI.encodeFunctionData('decimals')
const ROUND_CALL = PRICE_FEED_ABI.encodeFunctionData('latestRoundData')
const BASE_TIME = 1_700_000_000_000
const ETH_USD_CACHE_DURATION_MS = 24 * 60 * 60 * 1000
const GAS_PRICE_CACHE_DURATION_MS = 30 * 1000

interface MockProvider {
  call: jest.Mock
}

const createProvider = (price: number): MockProvider & ethers.Provider => {
  const answer = BigInt(Math.round(price * 1e8))

  return {
    call: jest.fn(async ({ data }: { data: string }) => {
      if (data === DECIMALS_CALL) {
        return PRICE_FEED_ABI.encodeFunctionResult('decimals', [8n])
      }

      if (data === ROUND_CALL) {
        return PRICE_FEED_ABI.encodeFunctionResult('latestRoundData', [
          1n,
          answer,
          0n,
          0n,
          1n,
        ])
      }

      throw new Error('Unexpected call')
    }),
  } as unknown as MockProvider & ethers.Provider
}

interface FeeProvider {
  getFeeData: jest.Mock
}

const createFeeProvider = (gasPrice: bigint | null): FeeProvider & ethers.Provider => {
  return {
    getFeeData: jest.fn().mockResolvedValue({ gasPrice }),
  } as unknown as FeeProvider & ethers.Provider
}

const createStoredAccount = (usdValue: number, updatedAt: number) => ({
  totalUsd: usdValue,
  accountBalance: usdValue,
  createdAt: updatedAt,
  updatedAt,
  tokens: {
    ETH: {
      raw: '1000000000000000000',
      usdValue,
    },
  },
})

describe('ethState', () => {
  const mockedGetStoredAccounts = getStoredAccounts as jest.Mock
  const mockedGetProvider = rpcProvider.getProvider as jest.Mock

  beforeEach(() => {
    ethState.clear()
    jest.clearAllMocks()
    mockedGetStoredAccounts.mockReturnValue({})
    jest.spyOn(Date, 'now').mockReturnValue(BASE_TIME)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('exposes a singleton EthState instance', () => {
    expect(ethState).toBeInstanceOf(EthState)
  })

  it('seeds the state from a fresh stored wallet record', async () => {
    mockedGetStoredAccounts.mockReturnValue({
      '0xwallet': createStoredAccount(2500, BASE_TIME - 1000),
    })
    const provider = createProvider(1800)

    await expect(ethState.getUsdValue(provider)).resolves.toBe(2500)

    expect(provider.call).not.toHaveBeenCalled()
    expect(mockedGetProvider).not.toHaveBeenCalled()
    expect(ethState.getUsdSnapshot()).toEqual({ value: 2500, updatedAt: BASE_TIME - 1000 })
  })

  it('uses the newest fresh record and ignores stale ones', async () => {
    mockedGetStoredAccounts.mockReturnValue({
      newer: createStoredAccount(2600, BASE_TIME - 1000),
      older: createStoredAccount(2400, BASE_TIME - 60_000),
      stale: createStoredAccount(9999, BASE_TIME - ETH_USD_CACHE_DURATION_MS - 1),
    })

    await expect(ethState.getUsdValue(createProvider(1800))).resolves.toBe(2600)
  })

  it('ignores fresh records without a usable ETH USD value', async () => {
    mockedGetStoredAccounts.mockReturnValue({
      zero: createStoredAccount(0, BASE_TIME - 1000),
      missing: {
        totalUsd: 100,
        accountBalance: 100,
        createdAt: BASE_TIME - 1000,
        updatedAt: BASE_TIME - 1000,
        tokens: {},
      },
    })
    const provider = createProvider(1800)

    await expect(ethState.getUsdValue(provider)).resolves.toBe(1800)
    expect(provider.call).toHaveBeenCalledTimes(2)
  })

  it('requests the price from the provider when no fresh record exists', async () => {
    mockedGetStoredAccounts.mockReturnValue({
      stale: createStoredAccount(9999, BASE_TIME - ETH_USD_CACHE_DURATION_MS),
    })
    const provider = createProvider(1800)

    await expect(ethState.getUsdValue(provider)).resolves.toBe(1800)

    expect(provider.call).toHaveBeenCalledTimes(2)
    expect(ethState.getUsdSnapshot()).toEqual({ value: 1800, updatedAt: BASE_TIME })
  })

  it('uses the stored state for subsequent calls', async () => {
    const firstProvider = createProvider(1800)
    await expect(ethState.getUsdValue(firstProvider)).resolves.toBe(1800)
    expect(firstProvider.call).toHaveBeenCalledTimes(2)

    const secondProvider = createProvider(2100)
    await expect(ethState.getUsdValue(secondProvider)).resolves.toBe(1800)
    expect(secondProvider.call).not.toHaveBeenCalled()
  })

  it('refreshes the state once it is older than 24 hours', async () => {
    const firstProvider = createProvider(1800)
    await expect(ethState.getUsdValue(firstProvider)).resolves.toBe(1800)

    jest.spyOn(Date, 'now').mockReturnValue(BASE_TIME + ETH_USD_CACHE_DURATION_MS - 1)
    const cachedProvider = createProvider(1900)
    await expect(ethState.getUsdValue(cachedProvider)).resolves.toBe(1800)
    expect(cachedProvider.call).not.toHaveBeenCalled()

    jest.spyOn(Date, 'now').mockReturnValue(BASE_TIME + ETH_USD_CACHE_DURATION_MS + 1)
    const refreshedProvider = createProvider(2100)
    await expect(ethState.getUsdValue(refreshedProvider)).resolves.toBe(2100)
    expect(refreshedProvider.call).toHaveBeenCalledTimes(2)
    expect(ethState.getUsdSnapshot()).toEqual({
      value: 2100,
      updatedAt: BASE_TIME + ETH_USD_CACHE_DURATION_MS + 1,
    })
  })

  it('keeps a seeded record until that record is older than 24 hours', async () => {
    mockedGetStoredAccounts.mockReturnValue({
      wallet: createStoredAccount(2500, BASE_TIME - 1000),
    })

    jest.spyOn(Date, 'now').mockReturnValue(
      BASE_TIME + ETH_USD_CACHE_DURATION_MS - 1500
    )
    const cachedProvider = createProvider(1800)
    await expect(ethState.getUsdValue(cachedProvider)).resolves.toBe(2500)
    expect(cachedProvider.call).not.toHaveBeenCalled()

    jest.spyOn(Date, 'now').mockReturnValue(
      BASE_TIME + ETH_USD_CACHE_DURATION_MS - 500
    )
    const refreshedProvider = createProvider(2100)
    await expect(ethState.getUsdValue(refreshedProvider)).resolves.toBe(2100)
    expect(refreshedProvider.call).toHaveBeenCalledTimes(2)
  })

  it('deduplicates concurrent requests', async () => {
    const provider = createProvider(1800)

    const [first, second] = await Promise.all([
      ethState.getUsdValue(provider),
      ethState.getUsdValue(provider),
    ])

    expect(first).toBe(1800)
    expect(second).toBe(1800)
    expect(provider.call).toHaveBeenCalledTimes(2)
  })

  it('rejects an invalid provider response and retries on the next call', async () => {
    await expect(ethState.getUsdValue(createProvider(0))).rejects.toThrow(
      'Invalid ETH/USD price from provider'
    )
    expect(ethState.getUsdSnapshot()).toBeNull()

    await expect(ethState.getUsdValue(createProvider(1800))).resolves.toBe(1800)
  })

  it('only returns fresh cached values', async () => {
    expect(ethState.getCachedUsdValue()).toBeNull()

    await expect(ethState.getUsdValue(createProvider(1800))).resolves.toBe(1800)
    expect(ethState.getCachedUsdValue()).toBe(1800)

    jest.spyOn(Date, 'now').mockReturnValue(BASE_TIME + ETH_USD_CACHE_DURATION_MS)
    expect(ethState.getCachedUsdValue()).toBeNull()
  })

  it('requests and caches the gas price', async () => {
    const provider = createFeeProvider(20_000_000_000n)

    await expect(ethState.getGasPrice(provider)).resolves.toBe(20_000_000_000n)
    expect(provider.getFeeData).toHaveBeenCalledTimes(1)

    const secondProvider = createFeeProvider(30_000_000_000n)
    await expect(ethState.getGasPrice(secondProvider)).resolves.toBe(20_000_000_000n)
    expect(secondProvider.getFeeData).not.toHaveBeenCalled()
  })

  it('uses the configured provider when none is passed', async () => {
    const provider = createFeeProvider(15_000_000_000n)
    mockedGetProvider.mockReturnValue(provider)

    await expect(ethState.getGasPrice()).resolves.toBe(15_000_000_000n)
    expect(mockedGetProvider).toHaveBeenCalled()
  })

  it('refreshes the gas price after the cache duration', async () => {
    const firstProvider = createFeeProvider(20_000_000_000n)
    await expect(ethState.getGasPrice(firstProvider)).resolves.toBe(20_000_000_000n)

    jest.spyOn(Date, 'now').mockReturnValue(BASE_TIME + GAS_PRICE_CACHE_DURATION_MS - 1)
    const cachedProvider = createFeeProvider(25_000_000_000n)
    await expect(ethState.getGasPrice(cachedProvider)).resolves.toBe(20_000_000_000n)
    expect(cachedProvider.getFeeData).not.toHaveBeenCalled()

    jest.spyOn(Date, 'now').mockReturnValue(BASE_TIME + GAS_PRICE_CACHE_DURATION_MS + 1)
    const refreshedProvider = createFeeProvider(30_000_000_000n)
    await expect(ethState.getGasPrice(refreshedProvider)).resolves.toBe(30_000_000_000n)
    expect(refreshedProvider.getFeeData).toHaveBeenCalledTimes(1)
  })

  it('throws when the provider has no gas price and retries later', async () => {
    await expect(ethState.getGasPrice(createFeeProvider(null))).rejects.toThrow(
      'Failed to get gas price'
    )

    await expect(ethState.getGasPrice(createFeeProvider(10_000_000_000n))).resolves.toBe(
      10_000_000_000n
    )
  })

  it('deduplicates concurrent gas price requests', async () => {
    const provider = createFeeProvider(20_000_000_000n)

    const [first, second] = await Promise.all([
      ethState.getGasPrice(provider),
      ethState.getGasPrice(provider),
    ])

    expect(first).toBe(20_000_000_000n)
    expect(second).toBe(20_000_000_000n)
    expect(provider.getFeeData).toHaveBeenCalledTimes(1)
  })
})
