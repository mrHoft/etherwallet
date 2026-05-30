<template>
  <div class="create-wallet-page">
    <div class="container">
      <h1 class="title">Create a new wallet</h1>

      <form @submit.prevent="handleSubmit" class="wallet-form">
        <div class="form-group">
          <label for="wallet-name" class="form-label">Wallet Name</label>
          <input
            id="wallet-name"
            v-model="walletName"
            type="text"
            class="form-input"
            placeholder="My Ethereum Wallet"
            maxlength="50"
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label">Passphrase (Optional)</label>
          <Passphrase v-model="passphrase" :max-length="6" @complete="onPassphraseComplete" />
          <p class="form-hint">Enter a 6-character passphrase for additional security</p>
        </div>

        <button type="submit" class="submit-button" :disabled="isLoading || !isFormValid">
          <span v-if="isLoading" class="loading-spinner"></span>
          <span v-else>Create Wallet</span>
        </button>
      </form>

      <div v-if="showSuccess" class="success-message">
        <svg class="success-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <div>
          <h3 class="success-title">Wallet Created Successfully!</h3>
          <p class="success-text">Your wallet has been created. Please save your credentials securely.</p>
        </div>
      </div>

      <div v-if="errorMessage" class="error-message">
        <svg class="error-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <span>{{ errorMessage }}</span>
      </div>

      <button v-if="showSuccess" @click="goHome" class="home-button">← Home</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { router } from '~/utils/router';
import Passphrase from '~/components/PassPhrase.vue'
import { createWallet } from '~/api/create'

interface WalletResult {
  address: string
  privateKey: string
  mnemonicPhrase: string
  derivationPath: string | null
}

const walletName = ref<string>('')
const passphrase = ref<string>('')
const isLoading = ref<boolean>(false)
const showSuccess = ref<boolean>(false)
const errorMessage = ref<string>('')
const walletResult = ref<WalletResult | null>(null)

const isFormValid = computed<boolean>(() => {
  return walletName.value.trim().length > 0
})

const onPassphraseComplete = (value: string) => {
  passphrase.value = value
}

const handleSubmit = async () => {
  if (!isFormValid.value) {
    errorMessage.value = 'Please enter a wallet name'
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  showSuccess.value = false

  try {
    const result = createWallet(passphrase.value || undefined)
    walletResult.value = result

    const savedWallets = JSON.parse(localStorage.getItem('wallets') || '[]')
    savedWallets.push({
      id: Date.now(),
      name: walletName.value.trim(),
      address: result.address,
      mnemonic: result.mnemonicPhrase,
      createdAt: new Date().toISOString()
    })
    localStorage.setItem('wallets', JSON.stringify(savedWallets))

    showSuccess.value = true

    walletName.value = ''
    passphrase.value = ''
  } catch (error) {
    console.error('Failed to create wallet:', error)
    errorMessage.value = error instanceof Error ? error.message : 'Failed to create wallet. Please try again.'
  } finally {
    isLoading.value = false
  }
}

const goHome = () => {
  router.navigate('/')
}
</script>

<style scoped>
.create-wallet-page {
  min-height: 100vh;
  background: var(--color00);
  padding: 1.5rem;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}

.container {
  max-width: 600px;
  width: 100%;
  margin: 0 auto;
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
  border: 2px solid var(--color40);
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

.submit-button {
  background: var(--color-accent60);
  color: white;
  border: none;
  padding: 0.875rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.submit-button:hover:not(:disabled) {
  background: var(--color-accent80);
  transform: translateY(-1px);
}

.submit-button:active:not(:disabled) {
  transform: translateY(0);
}

.submit-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
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
  border: 2px solid var(--color-accent60);
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
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
  padding: 0.75rem 1rem;
  background: rgba(220, 38, 38, 0.1);
  border: 2px solid #ef4444;
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

.home-button {
  margin-top: 1.5rem;
  width: 100%;
  background: var(--color20);
  color: var(--color90);
  border: 2px solid var(--color40);
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.home-button:hover {
  background: var(--color30);
  border-color: var(--color-accent60);
}

@media (max-width: 768px) {
  .create-wallet-page {
    padding: 1rem;
  }

  .container {
    padding: 1.5rem;
  }

  .title {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .submit-button {
    padding: 0.75rem 1.25rem;
  }
}

@media (max-width: 480px) {
  .container {
    padding: 1rem;
  }

  .title {
    font-size: 1.25rem;
  }

  .form-group {
    gap: 0.375rem;
  }
}
</style>
