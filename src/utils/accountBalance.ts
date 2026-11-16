import { formatUnits } from 'ethers'
import { REBASE_TOKEN_SYMBOLS } from '~/api/ethereum/config'
import { storage } from './storage'

const STORAGE_KEY = 'accountBalance'

export interface BalanceData {
  raw: string
  decimals: number
  usdValue?: number
  tokenPriceUsd?: number
}

export interface StoredTokenValue {
  raw: string
  usdValue: number
  priceUsd?: number
}

export interface StoredWalletAccount {
  totalUsd: number
  tokens: Record<string, StoredTokenValue>
  accountBalance: number
  createdAt: number
  updatedAt: number
}

export interface TokenBalanceChange {
  symbol: string
  amount: string
  usdDelta: number
}

export interface AccountBalanceSyncResult {
  accountBalance: number
  totalUsd: number
  allTimeDelta: number
  changes: TokenBalanceChange[]
  isFirstSync: boolean
}

export type AccountBalanceStore = Record<string, StoredWalletAccount>

const readStore = (): AccountBalanceStore => {
  const stored = storage.get<AccountBalanceStore>(STORAGE_KEY)
  return stored && typeof stored === 'object' ? stored : {}
}

export const getStoredAccounts = (): AccountBalanceStore => readStore()

export const getStoredWalletAccount = (address: string): StoredWalletAccount | null => {
  const account = readStore()[address.toLowerCase()]
  return account ?? null
}

export const resetAccountBalance = (): void => {
  storage.remove(STORAGE_KEY)
}

const toRaw = (value: string): bigint | null => {
  try {
    return BigInt(value)
  } catch {
    return null
  }
}

const snapshotTokens = (balances: Record<string, BalanceData>): Record<string, StoredTokenValue> => {
  const tokens: Record<string, StoredTokenValue> = {}

  for (const [symbol, balance] of Object.entries(balances)) {
    tokens[symbol] = {
      raw: balance.raw,
      usdValue: balance.usdValue ?? 0,
      priceUsd: balance.tokenPriceUsd
    }
  }

  return tokens
}

const saveAccount = (address: string, account: StoredWalletAccount): void => {
  const store = readStore()
  store[address.toLowerCase()] = account
  storage.set(STORAGE_KEY, { ...store })
}

/**
 * Compares the current balances with the last stored snapshot, records the
 * income/outcome changes, and corrects the account baseline by their current value.
 */
export const syncAccountBalance = (
  address: string,
  balances: Record<string, BalanceData>,
  totalUsd: number
): AccountBalanceSyncResult => {
  const now = Date.now()
  const previous = getStoredWalletAccount(address)

  if (!previous) {
    const tokens = snapshotTokens(balances)

    saveAccount(address, {
      totalUsd,
      tokens,
      accountBalance: totalUsd,
      createdAt: now,
      updatedAt: now
    })

    return {
      accountBalance: totalUsd,
      totalUsd,
      allTimeDelta: 0,
      changes: [],
      isFirstSync: true
    }
  }

  let accountBalance = Number.isFinite(previous.accountBalance)
    ? previous.accountBalance
    : previous.totalUsd

  const changes: TokenBalanceChange[] = []

  for (const [symbol, balance] of Object.entries(balances)) {
    const currentRaw = toRaw(balance.raw)
    if (currentRaw === null) continue

    const storedToken = previous.tokens?.[symbol]

    if (!storedToken) {
      // A token that was not part of the account before: include its value in the baseline.
      accountBalance += balance.usdValue ?? 0
      continue
    }

    const previousRaw = toRaw(storedToken.raw)
    if (previousRaw === null) {
      accountBalance += balance.usdValue ?? 0
      continue
    }

    const deltaRaw = currentRaw - previousRaw
    if (deltaRaw === 0n) continue

    const absoluteDelta = deltaRaw < 0n ? -deltaRaw : deltaRaw

    // Rebasing balances change from interest, not from wallet transactions.
    if (REBASE_TOKEN_SYMBOLS.has(symbol)) {
      continue
    }

    const price = balance.tokenPriceUsd ?? storedToken.priceUsd
    if (price === undefined || !Number.isFinite(price)) continue

    const amountNumber = Number(formatUnits(absoluteDelta, balance.decimals))
    if (!Number.isFinite(amountNumber)) continue

    const sign = deltaRaw < 0n ? -1 : 1
    const usdDelta = amountNumber * price * sign

    accountBalance += usdDelta
    changes.push({
      symbol,
      amount: `${sign > 0 ? '+' : '-'}${formatUnits(absoluteDelta, balance.decimals)}`,
      usdDelta
    })
  }

  saveAccount(address, {
    ...previous,
    totalUsd,
    tokens: snapshotTokens(balances),
    accountBalance,
    updatedAt: now
  })

  return {
    accountBalance,
    totalUsd,
    allTimeDelta: totalUsd - accountBalance,
    changes,
    isFirstSync: false
  }
}
