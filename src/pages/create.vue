<template>
  <div class="create-wallet-page">
    <div class="container">
      <h1 class="title">{{ isRestoring() ? 'Restore Wallet' : 'Create a new wallet' }}</h1>

      <div v-if="!selectedMethod" class="method-selector">
        <button class="method-card" @click="selectMethod('create')">
          <svg class="method-icon" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <h3 class="method-title">Create New Wallet</h3>
          <p class="method-description">Generate a new wallet with a fresh mnemonic phrase</p>
        </button>

        <button class="method-card" @click="selectMethod('restore')">
          <svg class="method-icon" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 12H4M12 4l8 8-8 8" />
          </svg>
          <h3 class="method-title">Restore Existing Wallet</h3>
          <p class="method-description">Import wallet using your recovery phrase</p>
        </button>
      </div>

      <CreateWallet v-else-if="selectedMethod === 'create'" :show="selectedMethod === 'create'"
        @success="handleWalletCreated" @cancel="resetSelection" />

      <RestoreWallet v-else-if="selectedMethod === 'restore'" :show="selectedMethod === 'restore'"
        @success="handleWalletRestored" @cancel="resetSelection" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CreateWallet from '~/components/CreateWallet.vue'
import RestoreWallet from '~/components/RestoreWallet.vue'
import { useNavigation } from '~/composables/useNavigation'

type SelectedMethod = 'create' | 'restore' | null

const { navigateTo } = useNavigation()
const selectedMethod = ref<SelectedMethod>(null)

const isRestoring = () => selectedMethod.value === 'create'

const selectMethod = (method: SelectedMethod) => {
  selectedMethod.value = method
}

const resetSelection = () => {
  selectedMethod.value = null
}

const handleWalletCreated = () => {
  setTimeout(() => {
    navigateTo('/')
  }, 3000)
}

const handleWalletRestored = () => {
  setTimeout(() => {
    navigateTo('/')
  }, 3000)
}
</script>

<style scoped>
.create-wallet-page {
  height: 100%;
  background: var(--color00);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  box-sizing: border-box;
}

.container {
  max-width: 600px;
  width: 100%;
  background: var(--color10);
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.title {
  font-size: 1.875rem;
  font-weight: 600;
  color: var(--color90);
  margin-bottom: 2rem;
  text-align: center;
}

.method-selector {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.method-card {
  background: var(--color20);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.75rem;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
}

.method-card:hover {
  border-color: var(--color-accent60);
  background: var(--color30);
  transform: translateY(-2px);
}

.method-icon {
  color: var(--color-accent60);
  margin-bottom: 0.75rem;
}

.method-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color90);
  margin-bottom: 0.5rem;
}

.method-description {
  font-size: 0.875rem;
  color: var(--color70);
  line-height: 1.4;
}

@media (max-width: 768px) {
  .title {
    font-size: 1.5rem;
  }

  .method-card {
    padding: 1rem;
  }

  .method-title {
    font-size: 1rem;
  }
}
</style>
