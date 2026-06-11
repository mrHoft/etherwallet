<template>
  <div class="transfer-container">
    <form @submit.prevent="handleSubmit" class="transfer-form">
      <div class="form-group">
        <label class="form-label" for="from-wallet">From Wallet</label>
        <select id="from-wallet" v-model="selectedWallet" class="form-select" required>
          <option value="" disabled>Select a wallet</option>
          <option v-for="[key] in walletEntries" :key="key" :value="key">
            {{ key }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label" for="to-address">To Address</label>
        <input id="to-address" v-model="recipientAddress" type="text" class="form-input" placeholder="0x..."
          maxlength="66" required />
      </div>

      <div class="form-row">
        <div class="form-group form-group--half">
          <label class="form-label" for="token">Token</label>
          <select id="token" v-model="selectedToken" class="form-select" required>
            <option value="" disabled>Select token</option>
            <option v-for="(info, symbol) in TOKEN_INFO" :key="symbol" :value="symbol">
              {{ symbol }} - {{ info.name }}
            </option>
          </select>
        </div>

        <div class="form-group form-group--half">
          <label class="form-label" for="amount">Amount</label>
          <input id="amount" v-model.number="amount" type="number" class="form-input" placeholder="0.0000" step="0.0001"
            min="0" required />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="password">Password</label>
        <Password id="password" v-model="password" />
      </div>

      <div class="form-group">
        <label class="form-label">Gas Price</label>
        <div class="gas-price-display">
          {{ formattedGasPrice }}
        </div>
      </div>

      <button type="submit" class="submit-button" :disabled="!isFormValid || isSubmitting">
        {{ isSubmitting ? 'Processing...' : 'Transfer' }}
      </button>

      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>

      <div v-if="successMessage" class="success-message">
        {{ successMessage }}
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storage } from '~/utils/storage'
import { TOKEN_INFO } from '~/api/const'
import Password from '~/components/Password.vue'
import { getGasPrice } from '~/api/gasPrice'
import { decryptWallet } from '~/api/create'
import { transferToken } from '~/api/transfer'

const walletEntries = computed(() => {
  const state = storage.get<Record<string, string>>('wallet') || {}
  return Object.entries(state)
})

const password = ref<string>('')
const selectedWallet = ref<string>('')
const recipientAddress = ref<string>('')
const selectedToken = ref<string>('')
const amount = ref<number | null>(null)
const isSubmitting = ref<boolean>(false)
const errorMessage = ref<string>('')
const successMessage = ref<string>('')
const gasPrice = ref<bigint>(0n)

const isFormValid = computed<boolean>(() => {
  return (
    password.value.length >= 3 &&
    selectedWallet.value !== '' &&
    recipientAddress.value.trim() !== '' &&
    selectedToken.value !== '' &&
    amount.value !== null &&
    amount.value > 0
  )
})

const formattedGasPrice = computed<string>(() => {
  if (gasPrice.value === 0n) return 'Loading...'
  if (gasPrice.value === -1n) return 'Failed to load'
  const gwei = Number(gasPrice.value) / 1e9
  return `${gwei.toFixed(2)} Gwei`
})

const getAddressFromJson = (encryptedJson: string): string => {
  try {
    const parsedData = JSON.parse(encryptedJson) as { address: string }
    return parsedData.address || ''
  } catch {
    return ''
  }
}

const decryptWalletData = async (encryptedJson: string): Promise<string | null> => {
  if (!isFormValid.value) return null

  try {
    const recovered = await decryptWallet(encryptedJson, password.value)
    const storedAddress = getAddressFromJson(encryptedJson)
    const recoveredAddress = recovered.address.toLowerCase()
    const expectedAddress = `0x${storedAddress.toLowerCase()}`

    if (recoveredAddress === expectedAddress) {
      return recovered.privateKey
    } else {
      errorMessage.value = 'Invalid password'
      return null
    }
  } catch {
    errorMessage.value = 'Invalid password or failed to decrypt wallet'
    return null
  }
}

const handleSubmit = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  isSubmitting.value = true

  try {
    const walletMap = storage.get<Record<string, string>>('wallet') || {}
    const encryptedJson = walletMap[selectedWallet.value]

    if (!encryptedJson) {
      errorMessage.value = 'Wallet not found'
      return
    }

    const privateKey = await decryptWalletData(encryptedJson)

    if (!privateKey) return

    if (!recipientAddress.value.trim()) {
      errorMessage.value = 'Recipient address is required'
      return
    }

    if (!selectedToken.value) {
      errorMessage.value = 'Token is required'
      return
    }

    if (!amount.value || amount.value <= 0) {
      errorMessage.value = 'Amount must be greater than 0'
      return
    }

    const result = await transferToken(
      privateKey,
      recipientAddress.value.trim(),
      selectedToken.value,
      amount.value.toString(),
      { waitForConfirmation: true }
    )

    successMessage.value = `Transfer complete! TX: ${result.txHash}`

    password.value = ''
    recipientAddress.value = ''
    selectedToken.value = ''
    amount.value = null
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Transfer failed'
  } finally {
    isSubmitting.value = false
  }
}

const loadGasPrice = async () => {
  try {
    gasPrice.value = await getGasPrice()
  } catch {
    gasPrice.value = -1n
  }
}

onMounted(() => {
  loadGasPrice()
})
</script>

<style scoped>
.transfer-container {
  max-width: 32rem;
  margin: 0 auto;
  padding: 1.5rem;
}

.transfer-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-row {
  display: flex;
  gap: 1rem;
}

.form-group--half {
  flex: 1;
}

.form-label {
  font-family: var(--heading);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color90);
}

.form-input,
.form-select {
  font-family: var(--sans);
  padding: 0.625rem 0.75rem;
  background-color: var(--color10);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.375rem;
  color: var(--color90);
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--color-accent60);
  background-color: var(--color20);
}

.gas-price-display {
  padding: 0.625rem 0.75rem;
  background-color: var(--color10);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.375rem;
  color: var(--color80);
  font-family: var(--mono);
  font-size: 0.875rem;
}

.submit-button {
  padding: 0.75rem 1rem;
  background-color: var(--color-accent60);
  color: var(--color90);
  font-family: var(--heading);
  font-weight: 600;
  font-size: 0.875rem;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  margin-top: 0.5rem;
}

.submit-button:hover:not(:disabled) {
  background-color: var(--color-accent80);
}

.submit-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-message {
  padding: 0.75rem;
  background-color: rgba(220, 38, 38, 0.1);
  border: var(--border-thickness) solid rgba(220, 38, 38, 0.3);
  border-radius: 0.375rem;
  color: #ef4444;
  font-size: 0.875rem;
  font-family: var(--sans);
}

.success-message {
  padding: 0.75rem;
  background-color: rgba(34, 197, 94, 0.1);
  border: var(--border-thickness) solid rgba(34, 197, 94, 0.3);
  border-radius: 0.375rem;
  color: #4ade80;
  font-size: 0.875rem;
  font-family: var(--sans);
  word-break: break-all;
}
</style>
