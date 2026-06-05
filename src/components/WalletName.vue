<template>
  <div class="wallet-name">
    <div v-if="!isEditing" class="display-mode">
      <h2 class="wallet-title">{{ formatWalletName(walletName) }}</h2>
      <button type="button" class="button-edit" @click="enterEditMode" aria-label="Edit wallet name">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
            fill="currentColor" />
        </svg>
      </button>
    </div>

    <div v-else class="edit-mode">
      <input ref="nameInput" v-model="editValue" type="text" :maxlength="24" class="name-input"
        @keyup.enter="handleEnter" @blur="saveChanges" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'

interface Props {
  walletName: string
}

interface Emits {
  (e: 'change', newName: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isEditing = ref(false)
const editValue = ref(props.walletName)
const nameInput = ref<HTMLInputElement | null>(null)

const formatWalletName = (name: string): string => {
  return name.replace(/_/g, ' ')
}

const enterEditMode = async (): Promise<void> => {
  editValue.value = props.walletName
  isEditing.value = true
  await nextTick()
  nameInput.value?.focus()
}

const handleEnter = (): void => {
  nameInput.value?.blur()
}

const saveChanges = (): void => {
  const trimmedValue = editValue.value.trim()

  if (trimmedValue && trimmedValue !== props.walletName) {
    emit('change', trimmedValue)
  }

  isEditing.value = false
}
</script>

<style scoped>
.wallet-name {
  display: flex;
  align-items: center;
  width: 100%;
}

.display-mode {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.wallet-title {
  margin: 0;
  font-family: var(--heading);
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.2;
  color: var(--color90);
  word-break: break-word;
  text-transform: capitalize;
}

.button-edit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: calc(0.25rem - var(--border-thickness));
  background: transparent;
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--color70);
}

.button-edit:hover {
  background-color: var(--color30);
  border-color: var(--color60);
  color: var(--color80);
}

.edit-mode {
  width: 100%;
  max-width: 20rem;
}

.name-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-family: var(--sans);
  font-size: 1.25rem;
  font-weight: 500;
  color: var(--color90);
  background-color: var(--color20);
  border: var(--border-thickness) solid var(--color-accent60);
  border-radius: 0.5rem;
  transition: all 0.2s ease;
}

.name-input:focus {
  outline: none;
  border-color: var(--color-accent80);
  background-color: var(--color30);
  box-shadow: 0 0 0 0.125rem rgba(44, 125, 160, 0.25);
}

.name-input:hover {
  border-color: var(--color70);
}

@media (max-width: 640px) {
  .wallet-title {
    font-size: 1.25rem;
  }

  .name-input {
    font-size: 1rem;
  }
}
</style>
