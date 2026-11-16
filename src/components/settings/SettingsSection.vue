<template>
  <section class="section">
    <h2 class="section-title">{{ title }}</h2>

    <p v-if="description" class="section-description">{{ description }}</p>

    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<style scoped>
.section {
  background-color: var(--color10);
  border-radius: 0.5rem;
  padding: 1rem;
  border: var(--border-thickness) solid var(--color40);
}

.section-title {
  font-family: var(--heading);
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color90);
  margin: 0 0 0.75rem;
}

.section-description {
  margin: 0 0 0.75rem;
  color: var(--color70);
  font-family: var(--sans);
  font-size: 0.9rem;
  line-height: 1.5;
}
</style>
