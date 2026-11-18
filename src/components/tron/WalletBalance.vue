<template>
  <div class="wallet-balance">
    <div class="balance-header">
      <div class="total-wrapper">
        <h2 class="total-title">Balance:</h2>
        <span v-if="!initialLoading && totalUsdValue > 0" class="total-amount">
          ${{ formatUsd(totalUsdValue) }}
          <span v-if="allTimeDelta !== null" class="total-delta" :class="allTimeDeltaClass">
            ({{ formatDeltaUsd(allTimeDelta) }})
          </span>
          <span v-if="marketDeltaLabel" class="total-delta total-delta--market" :class="marketDeltaClass">
            {{ marketDeltaLabel }}
          </span>
        </span>
      </div>
      <button v-if="!initialLoading && !hasPendingFetches" @click="refreshBalances" class="button-refresh"
        :disabled="refreshing">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2">
          <polygon fill="currentColor" points="12 16.25 12 22.25 8 19.25 12 16.25" />
          <polygon fill="currentColor" points="12 1.75 12 7.75 16 4.75 12 1.75" />
          <path stroke="currentColor" d="m6.71,16.96c-3.52-3.08-2.88-12.41,6.65-12.21" />
          <path stroke="currentColor" d="m17.34,7.04c3.52,3.08,2.88,12.41-6.65,12.21" />
        </svg>
      </button>
    </div>

    <div v-if="error" class="error-state-mini">
      <p class="error-message-mini">{{ error }}</p>
    </div>

    <div v-if="tokenBalances.length > 0 || !error" class="balances-container">
      <div v-for="token in tokenBalances" :key="token.symbol">
        <div class="balance-card" :class="`${token.symbol.toLowerCase()}-card`"
          @click.stop="handleShowHistory(token.symbol)">
          <IconToken :symbol="tokenIcon(token.symbol)" />
          <div class="balance-info">
            <h3 class="token-name">{{ token.name }}</h3>
            <p class="token-symbol">{{ token.symbol }}</p>
            <p v-if="token.changeAmount" class="token-change" :class="tokenChangeClass(token.changeUsd)">
              {{ token.changeAmount }} {{ token.symbol }}
              <span v-if="token.changeUsd !== undefined">({{ formatDeltaUsd(token.changeUsd) }})</span>
            </p>
          </div>
          <div class="balance-amount">
            <div class="amount-wrapper">
              <span class="amount">{{ token.formattedBalance }}</span>
              <span v-if="token.loading" class="loading-indicator">...</span>
            </div>
            <span v-if="token.usdValue !== undefined && !token.loading" class="usd-value">
              ${{ formatUsd(token.usdValue) }}
              <span v-if="formatTokenDelta(token)" class="usd-delta" :class="tokenDeltaClass(token)">
                ({{ formatTokenDelta(token) }})
              </span>
            </span>
          </div>
        </div>
        <TransactionsHistory v-if="showHistoryFor === token.symbol" :address="address" :symbol="token.symbol" />
      </div>

      <div v-if="tokenBalances.length === 0 && !initialLoading" class="no-tokens">
        <p class="no-tokens-text">No token balances found</p>
      </div>

      <div v-if="hasPendingFetches" class="loading-more">
        <div class="loading-spinner-small"></div>
        <p class="loading-text-small">Loading balances...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { formatUnits } from 'ethers'
import TransactionsHistory from './TransactionsHistory.vue'
import IconToken from '~/components/ui/IconToken.vue'
import { getTokenBalances } from '~/api/tron/balances'
import { NATIVE_TOKEN_SYMBOL, TOKEN_INFO } from '~/api/tron/config'
import { getPriceChanges } from '~/api/tron/tokenPrice'
import { calculatePortfolioDelta, type PortfolioDelta } from '~/utils/portfolioDelta'
import { getBalanceDeltaPeriod, type BalanceDeltaPeriod } from '~/utils/balanceDeltaPeriod'
import { getStoredWalletAccount, syncAccountBalance } from '~/utils/accountBalance'

interface Props {
  address: string
}

interface TokenBalance {
  symbol: string
  name: string
  contractAddress?: string
  decimals?: number
  rawBalance?: string
  formattedBalance: string
  usdValue?: number
  loading?: boolean
  changeAmount?: string
  changeUsd?: number
}

const props = defineProps<Props>()

