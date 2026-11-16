<template>
  <SettingsSection title="Decoy page" description="Choose what the landing page shows.">
    <div class="decoy-options" role="group" aria-label="Decoy landing page">
      <button type="button" :class="['decoy-option', { 'decoy-option--active': landingPage === 'default' }]"
        :aria-pressed="landingPage === 'default'" @click="setLandingPage('default')">
        <span>Default</span>
      </button>

      <button type="button" :class="['decoy-option', { 'decoy-option--active': landingPage === 'tip-calculator' }]"
        :aria-pressed="landingPage === 'tip-calculator'" @click="setLandingPage('tip-calculator')">
        <span>Tip Calculator</span>
      </button>
    </div>

    <label class="unlock-label" for="decoy-unlock-code">Unlock code</label>
    <input id="decoy-unlock-code" :value="unlockCode" class="unlock-input" type="text" autocomplete="off"
      spellcheck="false" @input="handleUnlockCodeInput" />
    <p class="unlock-hint">Enter this code in the bill amount field of the tip calculator to open the wallet overview.
    </p>
  </SettingsSection>
</template>

<script setup lang="ts">
import SettingsSection from '~/components/settings/SettingsSection.vue'
import { useDecoy } from '~/composables/useDecoy'

const { landingPage, setLandingPage, unlockCode, setUnlockCode } = useDecoy()

const handleUnlockCodeInput = (event: Event): void => {
  const target = event.target as HTMLInputElement
  setUnlockCode(target.value)
}
</script>

<style scoped>
.decoy-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.decoy-option {
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

.decoy-option:hover {
  background-color: var(--color30);
  color: var(--color90);
}

.decoy-option:focus-visible {
  outline: var(--border-thickness) solid var(--color-accent60);
  outline-offset: 2px;
}

.decoy-option--active {
  background-color: var(--color30);
  border-color: var(--color-accent60);
  color: var(--color90);
}

.unlock-label {
  display: block;
  margin: 1rem 0 0.5rem;
  font-family: var(--heading);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color90);
}

.unlock-input {
  width: 100%;
  box-sizing: border-box;
  height: 2.25rem;
  padding: 0 0.75rem;
  background: var(--color20);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.5rem;
  color: var(--color90);
  font-family: var(--mono);
  font-size: 0.85rem;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.unlock-input:focus {
  border-color: var(--color-accent60);
  background: var(--color10);
}

.unlock-hint {
  margin: 0.5rem 0 0;
  color: var(--color70);
  font-family: var(--sans);
  font-size: 0.8rem;
  line-height: 1.5;
}
</style>
