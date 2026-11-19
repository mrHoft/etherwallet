/// <reference types="jest" />

jest.mock('~/api/tron/tokenPrice', () => ({
  getTokenPrices: jest.fn(),
}))

jest.mock('~/utils/accountBalance', () => ({
  getStoredAccounts: jest.fn(),
}))

import { getStoredAccounts } from '~/utils/accountBalance'
import { getTokenPrices } from './tokenPrice'
import { TronState, tronState } from './tronState'

const BASE_TIME = 1_700_000_000_000
const USD_CACHE_DURATION_MS = 5 * 60 * 1000
const FEE_CACHE_DURATION_MS = 30 * 1000
const CHAIN_PARAMETERS_URL = 'https://api.trongrid.io/wallet/getchainparameters'

const jsonResponse = (data: unknown, ok = true, status = 200): Response => ({
  ok,
  status,
  json: jest.fn().mockResolvedValue(data),
} as unknown as Response)

const chainParameters = (parameters: Array<{ key: string; value?: number }>): unknown => ({
  chainParameter: parameters,
})

const DEFAULT_CHAIN_PARAMETERS = chainParameters([
  { key: 'getEnergyFee', value: 100 },
  { key: 'getTransactionFee', value: 1000 },
])

const createStoredAccount = (priceUsd: number, updatedAt: number) => ({
  totalUsd: 100,
  accountBalance: 100,
  createdAt: updatedAt,
  updatedAt,
  tokens: {
    TRX: {
      raw: '1000000',
      usdValue: 0.3,
      priceUsd,
    },
  },
})

