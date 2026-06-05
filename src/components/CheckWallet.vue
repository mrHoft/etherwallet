<template>
  <div class="check-wallet">
    <div v-if="!showForm" class="button-check-container">
      <button type="button" class="button-check" @click="showForm = true">
        Check Wallet
      </button>
    </div>
    <div v-else-if="!isDecrypted" class="decrypt-form">
      <div class="form-header">
        <h3 class="form-title">View Wallet Details</h3>
        <p class="form-description">Enter your password to view wallet recovery phrase</p>
      </div>

      <div class="password-field">
        <label for="check-password" class="password-label">Wallet Password</label>
        <Password id="check-password" v-model="password" :max-length="6" />
      </div>

      <div v-if="errorMessage" class="error-message-display">
        {{ errorMessage }}
      </div>

      <div class="btns">
        <button type="button" class="button-cancel" @click="showForm = false">
          Cancel
        </button>
        <button type="button" class="button-decrypt" :disabled="!isFormValid || isLoading" @click="decryptWalletData">
          {{ isLoading ? 'Decrypting...' : 'Check' }}
        </button>
      </div>
    </div>

    <div v-else class="wallet-details">

      <div class="wallet-info">
        <div class="info-row">
          <span class="info-label">Wallet Name:</span>
          <span class="info-value">{{ walletName }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Address:</span>
          <span class="info-value address-value">{{ walletAddress }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
const showForm = ref<boolean>(false)
import Password from '~/components/Password.vue'
import { decryptWallet } from '~/api/create'

interface Props {
  walletName: string
  encryptedJson: string
}

interface Emits {
  (e: 'decrypt-success', data: { mnemonic: string; address: string }): void
  (e: 'decrypt-error', error: string): void
  (e: 'cancel'): void
}

interface DecryptedWalletData {
  mnemonic: string
  address: string
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const password = ref<string>('')
const isLoading = ref<boolean>(false)
const errorMessage = ref<string>('')
const isDecrypted = ref<boolean>(false)
const walletData = ref<DecryptedWalletData>({ mnemonic: '', address: '' })

const isFormValid = computed<boolean>(() => password.value.length >= 3)

const walletAddress = computed<string>(() => {
  try {
    const parsedData = JSON.parse(props.encryptedJson) as { address: string }
    return `0x${parsedData.address.toLowerCase()}`
  } catch {
    return ''
  }
})

const hasMnemonic = (obj: unknown): obj is { mnemonic: string } => typeof obj === 'object' && obj !== null && 'mnemonic' in obj

const decryptWalletData = async (): Promise<void> => {
  if (!isFormValid.value || isLoading.value) return

  isLoading.value = true
  errorMessage.value = ''

  try {
    const recovered = await decryptWallet(props.encryptedJson, password.value)
    const storedAddress = getAddressFromJson(props.encryptedJson)
    const recoveredAddress = recovered.address.toLowerCase()
    const expectedAddress = `0x${storedAddress.toLowerCase()}`

    if (recoveredAddress === expectedAddress) {
      walletData.value = {
        mnemonic: hasMnemonic(recovered) ? recovered.mnemonic : 'no recovery phrase available',
        address: recoveredAddress
      }
      isDecrypted.value = true
      password.value = ''
      emit('decrypt-success', walletData.value)
    } else {
      errorMessage.value = 'Invalid password - wallet address mismatch'
      password.value = ''
      emit('decrypt-error', 'Invalid password')
    }
  } catch {
    errorMessage.value = 'Invalid password or failed to decrypt wallet'
    password.value = ''
    emit('decrypt-error', 'Invalid password or failed to decrypt wallet')
  } finally {
    isLoading.value = false
  }
}

const getAddressFromJson = (encryptedJson: string): string => {
  try {
    const parsedData = JSON.parse(encryptedJson) as { address: string }
    return parsedData.address || ''
  } catch {
    return ''
  }
}

defineExpose({
  resetWalletState: () => {
    isDecrypted.value = false
    password.value = ''
    isLoading.value = false
    errorMessage.value = ''
    walletData.value = {
      mnemonic: '',
      address: ''
    }
  }
})
</script>

<style scoped>
.check-wallet {
  margin-top: 1rem;
}

.button-check-container {
  display: flex;
  justify-content: flex-start;
}

.button-check {
  padding: 0.75rem 1.5rem;
  background-color: rgba(220, 38, 38, 0.1);
  color: #ef4444;
  border: var(--border-thickness) solid #ef4444;
  border-radius: 0.375rem;
  font-family: var(--sans);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.button-check:hover {
  background-color: rgba(220, 38, 38, 0.2);
}

.decrypt-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-header {
  margin-bottom: 0.5rem;
}

.form-title {
  font-family: var(--heading);
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color90);
  margin: 0 0 0.5rem 0;
}

.form-description {
  font-family: var(--sans);
  font-size: 0.875rem;
  color: var(--color70);
  margin: 0;
}

.password-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.password-label {
  font-family: var(--sans);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color80);
}

.error-message-display {
  color: #ef4444;
  font-family: var(--sans);
  font-size: 0.875rem;
  padding: 0.5rem;
  background-color: rgba(220, 38, 38, 0.1);
  border-radius: 0.25rem;
  border: var(--border-thickness) solid #ef4444;
}

.btns {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
}

.button-cancel {
  padding: 0.75rem 1.5rem;
  background-color: var(--color20);
  color: var(--color80);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.375rem;
  font-family: var(--sans);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.button-cancel:hover {
  background-color: var(--color30);
  border-color: var(--color50);
}

.button-decrypt {
  padding: 0.75rem 1.5rem;
  background-color: var(--color-accent60);
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-family: var(--sans);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.button-decrypt:hover:not(:disabled) {
  background-color: var(--color-accent80);
}

.button-decrypt:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wallet-details {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.wallet-info {
  background: var(--color20);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.5rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.info-label {
  font-family: var(--sans);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color70);
}

.info-value {
  font-family: var(--mono);
  font-size: 0.875rem;
  color: var(--color90);
  word-break: break-all;
  text-align: right;
}

.address-value {
  font-size: 0.75rem;
}

.warning-text {
  font-size: 0.75rem;
  color: #ef4444;
  margin: 0;
  font-weight: 500;
  font-family: var(--sans);
  padding: 0.75rem;
  background-color: rgba(220, 38, 38, 0.1);
  border-radius: 0.25rem;
  border-left: 0.25rem solid #ef4444;
}
</style>
