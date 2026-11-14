import { TOKEN_INFO } from './const'

const API_URL = 'https://api.coingecko.com/api/v3/simple/price'
const CACHE_TTL_MS = 5 * 60 * 1000
const REQUEST_TIMEOUT_MS = 8000

interface ChangeCache {
  timestamp: number
  changesById: Record<string, number>
}

let cache: ChangeCache | null = null
const pendingRequests = new Map<string, Promise<Record<string, number>>>()

const getUniqueIds = (symbols: string[]): string[] => {
  const ids = symbols
    .map(symbol => TOKEN_INFO[symbol]?.coingeckoId)
    .filter((id): id is string => Boolean(id))

  return [...new Set(ids)]
}

const fetchChangesById = async (ids: string[]): Promise<Record<string, number>> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const url = `${API_URL}?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`
    const response = await fetch(url, { signal: controller.signal })

    if (!response.ok) {
      throw new Error(`CoinGecko request failed with status ${response.status}`)
    }

    const payload = await response.json() as Record<string, { usd_24h_change?: number } | undefined>
    const changesById: Record<string, number> = {}

    for (const [id, data] of Object.entries(payload)) {
      const change = data?.usd_24h_change
      if (typeof change === 'number' && Number.isFinite(change)) {
        changesById[id] = change
      }
    }

    return changesById
  } finally {
    clearTimeout(timeout)
  }
}

const requestChanges = (ids: string[]): Promise<Record<string, number>> => {
  const key = [...ids].sort().join(',')
  const pending = pendingRequests.get(key)
  if (pending) return pending

  const request = fetchChangesById(ids)
    .then(changesById => {
      cache = {
        timestamp: Date.now(),
        changesById: { ...(cache?.changesById ?? {}), ...changesById }
      }

      return cache.changesById
    })
    .catch(error => {
      console.warn('Failed to fetch 24h changes from CoinGecko:', error)
      return cache?.changesById ?? {}
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
 * Returns 24h price change percentages keyed by token symbol.
 * Failures resolve to an empty (or stale cached) map so balance display is never blocked.
 */
export const get24hChanges = async (symbols: string[], options: { force?: boolean } = {}): Promise<Record<string, number>> => {
  const ids = getUniqueIds(symbols)
  if (ids.length === 0) return {}

  const isCacheFresh = cache !== null && Date.now() - cache.timestamp < CACHE_TTL_MS

  if (!options.force && isCacheFresh) {
    return toSymbolChanges(cache!.changesById, symbols)
  }

  const changesById = await requestChanges(ids)
  return toSymbolChanges(changesById, symbols)
}
