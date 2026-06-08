<template>
  <div class="transactions-history">
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>Loading transactions...</span>
    </div>

    <div v-else-if="error" class="error-state">
      <span class="error-message">{{ error }}</span>
      <button @click="fetchTransactions" class="retry-button">Retry</button>
    </div>

    <div v-else-if="transactions.length === 0" class="empty-state">
      <span>No transactions found for {{ symbol }}</span>
    </div>

    <div v-else class="transactions-content">
      <div class="table-container">
        <table class="transactions-table">
          <thead>
            <tr>
              <th>timestamp</th>
              <th>hash</th>
              <th>method</th>
              <th>from</th>
              <th>to</th>
              <th>value ({{ symbol }})</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="transaction in transactions" :key="transaction.hash" class="transaction-row">
              <td class="timestamp-cell">{{ formatTimestamp(transaction.timeStamp) }}</td>
              <td>
                <a :href="`https://etherscan.io/tx/${transaction.hash}`" target="_blank" rel="noopener noreferrer"
                  class="hash-link">
                  {{ formatHash(transaction.hash) }}
                </a>
              </td>
              <td class="method-cell">
                <span :class="['method-badge', getMethod(transaction.functionName)]">
                  {{ getMethod(transaction.functionName) }}
                </span>
              </td>
              <td class="address-cell">{{ formatAddress(transaction.from) }}</td>
              <td class="address-cell">{{ formatAddress(transaction.to) }}</td>
              <td class="value-cell" :class="getValueClass(transaction.from, transaction.to)">
                {{ formatTokenValue(transaction.value, transaction.tokenDecimal) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination-controls">
        <button @click="changePage(currentPage - 1)" :disabled="currentPage === 1 || loading" class="pagination-button">
          prev
        </button>
        <span class="page-info">page: {{ currentPage }}</span>
        <button @click="changePage(currentPage + 1)" :disabled="transactions.length < itemsPerPage || loading"
          class="pagination-button">
          next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { getTokenHistory, type TransactionRecord } from '~/api/etherscan.ts'

interface Props { address: string, symbol: string }

const props = defineProps<Props>()

const transactions = ref<TransactionRecord[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const currentPage = ref(1)
const itemsPerPage = 10

const fetchTransactions = async () => {
  if (!props.address || !props.symbol) return

  loading.value = true
  error.value = null

  try {
    const data = await getTokenHistory(props.address, props.symbol, itemsPerPage, currentPage.value)
    transactions.value = data
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load transactions'
    transactions.value = []
  } finally {
    loading.value = false
  }
}

const changePage = (newPage: number) => {
  if (newPage < 1) return
  currentPage.value = newPage
  fetchTransactions()
}

const formatAddress = (address: string): string => {
  if (!address) return '--'
  return `...${address.slice(-6)}`
}

const formatHash = (hash: string): string => {
  if (!hash) return '--'
  return `...${hash.slice(-6)}`
}

const formatTimestamp = (timestamp: string): string => {
  if (!timestamp) return '--'
  const date = new Date(parseInt(timestamp) * 1000)
  return date.toLocaleString()
}

const formatTokenValue = (value: string, decimals: string): string => {
  if (!value) return '0'
  const decimalPlaces = parseInt(decimals)
  const rawValue = BigInt(value)
  const divisor = BigInt(10 ** decimalPlaces)
  const integerPart = rawValue / divisor
  const fractionalPart = rawValue % divisor

  if (fractionalPart === BigInt(0)) {
    return integerPart.toString()
  }

  const fractionalStr = fractionalPart.toString().padStart(decimalPlaces, '0')
  const trimmedFractional = fractionalStr.replace(/0+$/, '')

  return `${integerPart}.${trimmedFractional}`
}

const getValueClass = (from: string, to: string): string => {
  if (from.toLowerCase() === props.address.toLowerCase()) return 'outgoing'
  if (to.toLowerCase() === props.address.toLowerCase()) return 'incoming'
  return ''
}

const getMethod = (methodName: string): string => {
  const method = (methodName || 'transfer').toLowerCase()
  if (method.startsWith('swap')) return 'swap'
  if (method.startsWith('execute')) return 'execute'
  if (method.startsWith('transact')) return 'transact'
  return 'transfer'
}

watch(
  () => [props.address, props.symbol],
  () => {
    currentPage.value = 1
    fetchTransactions()
  },
  { immediate: true }
)
</script>

<style scoped>
.transactions-history {
  width: 100%;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 3rem;
  text-align: center;
  color: var(--color80);
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: var(--border-thickness) solid var(--color30);
  border-top-color: var(--color-accent60);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-message {
  color: #dc3545;
  background: rgba(220, 53, 69, 0.1);
  padding: 0.75rem 1rem;
  border-radius: 0.375rem;
}

.retry-button {
  background: var(--color-accent50);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background 0.2s;
}

.retry-button:hover {
  background: var(--color-accent60);
}

.transactions-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.pagination-controls {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.pagination-button {
  background: var(--color20);
  color: var(--color90);
  border: var(--border-thickness) solid var(--color40);
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
}

.pagination-button:hover:not(:disabled) {
  background: var(--color30);
  border-color: var(--color-accent60);
}

.pagination-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.page-info {
  color: var(--color80);
  font-size: 0.875rem;
}

.table-container {
  overflow-x: auto;
  max-height: 60vh;
  overflow-y: auto;
}

.transactions-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.transactions-table thead {
  position: sticky;
  top: 0;
  z-index: 10;
}

.transactions-table th {
  text-align: left;
  padding: 0.25rem 0.5rem;
  background: var(--color10);
  color: var(--color80);
  font-weight: 600;
  border-bottom: var(--border-thickness) solid var(--color40);
}

.transactions-table td {
  padding: 0.25rem 0.5rem;
  border-bottom: 1px solid var(--color30);
  color: var(--color80);
}

.transaction-row:hover {
  background: rgba(44, 125, 160, 0.1);
}

.hash-link {
  color: var(--color-accent80);
  text-decoration: none;
  font-family: var(--mono);
  font-size: 0.8125rem;
}

.hash-link:hover {
  text-decoration: underline;
  color: var(--color-accent60);
}

.method-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: capitalize;
}

.method-badge.transfer {
  background: rgba(53, 150, 192, 0.2);
  color: var(--color-accent80);
}

.method-badge.swap {
  background: rgba(141, 157, 173, 0.2);
  color: var(--color70);
}

.method-badge.execute {
  background: rgba(114, 130, 146, 0.2);
  color: var(--color80);
}

.method-badge.transact {
  background: rgba(88, 104, 120, 0.2);
  color: var(--color70);
}

.address-cell {
  font-family: var(--mono);
  font-size: 0.8125rem;
}

.value-cell {
  font-weight: 600;
  font-family: var(--mono);
}

.value-cell.incoming {
  color: #28a745;
}

.value-cell.outgoing {
  color: #dc3545;
}

.timestamp-cell {
  font-size: 0.8125rem;
  color: var(--color70);
}
</style>
