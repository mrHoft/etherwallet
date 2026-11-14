<template>
  <div class="card-balance">
    <div class="balance-info">
      <div class="balance-value">{{ balanceTotal }}</div>
      <div v-if="dailyChangeLabel" class="balance-change" :class="dailyChangeClass">
        {{ dailyChangeLabel }}
      </div>
    </div>
    <div @click.stop="handleShowSwitch" class="button-switch">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path :d="enabled ? iconView.off : iconView.on" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getPortfolioValue } from '~/api/multicall3';
import { get24hChanges } from '~/api/marketChange';
import { TOKEN_INFO } from '~/api/const';
import { calculatePortfolioDelta, type PortfolioDelta } from '~/utils/portfolioDelta';
import { getStoredWalletAccount } from '~/utils/accountBalance';
import { storage } from '~/utils/storage';

const enabled = ref(false)
const balanceTotal = ref<string>('...')
const dailyChange = ref<PortfolioDelta | null>(null)
const props = defineProps<{ address: string }>()

const dailyChangeLabel = computed<string>(() => {
  const change = dailyChange.value

  if (!enabled.value || !change || change.deltaPercent === null || change.coveredUsd <= 0) {
    return ''
  }

  const absoluteUsd = Math.floor(Math.abs(change.deltaUsd))
  const usdSign = change.deltaUsd < 0 ? '-' : '+'
  const percentSign = change.deltaPercent > 0 ? '+' : ''

  return `${usdSign}$${absoluteUsd} (${percentSign}${change.deltaPercent.toFixed(2)}%) 24h`
})

const dailyChangeClass = computed<string>(() => {
  const change = dailyChange.value
  if (!change || change.deltaUsd === 0) return 'neutral'

  return change.deltaUsd < 0 ? 'negative' : 'positive'
})

const iconView = {
  on: 'm21.94,11.72C17.8,2.77,6.19,2.78,2.06,11.72c-.08.18-.08.39,0,.57.03.07.74,1.72,2.3,3.37,2.09,2.2,4.73,3.36,7.64,3.36s5.55-1.16,7.64-3.36c1.57-1.65,2.28-3.3,2.3-3.37.08-.18.08-.39,0-.57Zm-18.14.28c3.71-6.99,12.8-6.99,16.4,0-3.71,7.01-13.02,7.01-16.4,0Zm8.2-3.49c-4.67.14-4.67,6.86,0,7,4.67-.14,4.66-6.85,0-7Z',
  off: 'm5.4,14.36c-.62-.67-1.16-1.46-1.6-2.37,2.03-3.83,5.68-5.55,9.15-5.18l1.49-1.49c-4.66-1.13-9.89.99-12.39,6.39-.08.18-.08.39,0,.57.03.07.71,1.63,2.18,3.24l1.15-1.15Zm16.54-2.65c-.91-1.96-2.19-3.47-3.66-4.57l2.2-2.2-1.41-1.41L3.51,19.07l1.41,1.41,2.54-2.54c5.83,2.81,12.01-.21,14.47-5.67.08-.18.08-.39,0-.57Zm-13.18,4.95l1.57-1.57c3.59,1.62,6.22-1.95,4.75-4.75l1.97-1.97c1.24.86,2.33,2.06,3.14,3.63-2.47,4.66-7.41,6.2-11.44,4.67Z'
}

const seedStoredTotal = (): boolean => {
  const stored = getStoredWalletAccount(props.address)
  if (!stored) return false

  balanceTotal.value = `$${stored.totalUsd.toFixed(2)}`
  return true
}

const requestBalance = async () => {
  if (!enabled.value) {
    balanceTotal.value = '...'
    dailyChange.value = null
    return
  }

  dailyChange.value = null
  const hasStoredTotal = seedStoredTotal()

  if (!hasStoredTotal) {
    balanceTotal.value = '$--.--'
  }

  const changesPromise = get24hChanges(Object.keys(TOKEN_INFO))

  try {
    const data = await getPortfolioValue(props.address, Object.keys(TOKEN_INFO))
    balanceTotal.value = `$${data.totalUsdValue.toFixed(2)}`

    const changes = await changesPromise
    dailyChange.value = calculatePortfolioDelta(data.balances, changes)
  } catch (error) {
    console.error('Failed to fetch portfolio value:', error)
    if (!hasStoredTotal) {
      balanceTotal.value = '$--.--'
    }
  }
}

const handleShowSwitch = () => {
  enabled.value = !enabled.value
  storage.set('settings.showBalance', enabled.value)
  requestBalance()
}

onMounted(() => {
  enabled.value = storage.get<boolean>('settings.showBalance')
  requestBalance()
})
</script>

<style scoped>
.card-balance {
  display: flex;
  column-gap: 0.5rem;
  align-items: center;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
}

.button-switch {
  cursor: pointer;
  flex-shrink: 0;
  padding: 0.25rem;
}

.button-switch svg {
  display: block;
  color: var(--color60);
  transition: all 0.2s ease;
}

.button-switch:hover svg {
  color: var(--color-accent80);
  transform: scale(1.1);
}

.balance-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.1;
}

.balance-value {
  font-family: var(--mono);
  font-size: 0.9rem;
  font-weight: 500;
}

.balance-change {
  margin-top: 0.125rem;
  font-family: var(--mono);
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap;
}

.balance-change.positive {
  color: var(--color-up);
}

.balance-change.negative {
  color: var(--color-down);
}

.balance-change.neutral {
  color: var(--color60);
}
</style>
