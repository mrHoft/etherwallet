<template>
  <div class="wallet-balance">
    <div class="balance-header">
      <div class="total-wrapper">
        <h2 class="total-title">Balance</h2>
        <span v-if="!initialLoading && totalUsdValue > 0" class="total-amount">${{ formatUsd(totalUsdValue) }}</span>
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

    <div v-else class="balances-container">
      <div v-for="token in tokenBalances" :key="token.symbol">
        <div class="balance-card" :class="`${token.symbol.toLowerCase()}-card`"
          @click.stop="handleShowHistory(token.symbol)">
          <div class="token-icon" :class="token.symbol.toLowerCase()">
            {{ getTokenIcon(token.symbol) }}
          </div>
          <div class="balance-info">
            <h3 class="token-name">{{ token.name }}</h3>
            <p class="token-symbol">{{ token.symbol }}</p>
          </div>
          <div class="balance-amount">
            <div class="amount-wrapper">
              <span class="amount">{{ token.formattedBalance }}</span>
              <span v-if="token.loading" class="loading-indicator">...</span>
            </div>
            <span v-if="token.usdValue !== undefined && !token.loading" class="usd-value">
              ${{ formatUsd(token.usdValue) }}
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
import TransactionsHistory from './TransactionsHistory.vue'
import { getTokenBalances } from '~/api/multicall3'
import { TOKEN_INFO } from '~/api/const'

interface Props {
  address: string
  chainId?: number
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
}

const props = withDefaults(defineProps<Props>(), {
  chainId: 1
})

const initialLoading = ref<boolean>(true)
const refreshing = ref<boolean>(false)
const error = ref<string>('')
const tokenBalances = ref<TokenBalance[]>([])
const pendingFetches = ref<number>(0)
const showHistoryFor = ref<string>('')
const hasPendingFetches = computed<boolean>(() => pendingFetches.value > 0)

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

const getTokenIcon = (symbol: string): string => {
  const icons: Record<string, string> = {
    ETH: '⟠',
    USDT: '₮',
    USDC: '$',
    WETH: 'Ⓦ',
  }
  return icons[symbol] || '🪙'
}

const addOrUpdateBalance = (balance: TokenBalance): void => {
  const index = tokenBalances.value.findIndex(t => t.symbol === balance.symbol)
  if (index !== -1) {
    tokenBalances.value[index] = balance
  } else {
    tokenBalances.value.push(balance)
  }
  tokenBalances.value.sort((a, b) => {
    if (a.symbol === 'ETH') return -1
    if (b.symbol === 'ETH') return 1
    return a.symbol.localeCompare(b.symbol)
  })
}

const fetchAllBalances = async (): Promise<void> => {
  pendingFetches.value++

  const symbols = Object.keys(TOKEN_INFO) as Array<keyof typeof TOKEN_INFO>

  for (const symbol of symbols) {
    const tokenInfo = TOKEN_INFO[symbol]
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
      const balanceData = balances[symbol as string]
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
  } catch (err) {
    console.error('Failed to fetch balances:', err)
    error.value = 'Failed to load wallet balances. Please try again.'
    tokenBalances.value = []
  } finally {
    pendingFetches.value--
  }
}

const refreshBalances = async (): Promise<void> => {
  if (refreshing.value) return

  refreshing.value = true
  error.value = ''
  tokenBalances.value = []
  pendingFetches.value = 0

  try {
    await fetchAllBalances()
  } finally {
    refreshing.value = false
    initialLoading.value = false
  }
}

onMounted(() => {
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
  font-size: 1.5rem;
  font-weight: 500;
  color: var(--color80);
  margin: 0;
}

.total-amount {
  display: block;
  font-family: var(--mono);
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  line-height: 1;
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

.token-icon {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 600;
  background-color: var(--color10);
  border-radius: 50%;
  border: var(--border-thickness) solid var(--color40);
}

.token-icon.eth {
  color: #627eea;
}

.token-icon.usdt {
  color: #26a17b;
}

.token-icon.usdc {
  color: #2775ca;
}

.token-icon.weth {
  color: #627eea;
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
  .token-icon {
    width: 2rem;
    height: 2rem;
    font-size: 1.125rem;
  }

  .token-name {
    font-size: 0.875rem;
  }

  .amount {
    font-size: 0.875rem;
  }

  .total-amount {
    font-size: 1.125rem;
  }
}
</style>
