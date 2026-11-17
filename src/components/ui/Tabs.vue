<template>
  <div class="tabs" role="tablist" :aria-label="ariaLabel">
    <button v-for="tab in tabs" :key="tab.value" type="button" class="tab"
      :class="{ 'tab--active': modelValue === tab.value }" :disabled="disabled" role="tab"
      :aria-selected="modelValue === tab.value" @click="emit('update:modelValue', tab.value)">
      {{ tab.label }}
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
interface TabOption {
  value: T
  label: string
}

withDefaults(defineProps<{
  modelValue: T
  tabs: TabOption[]
  disabled?: boolean
  ariaLabel?: string
}>(), {
  disabled: false
})

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
</script>

<style scoped>
.tabs {
  display: grid;
  grid-auto-columns: 1fr;
  grid-auto-flow: column;
  gap: 0.25rem;
  padding: 0.25rem;
  background-color: var(--color10);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.5rem;
}

.tab {
  padding: 0.5rem;
  background: none;
  border: none;
  border-radius: 0.375rem;
  color: var(--color70);
  font-family: var(--heading);
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab:hover:not(:disabled):not(.tab--active) {
  background-color: var(--color30);
  color: var(--color90);
}

.tab--active {
  background-color: var(--color30);
  color: var(--color90);
}

.tab:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
