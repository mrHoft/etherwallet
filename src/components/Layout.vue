<template>
  <main class="main" :class="{ 'main--no-navigation': !showNavigation }">
    <slot />
  </main>
  <Navigation v-if="showNavigation" />
</template>

<script setup lang="ts">
import Navigation from './Navigation.vue'

withDefaults(defineProps<{ showNavigation?: boolean }>(), { showNavigation: true })
</script>

<style scoped>
.main {
  position: relative;
  min-height: calc(100vh - 4rem);
  isolation: isolate;
}

.main::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: url(/images/bg.svg);
  filter: invert(var(--color-scheme)) opacity(0.1);
  z-index: -1;
  pointer-events: none;
}

.main--no-navigation {
  min-height: unset;
}

.main>* {
  padding: 1rem 1rem 5rem;
}

.main--no-navigation>* {
  padding-bottom: 1rem;
}
</style>
