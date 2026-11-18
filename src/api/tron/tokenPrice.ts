import { TOKEN_INFO, PRICE_CACHE_DURATION_MS } from './config'

const API_URL = 'https://api.coingecko.com/api/v3'
const REQUEST_TIMEOUT_MS = 8000

export type PriceChangeWindow = '24h' | '7d' | '30d'

interface ChangeCache {
  timestamp: number
  changesById: Record<string, number>
}

interface PriceCache {
  timestamp: number
  pricesById: Record<string, number>
}

interface MarketCoin {
  id?: string
  price_change_percentage_7d_in_currency?: number
  price_change_percentage_30d_in_currency?: number
}

let priceCache: PriceCache | null = null
const changeCaches = new Map<PriceChangeWindow, ChangeCache>()
const pendingPriceRequests = new Map<string, Promise<Record<string, number>>>()
const pendingChangeRequests = new Map<string, Promise<Record<string, number>>>()

const getUniqueIds = (symbols: string[]): string[] => {
  const ids = symbols
    .map(symbol => TOKEN_INFO[symbol]?.coingeckoId)
    .filter((id): id is string => Boolean(id))

  return [...new Set(ids)]
}

const fetchJson = async <T>(url: string): Promise<T> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, { signal: controller.signal })

    if (!response.ok) {
      throw new Error(`CoinGecko request failed with status ${response.status}`)
    }

    return await response.json() as T
  } finally {
    clearTimeout(timeout)
  }
}

const toSymbolPrices = (pricesById: Record<string, number>, symbols: string[]): Record<string, number> => {
  const prices: Record<string, number> = {}

  for (const symbol of symbols) {
    const id = TOKEN_INFO[symbol]?.coingeckoId
    if (!id) continue

    const price = pricesById[id]
    if (price !== undefined) {
      prices[symbol] = price
    }
  }

  return prices
}

const fetchPricesById = async (ids: string[]): Promise<Record<string, number>> => {
  const payload = await fetchJson<Record<string, { usd?: number } | undefined>>(
    `${API_URL}/simple/price?ids=${ids.join(',')}&vs_currencies=usd`
  )
  const pricesById: Record<string, number> = {}

  for (const [id, data] of Object.entries(payload)) {
    const price = data?.usd
    if (typeof price === 'number' && Number.isFinite(price) && price >= 0) {
      pricesById[id] = price
    }
  }

  return pricesById
}

/**
 * Returns the current USD price per token symbol.
 * Failures resolve to an empty (or stale cached) map so balances are never blocked.
 */
export const getTokenPrices = async (
  symbols: string[],
  options: { force?: boolean } = {}
): Promise<Record<string, number>> => {
  const ids = getUniqueIds(symbols)
  if (ids.length === 0) return {}

  const cache = priceCache
  const isCacheFresh = cache !== null && Date.now() - cache.timestamp < PRICE_CACHE_DURATION_MS
  const hasAllPrices = cache !== null && ids.every(id => cache.pricesById[id] !== undefined)

  if (!options.force && isCacheFresh && hasAllPrices) {
    return toSymbolPrices(cache.pricesById, symbols)
  }

  const key = [...ids].sort().join(',')
  const pending = pendingPriceRequests.get(key)
  if (pending) {
    return toSymbolPrices(await pending, symbols)
  }

  const request = fetchPricesById(ids)
    .then(pricesById => {
      priceCache = {
        timestamp: Date.now(),
        pricesById: { ...(priceCache?.pricesById ?? {}), ...pricesById }
      }
      return pricesById
    })
    .catch(error => {
      console.warn('Failed to fetch prices from CoinGecko:', error)
      return priceCache?.pricesById ?? {}
    })
    .finally(() => {
      pendingPriceRequests.delete(key)
    })

  pendingPriceRequests.set(key, request)
  return toSymbolPrices(await request, symbols)
}

