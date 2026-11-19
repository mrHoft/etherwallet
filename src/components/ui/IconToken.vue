<template>
  <span class="token-icon">
    <svg class="token-icon-image" aria-hidden="true">
      <use :href="iconHref" />
    </svg>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ symbol: string }>()
const spritesheet = `${import.meta.env.BASE_URL}icons.svg`
const iconHref = computed<string>(() => `${spritesheet}#${props.symbol.toLowerCase()}`)
</script>

<style scoped>
.token-icon {
  width: 2rem;
  height: 2rem;
  box-sizing: border-box;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  background-color: var(--color40);
  border-radius: 50%;
}

.token-icon-image {
  display: block;
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
