<template>
  <div class="wallet-balance">
    <div v-if="initialLoading && tokenBalances.length === 0" class="loading-state">
      <div class="loading-spinner"></div>
      <p class="loading-text">Loading balances...</p>
    </div>

    <div v-else-if="error && tokenBalances.length === 0" class="error-state-mini">
      <p class="error-message-mini">{{ error }}</p>
      <button @click="refreshBalances" class="retry-button">Retry</button>
    </div>

    <div v-else class="balances-container">
      <div v-for="token in tokenBalances" :key="token.symbol" class="balance-card"
        :class="`${token.symbol.toLowerCase()}-card`">
        <div class="token-icon" :class="token.symbol.toLowerCase()">
          {{ getTokenIcon(token.symbol) }}
        </div>
        <div class="balance-info">
          <h3 class="token-name">{{ token.name }}</h3>
          <p class="token-symbol">{{ token.symbol }}</p>
        </div>
        <div class="balance-amount">
          <span class="amount">{{ token.formattedBalance }}</span>
          <span v-if="token.loading" class="loading-indicator">...</span>
        </div>
      </div>

      <div v-if="tokenBalances.length === 0 && !initialLoading" class="no-tokens">
        <p class="no-tokens-text">No token balances found</p>
      </div>

      <div v-if="hasPendingFetches" class="loading-more">
        <div class="loading-spinner-small"></div>
        <p class="loading-text-small">Loading more balances...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getETHBalance, getTokenBalance, weiToEth, tokenBalanceToHuman } from '~/api/etherscan.api'
import { TOKEN_INFO } from '~/api/const'

interface Props {
  walletAddress: string
  chainId?: number
}

interface TokenBalance {
  symbol: string
  name: string
  contractAddress?: string
  decimals?: number
  rawBalance?: string
  formattedBalance: string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  chainId: 1
})

const initialLoading = ref<boolean>(true)
const error = ref<string>('')
const tokenBalances = ref<TokenBalance[]>([])
const pendingFetches = ref<number>(0)

const hasPendingFetches = computed<boolean>(() => pendingFetches.value > 0)

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
  // Sort to keep ETH first, then alphabetically by symbol
  tokenBalances.value.sort((a, b) => {
    if (a.symbol === 'ETH') return -1
    if (b.symbol === 'ETH') return 1
    return a.symbol.localeCompare(b.symbol)
  })
}

const fetchEthBalance = async (): Promise<void> => {
  pendingFetches.value++

  // Add ETH placeholder with loading state
  addOrUpdateBalance({
    symbol: 'ETH',
    name: 'Ethereum',
    formattedBalance: 'Loading...',
    loading: true
  })

  try {
    const ethWei = await getETHBalance(props.walletAddress, props.chainId)
    const ethBalance = weiToEth(ethWei)
    const balanceNum = parseFloat(ethBalance)

    addOrUpdateBalance({
      symbol: 'ETH',
      name: 'Ethereum',
      formattedBalance: balanceNum === 0 ? '0.0000 ETH' : `${balanceNum.toFixed(4)} ETH`,
      loading: false
    })
  } catch {
    addOrUpdateBalance({
      symbol: 'ETH',
      name: 'Ethereum',
      formattedBalance: 'Failed to load',
      loading: false
    })
    console.error('Failed to fetch ETH balance')
  } finally {
    pendingFetches.value--
  }
}

const fetchTokenBalance = async (symbol: string, contractAddress: string): Promise<void> => {
  pendingFetches.value++
  const tokenInfo = TOKEN_INFO[symbol as keyof typeof TOKEN_INFO]

  // Add token placeholder with loading state
  addOrUpdateBalance({
    symbol: tokenInfo.symbol,
    name: tokenInfo.name,
    contractAddress,
    decimals: tokenInfo.decimals,
    formattedBalance: 'Loading...',
    loading: true
  })

  try {
    const rawBalance = await getTokenBalance(props.walletAddress, contractAddress, props.chainId)
    const humanBalance = tokenBalanceToHuman(rawBalance, tokenInfo.decimals)
    const balanceNum = parseFloat(humanBalance)

    if (balanceNum >= 0) {
      addOrUpdateBalance({
        symbol: tokenInfo.symbol,
        name: tokenInfo.name,
        contractAddress,
        decimals: tokenInfo.decimals,
        rawBalance,
        formattedBalance: `${balanceNum.toFixed(4)} ${tokenInfo.symbol}`,
        loading: false
      })
    } else {
      /*
      // Remove token if balance is zero (don't show zero balances)
      const index = tokenBalances.value.findIndex(t => t.symbol === symbol)
      if (index !== -1) {
        tokenBalances.value.splice(index, 1)
      }
      */
    }
  } catch {
    // Remove token on error (don't show failed fetches)
    const index = tokenBalances.value.findIndex(t => t.symbol === symbol)
    if (index !== -1) {
      tokenBalances.value.splice(index, 1)
    }
    console.error(`Failed to fetch ${symbol} balance`)
  } finally {
    pendingFetches.value--
  }
}

const refreshBalances = async (): Promise<void> => {
  error.value = ''
  initialLoading.value = true

  // Clear existing balances
  tokenBalances.value = []
  pendingFetches.value = 0

  try {
    // Start fetching ETH and tokens concurrently
    const fetchPromises = []

    // Fetch ETH
    fetchPromises.push(fetchEthBalance())

    // Fetch all tokens
    for (const [symbol, { contractAddress }] of Object.entries(TOKEN_INFO)) {
      fetchPromises.push(fetchTokenBalance(symbol, contractAddress))
    }

    // Wait for all fetches to complete (they will update UI as they finish)
    await Promise.allSettled(fetchPromises)

    // Check if any balances were loaded
    if (tokenBalances.value.length === 0) {
      error.value = 'No token balances found for this address'
    }
  } catch (err) {
    if (tokenBalances.value.length === 0) {
      error.value = 'Failed to load wallet balances. Please try again.'
    }
  } finally {
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

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  min-height: 200px;
}

.loading-spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 0.1875rem solid var(--color40);
  border-top-color: var(--color-accent60);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
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

.loading-text {
  color: var(--color70);
  font-family: var(--sans);
  font-size: 0.875rem;
  margin: 0;
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

.retry-button {
  padding: 0.5rem 1rem;
  background-color: var(--color-accent60);
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-family: var(--sans);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.retry-button:hover {
  background-color: var(--color-accent80);
  transform: translateY(-0.0625rem);
}

.balances-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.balance-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background-color: var(--color20);
  border-radius: 0.5rem;
  border: var(--border-thickness) solid var(--color40);
  transition: all 0.2s ease;
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.balance-card:hover {
  background-color: var(--color30);
  border-color: var(--color50);
  transform: translateX(0.125rem);
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
  border-radius: 0.5rem;
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

.amount {
  display: block;
  font-family: var(--mono);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color90);
  margin-bottom: 0.25rem;
}

.loading-indicator {
  display: inline-block;
  font-family: var(--mono);
  font-size: 0.875rem;
  color: var(--color60);
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
  gap: 0.75rem;
  padding: 1rem;
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
  .balance-card {
    padding: 0.75rem;
  }

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
}
</style>
