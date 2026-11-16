<template>
  <SettingsSection title="Reset cache">
    <ul class="reset-description">
      <li>Reset cached values for token balances.</li>
      <li>Clear price cache.</li>
      <li>Reset starting account value.</li>
    </ul>

    <button type="button" class="button-reset" @click="handleReset">Reset</button>

    <p v-if="statusMessage" class="status-message">{{ statusMessage }}</p>
  </SettingsSection>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { resetAccountBalance } from '~/utils/accountBalance'
import SettingsSection from '~/components/settings/SettingsSection.vue'

const statusMessage = ref<string>('')

const handleReset = (): void => {
  resetAccountBalance()
  statusMessage.value = 'Cache cleared. Starting values will be recreated when a wallet is opened.'
}
</script>

<style scoped>
.reset-description {
  margin: 0 0 1rem;
  padding-left: 1.25rem;
  color: var(--color80);
  font-family: var(--sans);
  font-size: 0.95rem;
  line-height: 1.6;
}

.button-reset {
  background-color: var(--color-accent60);
  color: white;
  border: none;
  border-radius: 0.5rem;
  padding: 0.5rem 1.5rem;
  font-family: var(--sans);
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.button-reset:hover {
  background-color: var(--color-accent80);
}

.status-message {
  margin-top: 0.75rem;
  color: var(--color-up);
  font-family: var(--mono);
  font-size: 0.8rem;
}
</style>
