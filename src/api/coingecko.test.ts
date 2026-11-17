jest.mock('~/api/ethereum/config', () => ({
  TOKEN_INFO: {
    ETH: { coingeckoId: 'ethereum' },
    USDC: { coingeckoId: 'usd-coin' },
    WETH: { coingeckoId: 'weth' },
    DUPLICATE_ETH: { coingeckoId: 'ethereum' },
    NO_ID: {},
  },
}))

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

describe('coingecko', () => {
  const baseTime = 1_700_000_000_000

  let coingecko: typeof import('~/api/coingecko')
  let fetchMock: jest.Mock
  let consoleWarn: jest.SpyInstance

  beforeEach(async () => {
    jest.resetModules()
    jest.clearAllMocks()

    fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(Date, 'now').mockReturnValue(baseTime)

    coingecko = await import('~/api/coingecko')
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete (global as { fetch?: unknown }).fetch
  })

  it('maps 24h changes to token symbols and deduplicates ids', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ethereum: { usd_24h_change: 2.5 },
        'usd-coin': { usd_24h_change: -1.25 },
        weth: { usd_24h_change: null },
        missing: { usd_24h_change: 99 },
      })
    )

    const result = await coingecko.getPriceChanges(
      ['ETH', 'USDC', 'WETH', 'DUPLICATE_ETH', 'NO_ID'],
      '24h'
    )

    expect(result).toEqual({ ETH: 2.5, DUPLICATE_ETH: 2.5, USDC: -1.25 })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toBe(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,usd-coin,weth&vs_currencies=usd&include_24hr_change=true'
    )
    expect(fetchMock.mock.calls[0][1]).toEqual({ signal: expect.any(AbortSignal) })
  })

  it('returns an empty map without fetching when no symbol has a CoinGecko id', async () => {
    await expect(coingecko.getPriceChanges(['NO_ID'], '24h')).resolves.toEqual({})
    await expect(coingecko.getPriceChanges([], '7d')).resolves.toEqual({})

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ignores non-finite changes', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ethereum: { usd_24h_change: Number.NaN },
        'usd-coin': { usd_24h_change: Number.POSITIVE_INFINITY },
        weth: { usd_24h_change: 0 },
      })
    )

    await expect(coingecko.getPriceChanges(['ETH', 'USDC', 'WETH'], '24h')).resolves.toEqual({
      WETH: 0,
    })
  })

  it('caches 24h changes until the TTL expires', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ethereum: { usd_24h_change: 1 } }))
      .mockResolvedValueOnce(jsonResponse({ ethereum: { usd_24h_change: 2 } }))

    await expect(coingecko.getPriceChanges(['ETH'], '24h')).resolves.toEqual({ ETH: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    jest.spyOn(Date, 'now').mockReturnValue(baseTime + CACHE_TTL_MS - 1)
    await expect(coingecko.getPriceChanges(['ETH'], '24h')).resolves.toEqual({ ETH: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    jest.spyOn(Date, 'now').mockReturnValue(baseTime + CACHE_TTL_MS)
    await expect(coingecko.getPriceChanges(['ETH'], '24h', { force: true })).resolves.toEqual({
      ETH: 2,
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('bypasses a fresh cache when forced', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ethereum: { usd_24h_change: 1 } }))
      .mockResolvedValueOnce(jsonResponse({ ethereum: { usd_24h_change: 3 } }))

    await coingecko.getPriceChanges(['ETH'], '24h')
    const result = await coingecko.getPriceChanges(['ETH'], '24h', { force: true })

    expect(result).toEqual({ ETH: 3 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns stale cached changes when a refresh fails', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ethereum: { usd_24h_change: 4 } }))
      .mockRejectedValueOnce(new Error('network down'))

    await coingecko.getPriceChanges(['ETH'], '24h')

    const result = await coingecko.getPriceChanges(['ETH'], '24h', { force: true })

    expect(result).toEqual({ ETH: 4 })
    expect(consoleWarn).toHaveBeenCalledWith(
      'Failed to fetch 24h changes from CoinGecko:',
      expect.any(Error)
    )
  })

  it('resolves an empty map when there is no cache and the request fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 429 }))

    await expect(coingecko.getPriceChanges(['ETH'], '24h')).resolves.toEqual({})
    expect(consoleWarn).toHaveBeenCalledTimes(1)
  })

  it('fetches 7d and 30d changes from the markets endpoint and caches both windows', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        {
          id: 'ethereum',
          price_change_percentage_7d_in_currency: 5,
          price_change_percentage_30d_in_currency: 10,
        },
        {
          id: 'usd-coin',
          price_change_percentage_7d_in_currency: -2,
        },
        {
          id: 'weth',
          price_change_percentage_7d_in_currency: Number.NaN,
          price_change_percentage_30d_in_currency: Number.POSITIVE_INFINITY,
        },
        null,
      ])
    )

    await expect(coingecko.getPriceChanges(['ETH', 'USDC', 'WETH'], '7d')).resolves.toEqual({
      ETH: 5,
      USDC: -2,
    })
    await expect(coingecko.getPriceChanges(['ETH', 'USDC', 'WETH'], '30d')).resolves.toEqual({
      ETH: 10,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=ethereum,usd-coin,weth&price_change_percentage=7d,30d'
    )
  })

  it('handles a non-array markets response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'unexpected shape' }))

    await expect(coingecko.getPriceChanges(['ETH'], '7d')).resolves.toEqual({})
    await expect(coingecko.getPriceChanges(['ETH'], '30d')).resolves.toEqual({})
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('keeps 7d and 30d caches independent from the 24h cache', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([{ id: 'ethereum', price_change_percentage_7d_in_currency: 7 }])
      )
      .mockResolvedValueOnce(jsonResponse({ ethereum: { usd_24h_change: 1 } }))

    await expect(coingecko.getPriceChanges(['ETH'], '7d')).resolves.toEqual({ ETH: 7 })
    await expect(coingecko.getPriceChanges(['ETH'], '24h')).resolves.toEqual({ ETH: 1 })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('deduplicates concurrent requests for the same window and ids', async () => {
    let resolveFetch: (response: Response) => void = () => {}

    fetchMock.mockImplementation(
      () =>
        new Promise<Response>(resolve => {
          resolveFetch = resolve
        })
    )

    const first = coingecko.getPriceChanges(['ETH'], '24h', { force: true })
    const second = coingecko.getPriceChanges(['ETH'], '24h', { force: true })

    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveFetch(jsonResponse({ ethereum: { usd_24h_change: 6 } }))

    await expect(Promise.all([first, second])).resolves.toEqual([{ ETH: 6 }, { ETH: 6 }])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