describe('tronState', () => {
  const mockedGetStoredAccounts = getStoredAccounts as jest.Mock
  const mockedGetTokenPrices = getTokenPrices as jest.Mock

  let fetchMock: jest.Mock

  beforeEach(() => {
    tronState.clear()
    jest.resetAllMocks()
    mockedGetStoredAccounts.mockReturnValue({})
    mockedGetTokenPrices.mockResolvedValue({})

    fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch

    jest.spyOn(Date, 'now').mockReturnValue(BASE_TIME)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete (global as { fetch?: unknown }).fetch
  })

  it('exposes a singleton TronState instance', () => {
    expect(tronState).toBeInstanceOf(TronState)
  })

  it('seeds the USD value from a fresh stored wallet record', async () => {
    mockedGetStoredAccounts.mockReturnValue({
      wallet: createStoredAccount(0.31, BASE_TIME - 1000),
    })

    await expect(tronState.getUsdValue()).resolves.toBe(0.31)

    expect(mockedGetTokenPrices).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(tronState.getUsdSnapshot()).toEqual({ value: 0.31, updatedAt: BASE_TIME - 1000 })
  })

  it('uses the newest fresh record and ignores stale ones', async () => {
    mockedGetStoredAccounts.mockReturnValue({
      newer: createStoredAccount(0.32, BASE_TIME - 1000),
      older: createStoredAccount(0.31, BASE_TIME - 60_000),
      stale: createStoredAccount(9.99, BASE_TIME - USD_CACHE_DURATION_MS - 1),
    })

    await expect(tronState.getUsdValue()).resolves.toBe(0.32)
    expect(mockedGetTokenPrices).not.toHaveBeenCalled()
  })

  it('ignores fresh records without a usable TRX price', async () => {
    mockedGetStoredAccounts.mockReturnValue({
      zero: createStoredAccount(0, BASE_TIME - 1000),
      missing: {
        totalUsd: 10,
        accountBalance: 10,
        createdAt: BASE_TIME - 1000,
        updatedAt: BASE_TIME - 1000,
        tokens: {},
      },
    })
    mockedGetTokenPrices.mockResolvedValue({ TRX: 0.33 })

    await expect(tronState.getUsdValue()).resolves.toBe(0.33)

    expect(mockedGetTokenPrices).toHaveBeenCalledWith(['TRX'])
    expect(tronState.getUsdSnapshot()).toEqual({ value: 0.33, updatedAt: BASE_TIME })
  })

  it('requests the price from CoinGecko when no fresh record exists', async () => {
    mockedGetStoredAccounts.mockReturnValue({
      stale: createStoredAccount(9.99, BASE_TIME - USD_CACHE_DURATION_MS),
    })
    mockedGetTokenPrices.mockResolvedValue({ TRX: 0.34 })

    await expect(tronState.getUsdValue()).resolves.toBe(0.34)

    expect(mockedGetTokenPrices).toHaveBeenCalledWith(['TRX'])
    expect(tronState.getUsdSnapshot()).toEqual({ value: 0.34, updatedAt: BASE_TIME })
  })

  it('caches the USD value for the cache duration', async () => {
    mockedGetTokenPrices
      .mockResolvedValueOnce({ TRX: 0.3 })
      .mockResolvedValueOnce({ TRX: 0.4 })

    await expect(tronState.getUsdValue()).resolves.toBe(0.3)
    expect(mockedGetTokenPrices).toHaveBeenCalledTimes(1)

    jest.spyOn(Date, 'now').mockReturnValue(BASE_TIME + USD_CACHE_DURATION_MS - 1)
    await expect(tronState.getUsdValue()).resolves.toBe(0.3)
    expect(mockedGetTokenPrices).toHaveBeenCalledTimes(1)

    jest.spyOn(Date, 'now').mockReturnValue(BASE_TIME + USD_CACHE_DURATION_MS)
    await expect(tronState.getUsdValue()).resolves.toBe(0.4)
    expect(mockedGetTokenPrices).toHaveBeenCalledTimes(2)
  })

  it('deduplicates concurrent USD requests', async () => {
    mockedGetTokenPrices.mockResolvedValue({ TRX: 0.3 })

    const [first, second] = await Promise.all([
      tronState.getUsdValue(),
      tronState.getUsdValue(),
    ])

    expect(first).toBe(0.3)
    expect(second).toBe(0.3)
    expect(mockedGetTokenPrices).toHaveBeenCalledTimes(1)
  })

  it('rejects an invalid USD price and retries on the next call', async () => {
    mockedGetTokenPrices
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ TRX: 0.3 })

    await expect(tronState.getUsdValue()).rejects.toThrow('Failed to fetch TRX/USD price')
    expect(tronState.getUsdSnapshot()).toBeNull()

    await expect(tronState.getUsdValue()).resolves.toBe(0.3)
  })

  it('only returns fresh cached USD values', async () => {
    expect(tronState.getCachedUsdValue()).toBeNull()

    mockedGetTokenPrices.mockResolvedValue({ TRX: 0.3 })
    await expect(tronState.getUsdValue()).resolves.toBe(0.3)
    expect(tronState.getCachedUsdValue()).toBe(0.3)

    jest.spyOn(Date, 'now').mockReturnValue(BASE_TIME + USD_CACHE_DURATION_MS)
    expect(tronState.getCachedUsdValue()).toBeNull()
  })

  it('reads both fees from the Tron chain parameters', async () => {
    fetchMock.mockResolvedValue(jsonResponse(DEFAULT_CHAIN_PARAMETERS))

    await expect(tronState.getGasPrice()).resolves.toBe(100n)
    await expect(tronState.getBandwidthPrice()).resolves.toBe(1000n)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(CHAIN_PARAMETERS_URL)
    expect(tronState.getFeesSnapshot()).toEqual({
      energyPrice: 100n,
      bandwidthPrice: 1000n,
      updatedAt: BASE_TIME,
    })
  })

  it('caches the fees for the cache duration', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(DEFAULT_CHAIN_PARAMETERS))
      .mockResolvedValueOnce(jsonResponse(chainParameters([
        { key: 'getEnergyFee', value: 200 },
        { key: 'getTransactionFee', value: 2000 },
      ])))

    await expect(tronState.getGasPrice()).resolves.toBe(100n)

    jest.spyOn(Date, 'now').mockReturnValue(BASE_TIME + FEE_CACHE_DURATION_MS - 1)
    await expect(tronState.getGasPrice()).resolves.toBe(100n)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    jest.spyOn(Date, 'now').mockReturnValue(BASE_TIME + FEE_CACHE_DURATION_MS)
    await expect(tronState.getGasPrice()).resolves.toBe(200n)
    await expect(tronState.getBandwidthPrice()).resolves.toBe(2000n)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('deduplicates concurrent fee requests across both getters', async () => {
    fetchMock.mockResolvedValue(jsonResponse(DEFAULT_CHAIN_PARAMETERS))

    const [gasPrice, bandwidthPrice] = await Promise.all([
      tronState.getGasPrice(),
      tronState.getBandwidthPrice(),
    ])

    expect(gasPrice).toBe(100n)
    expect(bandwidthPrice).toBe(1000n)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects when the energy fee is missing and retries later', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(chainParameters([
        { key: 'getTransactionFee', value: 1000 },
      ])))
      .mockResolvedValueOnce(jsonResponse(DEFAULT_CHAIN_PARAMETERS))

    await expect(tronState.getGasPrice()).rejects.toThrow('Failed to get gas price')
    expect(tronState.getFeesSnapshot()).toBeNull()

    await expect(tronState.getGasPrice()).resolves.toBe(100n)
  })

  it('rejects when the bandwidth fee is missing', async () => {
    fetchMock.mockResolvedValue(jsonResponse(chainParameters([
      { key: 'getEnergyFee', value: 100 },
    ])))

    await expect(tronState.getBandwidthPrice()).rejects.toThrow('Failed to get bandwidth price')
    expect(tronState.getFeesSnapshot()).toBeNull()
  })

  it('rejects a non-positive fee', async () => {
    fetchMock.mockResolvedValue(jsonResponse(chainParameters([
      { key: 'getEnergyFee', value: 0 },
      { key: 'getTransactionFee', value: 1000 },
    ])))

    await expect(tronState.getGasPrice()).rejects.toThrow('Failed to get gas price')
    expect(tronState.getFeesSnapshot()).toBeNull()
  })

  it('rejects a failed chain parameters request and retries later', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, false, 503))
      .mockResolvedValueOnce(jsonResponse(DEFAULT_CHAIN_PARAMETERS))

    await expect(tronState.getGasPrice()).rejects.toThrow(
      'TronGrid request failed with status 503'
    )
    expect(tronState.getFeesSnapshot()).toBeNull()

    await expect(tronState.getGasPrice()).resolves.toBe(100n)
  })

  it('only returns fresh cached fee values', async () => {
    expect(tronState.getCachedGasPrice()).toBeNull()
    expect(tronState.getCachedBandwidthPrice()).toBeNull()

    fetchMock.mockResolvedValue(jsonResponse(DEFAULT_CHAIN_PARAMETERS))
    await tronState.getGasPrice()

    expect(tronState.getCachedGasPrice()).toBe(100n)
    expect(tronState.getCachedBandwidthPrice()).toBe(1000n)

    jest.spyOn(Date, 'now').mockReturnValue(BASE_TIME + FEE_CACHE_DURATION_MS)
    expect(tronState.getCachedGasPrice()).toBeNull()
    expect(tronState.getCachedBandwidthPrice()).toBeNull()
  })
})
