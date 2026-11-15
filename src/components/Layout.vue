<template>
  <main class="main" :class="{ 'main--no-navigation': !showNavigation }">
    <div class="bg"></div>
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
  height: calc(100vh - 4rem);
}

.main--no-navigation {
  height: 100vh;
}

.bg {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background-image: url(/images/bg.svg);
  filter: invert(var(--color-scheme)) opacity(0.05);
  z-index: -1;
}

.main>* {
  padding: 1rem 1rem 5rem;
}

.main--no-navigation>* {
  padding-bottom: 1rem;
}
</style>
