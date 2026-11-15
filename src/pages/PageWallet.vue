<template>
  <div class="page-wallet">
    <div v-if="error" class="error-state">
      <p class="error-message">{{ error }}</p>
      <ButtonBack />
    </div>

    <div v-else-if="walletData" class="wallet-content">
      <section class="section">
        <WalletName :wallet-name="walletData.name" @change="handleWalletNameChange" />
        <p v-if="renameError" class="rename-error">{{ renameError }}</p>
      </section>

      <section class="section">
        <WalletBalance :address="walletAddress" />
      </section>

      <section class="section">
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
import { ref, onMounted } from 'vue'
import { getWallets, removeWallet, renameWallet } from '~/utils/wallets'
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
const renameError = ref<string>('')
const walletData = ref<WalletEntry | null>(null)
const walletAddress = ref<string>('')

const getAddressFromJson = (encryptedJson: string): string => {
  try {
    const parsedData: WalletData = JSON.parse(encryptedJson)
    return parsedData.address || ''
  } catch {
    return ''
  }
}

const findWalletByAddress = (address: string): WalletEntry | null => {
  let normalizedAddress = address.toLowerCase()
  if (normalizedAddress.startsWith('0x')) normalizedAddress = normalizedAddress.slice(2)

  for (const [name, encryptedJson] of Object.entries(getWallets())) {
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
    removeWallet(walletData.value.name)
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

  try {
    const walletName = renameWallet(walletData.value.name, newName)
    walletData.value.name = walletName
    renameError.value = ''
  } catch (renameFailure) {
    renameError.value = renameFailure instanceof Error ? renameFailure.message : 'Failed to rename wallet'
  }
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
  max-width: 600px;
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
  row-gap: 0.5rem;
}

.section-title {
  font-family: var(--heading);
  font-size: 1.5rem;
  font-weight: 500;
  color: var(--color80);
  margin: 0 0 1rem 0;
}

.section {
  background-color: var(--color10);
  border-radius: 0.5rem;
  padding: 0.5rem;
  border: var(--border-thickness) solid var(--color40);
}

.rename-error {
  margin-top: 0.5rem;
  color: #ef4444;
  font-family: var(--sans);
  font-size: 0.875rem;
}
</style>
