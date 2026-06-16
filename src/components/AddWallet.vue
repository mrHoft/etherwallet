<template>
  <div class="add-wallet">
    <form v-if="!showSuccess" @submit.prevent="handleSubmit" class="add-form">
      <div class="form-group">
        <label class="form-label">Private Key</label>
        <textarea v-model="privateKey" class="form-textarea"
          placeholder="Enter your private key (64 hex characters starting with 0x)..." rows="3" required />
        <p class="form-hint">Format: 0x followed by 64 hexadecimal characters (total 66 characters)</p>
      </div>

      <div class="form-group">
        <label for="wallet-name" class="form-label">Wallet Name</label>
        <input id="wallet-name" v-model="walletName" type="text" class="form-input" placeholder="My Wallet"
          maxlength="50" required />
      </div>

      <div class="form-group">
        <label class="form-label">Password</label>
        <Password v-model="password" :max-length="6" @complete="onPassphraseComplete" />
        <p class="form-hint">Enter a password to encrypt your wallet</p>
      </div>

      <div class="form-actions">
        <ButtonCancel @cancel="$emit('cancel')" />
        <button type="submit" class="action-button" :disabled="isLoading || !isFormValid">
          <span v-if="isLoading" class="loading-spinner"></span>
          <span v-else>Add Wallet</span>
        </button>
      </div>
    </form>

    <div v-if="showSuccess && walletResult" class="success-message">
      <div class="success-header">
        <svg class="success-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
          fill="currentColor">
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
        </svg>
        <div>
          <h3 class="success-title">{{ walletName }} Wallet Added Successfully!</h3>
          <p class="success-text">Your wallet has been added and encrypted.</p>
        </div>
      </div>
    </div>

    <div v-if="errorMessage" class="error-message">
      <svg class="error-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
        fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
      </svg>
      <span>{{ errorMessage }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Password from '~/components/Password.vue'
import ButtonCancel from './ButtonCancel.vue'
import { createWalletFromPrivateKey, type WalletResult } from '~/api/create'
import { storage } from '~/utils/storage'

const emit = defineEmits<{
  success: [walletName: string]
  cancel: []
}>()

const walletName = ref<string>('')
const privateKey = ref<string>('')
const password = ref<string>('')
const isLoading = ref<boolean>(false)
const showSuccess = ref<boolean>(false)
const errorMessage = ref<string>('')
const walletResult = ref<WalletResult | null>(null)

const normalizePrivateKey = (key: string): string => {
  return key.trim()
}

const isValidPrivateKey = (key: string): boolean => {
  const normalized = normalizePrivateKey(key)
  if (!normalized) return false

  const isValidLength = normalized.length === 66
  const hasCorrectPrefix = normalized.startsWith('0x')

  if (!isValidLength || !hasCorrectPrefix) return false

  const hexPart = normalized.slice(2)
  const hexRegex = /^[0-9a-fA-F]{64}$/

  return hexRegex.test(hexPart)
}

const isFormValid = computed<boolean>(() => {
  return (
    walletName.value.trim().length > 0 &&
    password.value.length >= 3 &&
    isValidPrivateKey(privateKey.value)
  )
})

const resetForm = () => {
  walletName.value = ''
  privateKey.value = ''
  password.value = ''
  isLoading.value = false
  showSuccess.value = false
  errorMessage.value = ''
  walletResult.value = null
}

const onPassphraseComplete = (value: string) => {
  password.value = value
}

const handleSubmit = async () => {
  if (!isFormValid.value) {
    errorMessage.value = 'Please enter a valid wallet name, valid private key (66 characters starting with 0x), and password (minimum 3 characters)'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const normalizedKey = normalizePrivateKey(privateKey.value)
    const result = await createWalletFromPrivateKey(normalizedKey, password.value)
    walletResult.value = result

    const key = walletName.value.trim().replace(/ /g, '_')
    storage.set(`wallet.${key}`, result.encryptedJson)

    showSuccess.value = true
    emit('success', walletName.value.trim())
  } catch (error) {
    console.error('Failed to add wallet:', error)
    errorMessage.value = error instanceof Error ? error.message : 'Failed to add wallet. Please check your private key and try again.'
  } finally {
    isLoading.value = false
  }
}

watch(() => showSuccess.value, (newVal) => {
  if (newVal) {
    setTimeout(() => {
      resetForm()
    }, 2000)
  }
})
</script>

<style scoped>
.add-wallet {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.add-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color80);
}

.form-input,
.form-textarea {
  padding: 0.5rem 1rem;
  background: var(--color20);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.5rem;
  color: var(--color90);
  font-size: 1rem;
  transition: all 0.2s ease;
  font-family: var(--mono);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-accent60);
  background: var(--color10);
}

.form-input::placeholder,
.form-textarea::placeholder {
  color: var(--color60);
  font-family: var(--sans);
}

.form-hint {
  font-size: 0.75rem;
  color: var(--color60);
  margin-top: 0.25rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.action-button {
  background: var(--color-accent60);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.action-button:hover:not(:disabled) {
  background: var(--color-accent80);
  transform: translateY(-1px);
}

.action-button:active:not(:disabled) {
  transform: translateY(0);
}

.action-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: var(--border-thickness) solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.success-message {
  margin-top: 1.5rem;
  padding: 0.5rem;
  background: rgba(44, 125, 160, 0.1);
  border: var(--border-thickness) solid var(--color-accent60);
  border-radius: 0.5rem;
}

.success-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}

.success-icon {
  flex-shrink: 0;
  color: var(--color-accent60);
}

.success-title {
  color: var(--color90);
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.success-text {
  color: var(--color70);
  font-size: 0.875rem;
}

.error-message {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: rgba(220, 38, 38, 0.1);
  border: var(--border-thickness) solid #ef4444;
  border-radius: 0.5rem;
  color: #ef4444;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.error-icon {
  flex-shrink: 0;
  color: #ef4444;
}

@media (max-width: 768px) {
  .form-actions {
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  .form-group {
    gap: 0.375rem;
  }
}
</style>
