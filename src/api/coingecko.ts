import { TOKEN_INFO } from './ethereum/config'

const API_URL = 'https://api.coingecko.com/api/v3'
const CACHE_TTL_MS = 5 * 60 * 1000
const REQUEST_TIMEOUT_MS = 8000

export type PriceChangeWindow = '24h' | '7d' | '30d'

interface ChangeCache {
  timestamp: number
  changesById: Record<string, number>
}

interface MarketCoin {
  id?: string
  price_change_percentage_7d_in_currency?: number
  price_change_percentage_30d_in_currency?: number
}

const caches = new Map<PriceChangeWindow, ChangeCache>()
const pendingRequests = new Map<string, Promise<Record<string, number>>>()

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
  const cached = caches.get(window)

  caches.set(window, {
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

const requestChanges = (ids: string[], window: PriceChangeWindow): Promise<Record<string, number>> => {
  const key = `${window}:${[...ids].sort().join(',')}`
  const pending = pendingRequests.get(key)
  if (pending) return pending

  const request = loadChanges(ids, window)
    .catch(error => {
      console.warn(`Failed to fetch ${window} changes from CoinGecko:`, error)
      return caches.get(window)?.changesById ?? {}
    })
    .finally(() => {
      pendingRequests.delete(key)
    })

  pendingRequests.set(key, request)
  return request
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
 * Failures resolve to an empty (or stale cached) map so balance display is never blocked.
 */
export const getPriceChanges = async (
  symbols: string[],
  window: PriceChangeWindow,
  options: { force?: boolean } = {}
): Promise<Record<string, number>> => {
  const ids = getUniqueIds(symbols)
  if (ids.length === 0) return {}

  const cache = caches.get(window)
  const isCacheFresh = cache !== undefined && Date.now() - cache.timestamp < CACHE_TTL_MS

  if (!options.force && isCacheFresh) {
    return toSymbolChanges(cache.changesById, symbols)
  }

  const changesById = await requestChanges(ids, window)
  return toSymbolChanges(changesById, symbols)
}
