<template>
  <div class="page-wallet">
    <div v-if="error" class="error-state">
      <p class="error-message">{{ error }}</p>
      <ButtonBack />
    </div>

    <div v-else-if="walletData" class="wallet-content">
      <WalletName :wallet-name="walletData.name" @change="handleWalletNameChange" />

      <section class="funds-section">
        <h2 class="section-title">Balance</h2>
        <WalletBalance :wallet-address="walletAddress" />
      </section>

      <section class="dangerous-section">
        <h2 class="section-title">Danger Zone</h2>
        <CheckWallet :wallet-name="walletData.name" :encrypted-json="walletData.encryptedJson"
          @decrypt-error="handleError" />
        <DeleteWallet :wallet-name="walletData.name" :encrypted-json="walletData.encryptedJson"
          @delete-success="handleDeleteSuccess" @delete-error="handleError" @cancel="handleDeleteCancel" />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storage } from '~/utils/storage'
import DeleteWallet from '~/components/DeleteWallet.vue'
import CheckWallet from '~/components/CheckWallet.vue'
import WalletBalance from '~/components/WalletBalance.vue'
import WalletName from '~/components/WalletName.vue'
import ButtonBack from '~/components/ButtonBack.vue'
import { useNavigation } from '~/composables/useNavigation'

const { navigateTo } = useNavigation()

interface WalletData {
  address: string
  [key: string]: unknown
}

interface WalletEntry {
  name: string
  encryptedJson: string
}

const error = ref<string>('')
const walletData = ref<WalletEntry | null>(null)
const walletAddress = ref<string>('')

const walletEntries = computed<[string, string][]>(() => {
  const state = storage.get<Record<string, string>>('wallet') || {}
  return Object.entries(state)
})

const getAddressFromJson = (encryptedJson: string): string => {
  try {
    const parsedData: WalletData = JSON.parse(encryptedJson)
    return parsedData.address || ''
  } catch {
    return ''
  }
}

const findWalletByAddress = (address: string): WalletEntry | null => {
  const normalizedAddress = address.toLowerCase()

  for (const [name, encryptedJson] of walletEntries.value) {
    const walletAddressFromJson = getAddressFromJson(encryptedJson)
    if (walletAddressFromJson.toLowerCase() === normalizedAddress) {
      return { name, encryptedJson }
    }
  }

  return null
}

const handleDeleteSuccess = async (): Promise<void> => {
  if (!walletData.value) return

  try {
    const state = storage.get<Record<string, string>>('wallet') || {}
    delete state[walletData.value.name]
    storage.set('wallet', state)
    navigateTo('/')
  } catch {
    error.value = 'Failed to delete wallet from storage'
  }
}

const handleError = (text: string): void => {
  error.value = text
}

const handleDeleteCancel = (): void => {
  error.value = ''
}

const handleWalletNameChange = (newName: string) => {
  if (!walletData.value) return
  console.log(newName)
  const key = newName.trim().replace(/ /g, '_')
  const state = storage.get<Record<string, string>>('wallet') || {}
  state[key] = state[walletData.value.name]
  delete state[walletData.value.name]
  storage.set('wallet', state)
  walletData.value.name = key
}

onMounted(() => {
  const addressParam = window.location.search.split('address=').pop()

  if (!addressParam) {
    error.value = 'No wallet address provided'
    return
  }

  const foundWallet = findWalletByAddress(addressParam)

  if (!foundWallet) {
    error.value = `Wallet with address ${addressParam} not found`
    return
  }

  walletData.value = foundWallet
  walletAddress.value = addressParam
})
</script>

<style scoped>
.page-wallet {
  max-width: 1200px;
  margin: 0 auto;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 3rem;
  text-align: center;
  background-color: var(--color10);
  border-radius: 0.5rem;
  border: var(--border-thickness) solid var(--color40);
}

.error-message {
  color: var(--color90);
  font-family: var(--sans);
  font-size: 1.125rem;
  margin: 0;
}

.wallet-content {
  display: flex;
  flex-direction: column;
  row-gap: 1rem;
}

.section-title {
  font-family: var(--heading);
  font-size: 1.5rem;
  font-weight: 500;
  color: var(--color80);
  margin: 0 0 1rem 0;
}

.funds-section {
  position: relative;
  background-color: var(--color10);
  border-radius: 0.5rem;
  padding: 1.5rem;
  border: var(--border-thickness) solid var(--color40);
}

.dangerous-section {
  background-color: var(--color10);
  border-radius: 0.5rem;
  padding: 1.5rem;
  border: var(--border-thickness) solid var(--color40);
}

.back-button {
  background: var(--color-accent60);
  color: white;
  border: none;
  padding: 0.75rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-family: var(--sans);
  font-weight: 500;
}

.back-button:hover {
  background: var(--color-accent80);
  transform: translateY(-0.0625rem);
}

.back-button:active {
  transform: translateY(0);
}

@media (max-width: 768px) {
  .page-wallet {
    padding: 0.5rem;
  }

  .wallet-name {
    font-size: 1.5rem;
  }

  .section-title {
    font-size: 1.25rem;
  }

  .funds-section,
  .dangerous-section {
    padding: 1rem;
  }
}
</style>
