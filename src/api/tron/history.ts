import { env } from '~/api/env'
import { storage } from '~/utils/storage'
import { NATIVE_TOKEN_SYMBOL, TOKEN_INFO, TRONGRID_BASE_URL } from './config'
import { toTronBase58Address } from './address'

const DEFAULT_PAGE_SIZE = 10
const REQUEST_TIMEOUT_MS = 15000

const TRONGRID_API_KEY_STORAGE_KEY = 'trongridApiKey'

const FALLBACK_TRONGRID_API_KEY = env.VITE_TRONGRID_API_KEY ?? ''

export const getStoredTronGridApiKey = (): string => {
  const stored = storage.get<unknown>(TRONGRID_API_KEY_STORAGE_KEY)
  return typeof stored === 'string' ? stored : ''
}

export const setTronGridApiKey = (apiKey: string): void => {
  storage.set(TRONGRID_API_KEY_STORAGE_KEY, apiKey.trim())
}

export const getTronGridApiKey = (): string => {
  return getStoredTronGridApiKey().trim() || FALLBACK_TRONGRID_API_KEY
}

export interface TransactionRecord {
  hash: string
  timestamp: number
  from: string
  to: string
  value: string
  decimals: number
  direction: 'incoming' | 'outgoing'
  type: string
}

export interface TransactionHistoryPage {
  transactions: TransactionRecord[]
  nextFingerprint: string | null
}

interface TronGridMeta {
  fingerprint?: string
}

interface TronGridResponse<T> {
  data?: T[]
  success?: boolean
  meta?: TronGridMeta
  Error?: string
}

interface Trc20Record {
  transaction_id?: string
  block_timestamp?: number
  from?: string
  to?: string
  value?: string
  type?: string
  token_info?: {
    symbol?: string
    address?: string
    name?: string
    decimals?: number
  }
}

interface NativeRecord {
  txID?: string
  block_timestamp?: number
  ret?: Array<{ contractRet?: string }>
  raw_data?: {
    contract?: Array<{
      type?: string
      parameter?: {
        value?: {
          amount?: number
          owner_address?: string
          to_address?: string
        }
      }
    }>
  }
}

const getApiHeaders = (): Record<string, string> => {
  const apiKey = getTronGridApiKey()
  return apiKey ? { 'TRON-PRO-API-KEY': apiKey } : {}
}

const fetchJson = async <T>(
  path: string,
  params: Record<string, string | number | boolean | undefined>
): Promise<TronGridResponse<T>> => {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value))
  }

  const url = `${TRONGRID_BASE_URL}${path}?${query.toString()}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, { headers: getApiHeaders(), signal: controller.signal })

    if (!response.ok) {
      throw new Error(`TronGrid request failed with status ${response.status}`)
    }

    const payload = await response.json() as TronGridResponse<T>

    if (payload.success === false || payload.Error) {
      throw new Error(payload.Error ?? 'TronGrid request failed')
    }

    return payload
  } finally {
    clearTimeout(timeout)
  }
}

const toTimestampSeconds = (timestamp: number | undefined): number => {
  if (!timestamp || !Number.isFinite(timestamp)) return 0
  return Math.floor(timestamp / 1000)
}

const getDirection = (
  address: string,
  from: string,
  to: string
): 'incoming' | 'outgoing' | null => {
  if (from === address) return 'outgoing'
  if (to === address) return 'incoming'
  return null
}

const readTrc20History = async (
  address: string,
  symbol: string,
  limit: number,
  fingerprint?: string
): Promise<TransactionHistoryPage> => {
  const contractAddress = TOKEN_INFO[symbol]?.contractAddress
  if (!contractAddress) {
    throw new Error(`No TRC20 contract configured for: ${symbol}`)
  }

  const payload = await fetchJson<Trc20Record>(
    `/v1/accounts/${encodeURIComponent(address)}/transactions/trc20`,
    {
      limit,
      only_confirmed: true,
      contract_address: contractAddress,
      fingerprint,
    }
  )

  const decimals = TOKEN_INFO[symbol]?.decimals ?? 6
  const transactions: TransactionRecord[] = []

  for (const record of payload.data ?? []) {
    if (record.type !== 'Transfer') continue
    if (!record.transaction_id || !record.from || !record.to) continue

    const direction = getDirection(address, record.from, record.to)
    if (!direction) continue

    transactions.push({
      hash: record.transaction_id,
      timestamp: toTimestampSeconds(record.block_timestamp),
      from: record.from,
      to: record.to,
      value: record.value ?? '0',
      decimals: record.token_info?.decimals ?? decimals,
      direction,
      type: 'Transfer',
    })
  }

  return {
    transactions,
    nextFingerprint: payload.meta?.fingerprint ?? null,
  }
}

const readNativeHistory = async (
  address: string,
  limit: number,
  fingerprint?: string
): Promise<TransactionHistoryPage> => {
  const payload = await fetchJson<NativeRecord>(
    `/v1/accounts/${encodeURIComponent(address)}/transactions`,
    {
      limit,
      only_confirmed: true,
      fingerprint,
    }
  )

  const decimals = TOKEN_INFO[NATIVE_TOKEN_SYMBOL]?.decimals ?? 6
  const transactions: TransactionRecord[] = []

  for (const record of payload.data ?? []) {
    if (record.ret?.[0]?.contractRet !== 'SUCCESS') continue

    const contract = record.raw_data?.contract?.[0]
    if (contract?.type !== 'TransferContract') continue

    const value = contract.parameter?.value
    const from = toTronBase58Address(value?.owner_address ?? '')
    const to = toTronBase58Address(value?.to_address ?? '')

    if (!record.txID || !from || !to) continue

    const direction = getDirection(address, from, to)
    if (!direction) continue

    transactions.push({
      hash: record.txID,
      timestamp: toTimestampSeconds(record.block_timestamp),
      from,
      to,
      value: String(value?.amount ?? 0),
      decimals,
      direction,
      type: 'Transfer',
    })
  }

  return {
    transactions,
    nextFingerprint: payload.meta?.fingerprint ?? null,
  }
}

/**
 * Reads the latest transactions for a single Tron asset.
 * TRX uses the native account endpoint; other tokens use the TRC20 endpoint.
 */
export async function getTokenHistory(
  address: string,
  symbol: string,
  limit: number = DEFAULT_PAGE_SIZE,
  fingerprint?: string
): Promise<TransactionHistoryPage> {
  if (!TOKEN_INFO[symbol]) {
    throw new Error(`Unknown token symbol: ${symbol}`)
  }

  const base58Address = toTronBase58Address(address)
  if (!base58Address) {
    throw new Error(`Invalid Tron address: ${address}`)
  }

  const pageSize = Math.min(Math.max(1, Math.floor(limit)), 200)

  if (symbol === NATIVE_TOKEN_SYMBOL) {
    return readNativeHistory(base58Address, pageSize, fingerprint)
  }

  return readTrc20History(base58Address, symbol, pageSize, fingerprint)
}
