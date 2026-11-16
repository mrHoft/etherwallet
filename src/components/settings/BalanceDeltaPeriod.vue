<template>
  <SettingsSection title="Balance delta period"
    description="Choose the time window used for the portfolio balance change. Off hides the change.">
    <div class="delta-period-options" role="group" aria-label="Balance delta period">
      <button v-for="option in options" :key="option.value" type="button"
        :class="['delta-period-option', { 'delta-period-option--active': period === option.value }]"
        :aria-pressed="period === option.value" @click="setPeriod(option.value)">
        <span>{{ option.label }}</span>
      </button>
    </div>
  </SettingsSection>
</template>

<script setup lang="ts">
import SettingsSection from '~/components/settings/SettingsSection.vue'
import { useBalanceDeltaPeriod } from '~/composables/useBalanceDeltaPeriod'
import type { BalanceDeltaPeriod } from '~/utils/balanceDeltaPeriod'

interface PeriodOption {
  value: BalanceDeltaPeriod
  label: string
}

const options: PeriodOption[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'off', label: 'Off' }
]

const { period, setPeriod } = useBalanceDeltaPeriod()
</script>

<style scoped>
.delta-period-options {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
}

.delta-period-option {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem;
  padding: 0.5rem;
  background-color: var(--color20);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.5rem;
  color: var(--color70);
  font-family: var(--sans);
  font-size: 0.85rem;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.delta-period-option:hover {
  background-color: var(--color30);
  color: var(--color90);
}

.delta-period-option:focus-visible {
  outline: var(--border-thickness) solid var(--color-accent60);
  outline-offset: 2px;
}

.delta-period-option--active {
  background-color: var(--color30);
  border-color: var(--color-accent60);
  color: var(--color90);
}
</style>
