<template>
  <div class="delete-wallet">
    <div v-if="!showDeleteConfirmation" class="button-delete-container">
      <button type="button" class="button-delete" @click="showDeleteConfirmation = true">
        Delete Wallet
      </button>
    </div>

    <div v-else class="delete-confirmation">
      <h3 class="form-title">Delete Wallet</h3>
      <p class="confirmation-warning">
        ⚠️ This action cannot be undone. Please enter your password to confirm.
      </p>

      <div class="password-field">
        <label for="delete-password" class="password-label">Wallet Password</label>
        <Password id="delete-password" v-model="password" :max-length="6" />
      </div>

      <div v-if="errorMessage" class="error-message-display">
        {{ errorMessage }}
      </div>

      <div class="btns">
        <button type="button" class="button-cancel" @click="cancelDelete">
          Cancel
        </button>
        <button type="button" class="button-confirm" :disabled="!isFormValid || isLoading" @click="confirmDelete">
          {{ isLoading ? 'Verifying...' : 'Permanently Delete Wallet' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Password from '~/components/Password.vue'
import { decryptWallet } from '~/api/create'

interface Props {
  walletName: string
  encryptedJson: string
}

interface Emits {
  (e: 'delete-success'): void
  (e: 'delete-error', error: string): void
  (e: 'cancel'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const password = ref<string>('')
const showDeleteConfirmation = ref<boolean>(false)
const isLoading = ref<boolean>(false)
const errorMessage = ref<string>('')

const isFormValid = computed<boolean>(() => password.value.length >= 3)

const getAddressFromJson = (encryptedJson: string): string => {
  try {
    const parsedData = JSON.parse(encryptedJson) as { address: string }
    return parsedData.address || ''
  } catch {
    return ''
  }
}

const confirmDelete = async (): Promise<void> => {
  if (!isFormValid.value || isLoading.value) return

  isLoading.value = true
  errorMessage.value = ''

  try {
    const recovered = await decryptWallet(props.encryptedJson, password.value)
    const storedAddress = getAddressFromJson(props.encryptedJson)
    const recoveredAddress = recovered.address.toLowerCase()
    const expectedAddress = `0x${storedAddress.toLowerCase()}`

    if (recoveredAddress === expectedAddress) {
      emit('delete-success')
      showDeleteConfirmation.value = false
      password.value = ''
    } else {
      errorMessage.value = 'Invalid password - wallet address mismatch'
      password.value = ''
      emit('delete-error', 'Invalid password')
    }
  } catch {
    errorMessage.value = 'Invalid password or failed to decrypt wallet'
    password.value = ''
    emit('delete-error', 'Invalid password or failed to decrypt wallet')
  } finally {
    isLoading.value = false
  }
}

const cancelDelete = (): void => {
  showDeleteConfirmation.value = false
  password.value = ''
  errorMessage.value = ''
  emit('cancel')
}

defineExpose({
  resetDeleteState: () => {
    showDeleteConfirmation.value = false
    password.value = ''
    isLoading.value = false
    errorMessage.value = ''
  }
})
</script>

<style scoped>
.delete-wallet {
  margin-top: 1rem;
}

.button-delete-container {
  display: flex;
  justify-content: flex-start;
}

.button-delete {
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

.button-delete:hover {
  background-color: rgba(220, 38, 38, 0.2);
}

.delete-confirmation {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-title {
  font-family: var(--heading);
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color90);
  margin: 0;
}

.confirmation-warning {
  color: #ef4444;
  font-family: var(--sans);
  font-size: 0.875rem;
  margin: 0;
  padding: 0.75rem;
  background-color: rgba(220, 38, 38, 0.1);
  border-left: 0.25rem solid #ef4444;
  border-radius: 0.25rem;
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

.button-confirm {
  padding: 0.75rem 1.5rem;
  background-color: #ef4444;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-family: var(--sans);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.button-confirm:hover:not(:disabled) {
  background-color: #dc2626;
}

.button-confirm:disabled {
  opacity: 0.5;
}
</style>
