<template>
  <button :type="type" class="square-button" :disabled="disabled || loading" :aria-label="ariaLabel || label"
    :aria-busy="loading ? 'true' : undefined" @click="emit('click')">
    <span v-if="loading" class="square-button-spinner" aria-hidden="true"></span>
    <span v-else class="square-button-label">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  ariaLabel?: string
  type?: 'button' | 'submit'
  disabled?: boolean
  loading?: boolean
}>(), {
  type: 'button',
  disabled: false,
  loading: false
})

const emit = defineEmits<{ click: [] }>()
</script>

<style scoped>
.square-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  background: var(--color30);
  color: var(--color80);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.5rem;
  font-family: var(--mono);
  font-size: 1.15rem;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.square-button:hover:not(:disabled) {
  background: var(--color40);
  border-color: var(--color60);
  color: var(--color90);
  transform: translateY(-1px);
}

.square-button:active:not(:disabled) {
  transform: translateY(0);
}

.square-button:disabled {
  opacity: 0.45;
  cursor: default;
}

.square-button-label {
  display: block;
}

.square-button-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid var(--color40);
  border-top-color: var(--color-accent60);
  border-radius: 50%;
  animation: square-button-spin 0.7s linear infinite;
}

@keyframes square-button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
