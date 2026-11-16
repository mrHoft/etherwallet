<template>
  <SettingsSection title="Gas display"
    description="Choose how gas prices are shown. Gwei + USD also displays the estimated cost in dollars.">
    <div class="gas-display-options" role="group" aria-label="Gas display">
      <button type="button" :class="['gas-display-option', { 'gas-display-option--active': preference === 'gwei' }]"
        :aria-pressed="preference === 'gwei'" @click="setPreference('gwei')">
        <span>Gwei only</span>
      </button>

      <button type="button" :class="['gas-display-option', { 'gas-display-option--active': preference === 'gwei-usd' }]"
        :aria-pressed="preference === 'gwei-usd'" @click="setPreference('gwei-usd')">
        <span>Gwei + USD</span>
      </button>
    </div>
  </SettingsSection>
</template>

<script setup lang="ts">
import SettingsSection from '~/components/settings/SettingsSection.vue'
import { useGasDisplay } from '~/composables/useGasDisplay'

const { preference, setPreference } = useGasDisplay()
</script>

<style scoped>
.gas-display-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.gas-display-option {
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

.gas-display-option:hover {
  background-color: var(--color30);
  color: var(--color90);
}

.gas-display-option:focus-visible {
  outline: var(--border-thickness) solid var(--color-accent60);
  outline-offset: 2px;
}

.gas-display-option--active {
  background-color: var(--color30);
  border-color: var(--color-accent60);
  color: var(--color90);
}
</style>
