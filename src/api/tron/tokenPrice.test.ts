jest.mock('~/api/env', () => ({ env: {} }))

const CACHE_TTL_MS = 5 * 60 * 1000

interface JsonResponseOptions {
  ok?: boolean
  status?: number
}

const jsonResponse = (
  data: unknown,
  { ok = true, status = 200 }: JsonResponseOptions = {}
): Response => ({
  ok,
  status,
  json: jest.fn().mockResolvedValue(data),
} as unknown as Response)

describe('tron token prices', () => {
  const baseTime = 1_700_000_000_000

  let tokenPrice: typeof import('~/api/tron/tokenPrice')
  let fetchMock: jest.Mock
  let consoleWarn: jest.SpyInstance

  beforeEach(async () => {
    jest.resetModules()
    jest.clearAllMocks()

    fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(Date, 'now').mockReturnValue(baseTime)

    tokenPrice = await import('~/api/tron/tokenPrice')
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete (global as { fetch?: unknown }).fetch
  })

  it('maps USD prices to token symbols', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        tron: { usd: 0.31 },
        tether: { usd: 1 },
        missing: { usd: 99 },
      })
    )

    await expect(tokenPrice.getTokenPrices(['TRX', 'USDT', 'UNKNOWN'])).resolves.toEqual({
      TRX: 0.31,
      USDT: 1,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.coingecko.com/api/v3/simple/price?ids=tron,tether&vs_currencies=usd'
    )
  })

  it('caches prices until the TTL expires', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ tron: { usd: 0.3 } }))
      .mockResolvedValueOnce(jsonResponse({ tron: { usd: 0.4 } }))

    await expect(tokenPrice.getTokenPrices(['TRX'])).resolves.toEqual({ TRX: 0.3 })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    jest.spyOn(Date, 'now').mockReturnValue(baseTime + CACHE_TTL_MS - 1)
    await expect(tokenPrice.getTokenPrices(['TRX'])).resolves.toEqual({ TRX: 0.3 })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    jest.spyOn(Date, 'now').mockReturnValue(baseTime + CACHE_TTL_MS)
    await expect(tokenPrice.getTokenPrices(['TRX'])).resolves.toEqual({ TRX: 0.4 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns stale cached prices when a refresh fails', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ tron: { usd: 0.3 } }))
      .mockRejectedValueOnce(new Error('network down'))

    await tokenPrice.getTokenPrices(['TRX'])

    await expect(tokenPrice.getTokenPrices(['TRX'], { force: true })).resolves.toEqual({
      TRX: 0.3,
    })
    expect(consoleWarn).toHaveBeenCalledWith(
      'Failed to fetch prices from CoinGecko:',
      expect.any(Error)
    )
  })

  it('returns an empty map without fetching when no symbol has a CoinGecko id', async () => {
    await expect(tokenPrice.getTokenPrices(['UNKNOWN'])).resolves.toEqual({})
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps 24h changes to token symbols', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        tron: { usd_24h_change: 2.5 },
        tether: { usd_24h_change: -0.1 },
      })
    )

    await expect(tokenPrice.getPriceChanges(['TRX', 'USDT'], '24h')).resolves.toEqual({
      TRX: 2.5,
      USDT: -0.1,
    })

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.coingecko.com/api/v3/simple/price?ids=tron,tether&vs_currencies=usd&include_24hr_change=true'
    )
  })

  it('fetches 7d and 30d changes and caches both windows', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        {
          id: 'tron',
          price_change_percentage_7d_in_currency: 5,
          price_change_percentage_30d_in_currency: 10,
        },
        {
          id: 'tether',
          price_change_percentage_7d_in_currency: -2,
        },
      ])
    )

    await expect(tokenPrice.getPriceChanges(['TRX', 'USDT'], '7d')).resolves.toEqual({
      TRX: 5,
      USDT: -2,
    })
    await expect(tokenPrice.getPriceChanges(['TRX', 'USDT'], '30d')).resolves.toEqual({
      TRX: 10,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=tron,tether&price_change_percentage=7d,30d'
    )
  })
})