const initialLoading = ref<boolean>(true)
const refreshing = ref<boolean>(false)
const error = ref<string>('')
const tokenBalances = ref<TokenBalance[]>([])
const pendingFetches = ref<number>(0)
const showHistoryFor = ref<string>('')
const allTimeDelta = ref<number | null>(null)
const activePeriod = ref<BalanceDeltaPeriod>('24h')
const priceChanges = ref<Record<string, number>>({})
const hasPendingFetches = computed<boolean>(() => pendingFetches.value > 0)

const tokenIcon = (symbol: string): string => {
  return symbol === NATIVE_TOKEN_SYMBOL ? 'tron' : symbol
}

const handleShowHistory = (symbol: string) => {
  showHistoryFor.value = showHistoryFor.value === symbol ? '' : symbol
}

const totalUsdValue = computed<number>(() => {
  return tokenBalances.value.reduce((total, token) => {
    if (token.usdValue && !token.loading) {
      return total + token.usdValue
    }
    return total
  }, 0)
})

const marketDelta = computed<PortfolioDelta | null>(() => {
  if (activePeriod.value === 'off') return null

  const balances: Record<string, { usdValue?: number }> = {}
  for (const token of tokenBalances.value) {
    balances[token.symbol] = { usdValue: token.usdValue }
  }

  const delta = calculatePortfolioDelta(balances, priceChanges.value)
  return delta.coveredUsd > 0 ? delta : null
})

