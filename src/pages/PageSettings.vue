<template>
  <div class="page-settings">
    <div class="settings-container">
      <h1 class="page-title">Settings</h1>

      <section class="section">
        <h2 class="section-title">Reset cache</h2>

        <ul class="reset-description">
          <li>Reset cached values for token balances.</li>
          <li>Reset starting account value.</li>
        </ul>

        <button type="button" class="button-reset" @click="handleReset">Reset</button>

        <p v-if="statusMessage" class="status-message">{{ statusMessage }}</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { resetAccountBalance } from '~/utils/accountBalance'

const statusMessage = ref<string>('')

const handleReset = (): void => {
  resetAccountBalance()
  statusMessage.value = 'Cache cleared. Starting values will be recreated when a wallet is opened.'
}
</script>

<style scoped>
.page-settings {
  max-width: 600px;
  margin: 0 auto;
}

.settings-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-title {
  font-family: var(--heading);
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color90);
  margin: 0;
}

.section {
  background-color: var(--color10);
  border-radius: 0.5rem;
  padding: 1rem;
  border: var(--border-thickness) solid var(--color40);
}

.section-title {
  font-family: var(--heading);
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color90);
  margin: 0 0 0.75rem;
}

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
  padding: 0.75rem 1.5rem;
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