const fetch24hChangesById = async (ids: string[]): Promise<Record<string, number>> => {
  const payload = await fetchJson<Record<string, { usd_24h_change?: number } | undefined>>(
    `${API_URL}/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`
  )
  const changesById: Record<string, number> = {}

  for (const [id, data] of Object.entries(payload)) {
    const change = data?.usd_24h_change
    if (typeof change === 'number' && Number.isFinite(change)) {
      changesById[id] = change
    }
  }

  return changesById
}

const fetchMarketChanges = async (ids: string[]): Promise<Record<'7d' | '30d', Record<string, number>>> => {
  const payload = await fetchJson<MarketCoin[]>(
    `${API_URL}/coins/markets?vs_currency=usd&ids=${ids.join(',')}&price_change_percentage=7d,30d`
  )
  const changes: Record<'7d' | '30d', Record<string, number>> = { '7d': {}, '30d': {} }

  if (!Array.isArray(payload)) return changes

  for (const coin of payload) {
    if (!coin?.id) continue

    const sevenDayChange = coin.price_change_percentage_7d_in_currency
    if (typeof sevenDayChange === 'number' && Number.isFinite(sevenDayChange)) {
      changes['7d'][coin.id] = sevenDayChange
    }

    const thirtyDayChange = coin.price_change_percentage_30d_in_currency
    if (typeof thirtyDayChange === 'number' && Number.isFinite(thirtyDayChange)) {
      changes['30d'][coin.id] = thirtyDayChange
    }
  }

  return changes
}

const storeChanges = (window: PriceChangeWindow, changesById: Record<string, number>, timestamp: number): void => {
  const cached = changeCaches.get(window)

  changeCaches.set(window, {
    timestamp,
    changesById: { ...(cached?.changesById ?? {}), ...changesById }
  })
}

const loadChanges = async (ids: string[], window: PriceChangeWindow): Promise<Record<string, number>> => {
  const timestamp = Date.now()

  if (window === '24h') {
    const changesById = await fetch24hChangesById(ids)
    storeChanges('24h', changesById, timestamp)
    return changesById
  }

  const changesByWindow = await fetchMarketChanges(ids)
  storeChanges('7d', changesByWindow['7d'], timestamp)
  storeChanges('30d', changesByWindow['30d'], timestamp)

  return changesByWindow[window]
}

const toSymbolChanges = (changesById: Record<string, number>, symbols: string[]): Record<string, number> => {
  const changes: Record<string, number> = {}

  for (const symbol of symbols) {
    const id = TOKEN_INFO[symbol]?.coingeckoId
    if (!id) continue

    const change = changesById[id]
    if (change !== undefined) {
      changes[symbol] = change
    }
  }

  return changes
}

/**
 * Returns price change percentages for the requested window keyed by token symbol.
 * 24h uses /simple/price; 7d and 30d use /coins/markets and are cached per window.
 */
export const getPriceChanges = async (
  symbols: string[],
  window: PriceChangeWindow,
  options: { force?: boolean } = {}
): Promise<Record<string, number>> => {
  const ids = getUniqueIds(symbols)
  if (ids.length === 0) return {}

  const cache = changeCaches.get(window)
  const isCacheFresh = cache !== undefined && Date.now() - cache.timestamp < PRICE_CACHE_DURATION_MS

  if (!options.force && isCacheFresh) {
    return toSymbolChanges(cache.changesById, symbols)
  }

  const key = `${window}:${[...ids].sort().join(',')}`
  const pending = pendingChangeRequests.get(key)
  if (pending) {
    return toSymbolChanges(await pending, symbols)
  }

  const request = loadChanges(ids, window)
    .catch(error => {
      console.warn(`Failed to fetch ${window} changes from CoinGecko:`, error)
      return changeCaches.get(window)?.changesById ?? {}
    })
    .finally(() => {
      pendingChangeRequests.delete(key)
    })

  pendingChangeRequests.set(key, request)
  return toSymbolChanges(await request, symbols)
}