const formatUsd = (value: number): string => {
  if (value >= 1000) {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  if (value >= 1) {
    return value.toFixed(2)
  }
  if (value >= 0.01) {
    return value.toFixed(4)
  }
  return value.toFixed(6)
}

const formatDeltaUsd = (value: number): string => {
  const absoluteValue = Math.floor(Math.abs(value))
  const sign = value < 0 ? '-' : '+'
  return `${sign}$${absoluteValue.toLocaleString('en-US')}`
}

const allTimeDeltaClass = computed<string>(() => {
  if (allTimeDelta.value === null || allTimeDelta.value === 0) return 'neutral'
  return allTimeDelta.value < 0 ? 'negative' : 'positive'
})

const marketDeltaLabel = computed<string>(() => {
  const delta = marketDelta.value
  if (!delta) return ''
  return `(${formatDeltaUsd(delta.deltaUsd)} ${activePeriod.value})`
})

const marketDeltaClass = computed<string>(() => {
  const delta = marketDelta.value
  if (!delta || delta.deltaUsd === 0) return 'neutral'
  return delta.deltaUsd < 0 ? 'negative' : 'positive'
})

const tokenChangeClass = (usdDelta?: number): string => {
  if (usdDelta === undefined || usdDelta === 0) return 'neutral'
  return usdDelta < 0 ? 'negative' : 'positive'
}

const getTokenDeltaUsd = (token: TokenBalance): number | null => {
  if (activePeriod.value === 'off' || token.loading || !token.usdValue) return null

  const change = priceChanges.value[token.symbol]
  if (change === undefined || !Number.isFinite(change) || change <= -100) return null

  const valueThen = token.usdValue / (1 + change / 100)
  return token.usdValue - valueThen
}

const formatTokenDelta = (token: TokenBalance): string => {
  const delta = getTokenDeltaUsd(token)
  return delta === null ? '' : formatDeltaUsd(delta)
}

const tokenDeltaClass = (token: TokenBalance): string =>
  tokenChangeClass(getTokenDeltaUsd(token) ?? undefined)

const addOrUpdateBalance = (balance: TokenBalance): void => {
  const index = tokenBalances.value.findIndex(t => t.symbol === balance.symbol)
  if (index !== -1) {
    tokenBalances.value[index] = balance
  } else {
    tokenBalances.value.push(balance)
  }
  tokenBalances.value.sort((a, b) => {
    if (a.symbol === NATIVE_TOKEN_SYMBOL) return -1
    if (b.symbol === NATIVE_TOKEN_SYMBOL) return 1
    return a.symbol.localeCompare(b.symbol)
  })
}

const seedFromStorage = (): void => {
  const stored = getStoredWalletAccount(props.address)
  if (!stored) return

  const seeded: TokenBalance[] = []

  for (const symbol of Object.keys(TOKEN_INFO)) {
    const tokenInfo = TOKEN_INFO[symbol]
    const storedToken = stored.tokens?.[symbol]
    if (!storedToken) continue

    let raw: bigint
    try {
      raw = BigInt(storedToken.raw)
    } catch {
      continue
    }

    if (raw <= 0n) continue

    const formattedBalance = parseFloat(formatUnits(raw, tokenInfo.decimals)).toFixed(4)

    seeded.push({
      symbol: tokenInfo.symbol,
      name: tokenInfo.name,
      contractAddress: tokenInfo.contractAddress,
      decimals: tokenInfo.decimals,
      rawBalance: storedToken.raw,
      formattedBalance: `${formattedBalance} ${tokenInfo.symbol}`,
      usdValue: storedToken.usdValue > 0 ? storedToken.usdValue : undefined,
      loading: false
    })
  }

  if (seeded.length === 0) return

  seeded.sort((a, b) => {
    if (a.symbol === NATIVE_TOKEN_SYMBOL) return -1
    if (b.symbol === NATIVE_TOKEN_SYMBOL) return 1
    return a.symbol.localeCompare(b.symbol)
  })

  tokenBalances.value = seeded
  allTimeDelta.value = stored.totalUsd - stored.accountBalance
  initialLoading.value = false
}

const fetchAllBalances = async (): Promise<void> => {
  pendingFetches.value++

  const symbols = Object.keys(TOKEN_INFO)
  const knownSymbols = new Set(tokenBalances.value.map(token => token.symbol))

  for (const symbol of symbols) {
    const tokenInfo = TOKEN_INFO[symbol]
    if (knownSymbols.has(tokenInfo.symbol)) continue

    addOrUpdateBalance({
      symbol: tokenInfo.symbol,
      name: tokenInfo.name,
      contractAddress: tokenInfo.contractAddress,
      decimals: tokenInfo.decimals,
      formattedBalance: 'Loading...',
      loading: true
    })
  }

  try {
    const balances = await getTokenBalances(props.address, symbols)

    for (const symbol of symbols) {
      const balanceData = balances[symbol]
      const tokenInfo = TOKEN_INFO[symbol]

      if (balanceData && parseFloat(balanceData.formatted) > 0) {
        addOrUpdateBalance({
          symbol: tokenInfo.symbol,
          name: tokenInfo.name,
          contractAddress: tokenInfo.contractAddress,
          decimals: tokenInfo.decimals,
          rawBalance: balanceData.raw,
          formattedBalance: `${parseFloat(balanceData.formatted).toFixed(4)} ${tokenInfo.symbol}`,
          usdValue: balanceData.usdValue,
          loading: false
        })
      } else {
        const index = tokenBalances.value.findIndex(t => t.symbol === symbol)
        if (index !== -1) {
          tokenBalances.value.splice(index, 1)
        }
      }
    }

    if (tokenBalances.value.length === 0) {
      error.value = 'No token balances found for this address'
    }

    const totalUsd = Object.values(balances).reduce(
      (total, balance) => total + (balance?.usdValue ?? 0),
      0
    )

    const hasPrices = Object.values(balances).some(balance => balance?.usdValue !== undefined)

    if (hasPrices) {
      try {
        const sync = syncAccountBalance(props.address, balances, totalUsd)
        allTimeDelta.value = sync.allTimeDelta

        for (const change of sync.changes) {
          const token = tokenBalances.value.find(item => item.symbol === change.symbol)
          if (!token) continue

          token.changeAmount = change.amount
          token.changeUsd = change.usdDelta
        }
      } catch (syncError) {
        console.error('Failed to update account balance history:', syncError)
      }
    }
  } catch (err) {
    console.error('Failed to fetch balances:', err)
    error.value = 'Failed to load wallet balances. Please try again.'
  } finally {
    pendingFetches.value--
  }
}

const refreshBalances = async (): Promise<void> => {
  if (refreshing.value) return

  refreshing.value = true
  error.value = ''
  pendingFetches.value = 0

  const period = getBalanceDeltaPeriod()
  activePeriod.value = period
  priceChanges.value = {}

  const changesPromise = period === 'off' ? null : getPriceChanges(Object.keys(TOKEN_INFO), period)

  try {
    await fetchAllBalances()
    initialLoading.value = false

    if (changesPromise) {
      priceChanges.value = await changesPromise
    }
  } finally {
    refreshing.value = false
    initialLoading.value = false
  }
}

onMounted(() => {
  seedFromStorage()
  refreshBalances()
})

defineExpose({
  refreshBalances
})
</script>

<style scoped>
.wallet-balance {
  width: 100%;
}

.balance-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding: 0 0.5rem;
}

