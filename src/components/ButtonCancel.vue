<template>
  <button type="button" @click="$emit('cancel')" class="button-cancel">Cancel</button>
</template>

<script setup lang="ts">
const emit = defineEmits<{ cancel: [] }>()
</script>

<style scoped>
.button-cancel {
  background: var(--color30);
  color: var(--color80);
  border: var(--border-thickness) solid var(--color40);
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
}

.button-cancel:hover {
  background: var(--color40);
  color: var(--color90);
}
</style>
