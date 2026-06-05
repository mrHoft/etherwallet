<template>
  <div class="create-wallet">
    <form v-if="!showSuccess" @submit.prevent="handleSubmit" class="wallet-form">
      <div class="form-group">
        <label for="wallet-name" class="form-label">Wallet Name</label>
        <input id="wallet-name" v-model="walletName" type="text" class="form-input" placeholder="My Ethereum Wallet"
          maxlength="50" required />
      </div>

      <div class="form-group">
        <label class="form-label">Password</label>
        <Password v-model="password" :max-length="6" @complete="onPassphraseComplete" />
        <p class="form-hint">Enter a 6-character passphrase for security (minimum 3 characters)</p>
      </div>

      <div class="form-actions">
        <button type="button" @click="$emit('cancel')" class="cancel-button">Cancel</button>
        <button type="submit" class="action-button" :disabled="isLoading || !isFormValid">
          <span v-if="isLoading" class="loading-spinner"></span>
          <span v-else>Create Wallet</span>
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
          <h3 class="success-title">{{ createdWalletName }} wallet Created Successfully!</h3>
          <p class="success-text"><strong>IMPORTANT:</strong> Please save your mnemonic phrase securely. You will need
            it to recover your wallet.</p>
        </div>
      </div>

      <div class="mnemonic-box">
        <div class="mnemonic-header">
          <span class="mnemonic-label">Recovery Phrase</span>
          <CopyIcon :text="walletResult.mnemonicPhrase" @copy-success="onCopySuccess" />
        </div>
        <p class="mnemonic-phrase">{{ walletResult.mnemonicPhrase }}</p>
      </div>

      <p class="warning-text">⚠️ Never share your mnemonic phrase with anyone. Store it in a safe place.</p>
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
import CopyIcon from '~/components/CopyIcon.vue'
import { createWallet, type WalletResult } from '~/api/create'
import { storage } from '~/utils/storage'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  success: [walletName: string]
  cancel: []
}>()

const walletName = ref<string>('')
const password = ref<string>('')
const isLoading = ref<boolean>(false)
const showSuccess = ref<boolean>(false)
const errorMessage = ref<string>('')
const walletResult = ref<WalletResult | null>(null)
const createdWalletName = ref<string>('')

const isFormValid = computed<boolean>(() => {
  return walletName.value.trim().length > 0 && password.value.length >= 3
})

const resetForm = () => {
  walletName.value = ''
  password.value = ''
  isLoading.value = false
  showSuccess.value = false
  errorMessage.value = ''
  walletResult.value = null
  createdWalletName.value = ''
}

const onPassphraseComplete = (value: string) => {
  password.value = value
}

const onCopySuccess = () => { }

const handleSubmit = async () => {
  if (!isFormValid.value) {
    errorMessage.value = 'Please enter a wallet name and valid passphrase (minimum 3 characters)'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const result = await createWallet(password.value)
    walletResult.value = result
    createdWalletName.value = walletName.value.trim()

    const key = walletName.value.trim().replace(/ /g, '_')
    storage.set(`wallet.${key}`, result.encryptedJson)

    showSuccess.value = true
    // emit('success', walletName.value.trim())
  } catch (error) {
    console.error('Failed to create wallet:', error)
    errorMessage.value = error instanceof Error ? error.message : 'Failed to create wallet. Please try again.'
  } finally {
    isLoading.value = false
  }
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    resetForm()
  }
}, { immediate: true })
</script>

<style scoped>
.create-wallet {
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

.wallet-form {
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

.form-input {
  padding: 0.75rem 1rem;
  background: var(--color20);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.5rem;
  color: var(--color90);
  font-size: 1rem;
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-accent60);
  background: var(--color10);
}

.form-input::placeholder {
  color: var(--color60);
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
  padding: 0.875rem 1.5rem;
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
  cursor: not-allowed;
}

.cancel-button {
  background: var(--color30);
  color: var(--color80);
  border: var(--border-thickness) solid var(--color40);
  padding: 0.875rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
}

.cancel-button:hover {
  background: var(--color40);
  color: var(--color90);
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
  padding: 1rem;
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

.mnemonic-box {
  background: var(--color20);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.5rem;
  padding: 1rem;
  margin: 1rem 0;
}

.mnemonic-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.mnemonic-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color60);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.mnemonic-phrase {
  font-family: monospace;
  font-size: 0.875rem;
  color: var(--color90);
  word-break: break-all;
  line-height: 1.5;
  margin: 0;
}

.warning-text {
  font-size: 0.75rem;
  color: #ef4444;
  margin-top: 0.75rem;
  font-weight: 500;
}

.error-message {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
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

  .action-button,
  .cancel-button {
    padding: 0.75rem 1.25rem;
  }

  .form-actions {
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  .form-group {
    gap: 0.375rem;
  }

  .mnemonic-box {
    padding: 0.75rem;
  }
}
</style>
