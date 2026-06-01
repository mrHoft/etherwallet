<template>
  <div class="copy-icon-wrapper">
    <svg @click.stop="handleCopy" :class="['copy-icon', { 'copy-success': isSuccess }]"
      xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
    <span v-if="isSuccess" class="copy-tooltip">Copied!</span>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  text: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  copySuccess: []
}>()

const isSuccess = ref<boolean>(false)
let timeoutId: number | null = null

const handleCopy = async () => {
  try {
    await navigator.clipboard.writeText(props.text)

    isSuccess.value = true
    emit('copySuccess')

    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = window.setTimeout(() => {
      isSuccess.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy mnemonic:', err)
  }
}
</script>

<style scoped>
.copy-icon-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.copy-icon {
  cursor: pointer;
  color: var(--color60);
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.copy-icon:hover {
  color: var(--color-accent60);
  transform: scale(1.1);
}

.copy-icon.copy-success {
  color: #10b981;
  transform: scale(1.1);
}

.copy-tooltip {
  position: absolute;
  top: -30px;
  right: 0;
  background: #10b981;
  color: white;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  white-space: nowrap;
  animation: fadeInUp 0.2s ease;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(5px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
