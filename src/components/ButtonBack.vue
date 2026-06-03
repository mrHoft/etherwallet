<template>
  <button @click="goHome" class="button-back">← Back to Home</button>
</template>

<script setup lang="ts">
import { useNavigation } from '~/composables/useNavigation'
const { navigateTo } = useNavigation()

const goHome = () => {
  navigateTo('/')
}
</script>

<style scoped>
.button-back {
  background: var(--color-accent60);
  color: white;
  border: none;
  padding: 0.75rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.button-back:hover {
  background: var(--color-accent80);
}
</style>