.total-wrapper {
  display: flex;
  column-gap: 0.5rem;
  align-items: baseline;
}

.total-title {
  font-family: var(--heading);
  font-size: 1rem;
  font-weight: 500;
  color: var(--color80);
  margin: 0;
}

.total-amount {
  display: block;
  font-family: var(--mono);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
}

.total-delta {
  font-weight: 600;
  margin-left: 0.25rem;
}

.total-delta.positive {
  color: var(--color-up);
}

.total-delta.negative {
  color: var(--color-down);
}

.total-delta.neutral {
  color: var(--color60);
}

.loading-spinner-small {
  width: 1.25rem;
  height: 1.25rem;
  border: 0.125rem solid var(--color40);
  border-top-color: var(--color-accent60);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text-small {
  color: var(--color70);
  font-family: var(--sans);
  font-size: 0.75rem;
  margin: 0;
}

.error-state-mini {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
  padding: 2rem;
  background-color: rgba(220, 38, 38, 0.1);
  border-radius: 0.5rem;
  border: var(--border-thickness) solid #ef4444;
}

.error-message-mini {
  color: #ef4444;
  font-family: var(--sans);
  font-size: 0.875rem;
  margin: 0;
}

.button-refresh {
  padding: 0.25rem;
  background-color: var(--color-accent60);
  color: white;
  border: none;
  border-radius: 0.325rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.button-refresh:hover:not(:disabled) {
  background-color: var(--color-accent80);
  transform: scale(1.05);
}

.button-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button-refresh svg {
  display: block;
}

.balances-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.balance-card {
  display: flex;
  align-items: center;
  column-gap: 1rem;
  padding: 0.5rem;
  background-color: var(--color20);
  border-radius: 0.5rem;
  border: var(--border-thickness) solid var(--color40);
  animation: fadeIn 0.3s ease-in;
  transition: border-color 0.2s ease;
}

.balance-card:hover {
  border-color: var(--color-accent60);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-0.625rem);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.balance-info {
  flex: 1;
}

.token-name {
  font-family: var(--heading);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color90);
  margin: 0 0 0.25rem 0;
}

.token-symbol {
  font-family: var(--mono);
  font-size: 0.75rem;
  color: var(--color70);
  margin: 0;
  text-transform: uppercase;
}

.token-change {
  margin: 0.25rem 0 0;
  font-family: var(--mono);
  font-size: 0.75rem;
  font-weight: 600;
}

.token-change.positive {
  color: var(--color-up);
}

.token-change.negative {
  color: var(--color-down);
}

.token-change.neutral {
  color: var(--color60);
}

.balance-amount {
  text-align: right;
}

.amount-wrapper {
  margin-bottom: 0.25rem;
}

.amount {
  display: inline-block;
  font-family: var(--mono);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color90);
}

.usd-value {
  display: block;
  font-family: var(--mono);
  font-size: 0.75rem;
  color: var(--color-accent80);
  font-weight: 500;
}

.usd-delta {
  margin-left: 0.25rem;
  font-weight: 600;
}

.usd-delta.positive {
  color: var(--color-up);
}

.usd-delta.negative {
  color: var(--color-down);
}

.usd-delta.neutral {
  color: var(--color60);
}

.loading-indicator {
  display: inline-block;
  font-family: var(--mono);
  font-size: 0.875rem;
  color: var(--color60);
  margin-left: 0.5rem;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background-color: var(--color20);
  border-radius: 0.5rem;
  border: var(--border-thickness) solid var(--color40);
}

.no-tokens {
  text-align: center;
  padding: 2rem;
  background-color: var(--color10);
  border-radius: 0.5rem;
  border: var(--border-thickness) solid var(--color40);
}

.no-tokens-text {
  color: var(--color70);
  font-family: var(--sans);
  font-size: 0.875rem;
  margin: 0;
}

@media (max-width: 768px) {
  .token-name {
    font-size: 0.875rem;
  }

  .amount {
    font-size: 0.875rem;
  }

  .total-amount {
    font-size: 1rem;
  }
}
</style>
