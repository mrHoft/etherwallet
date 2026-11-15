<template>
  <span class="token-icon">
    <img class="token-icon-image" :src="iconSrc" alt="" />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ symbol: string }>()

const iconSrc = computed<string>(
  () => `${import.meta.env.BASE_URL}icons/${props.symbol.toLowerCase()}.svg`
)
</script>

<style scoped>
.token-icon {
  width: 2.5rem;
  height: 2.5rem;
  box-sizing: border-box;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.3rem;
  background-color: var(--color50);
  border-radius: 50%;
  border: var(--border-thickness) solid var(--color40);
}

.token-icon-image {
  width: 100%;
  height: 100%;
}

@media (max-width: 768px) {
  .token-icon {
    width: 2rem;
    height: 2rem;
    padding: 0.25rem;
  }
}
</style>
