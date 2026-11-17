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

// Public spritesheet in `public/icons.svg`; regenerate with `npm run build:icons`.
const spritesheet = `${import.meta.env.BASE_URL}icons.svg`

const iconHref = computed<string>(() => `${spritesheet}#${props.symbol.toLowerCase()}`)
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
