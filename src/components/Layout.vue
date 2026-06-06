<template>
  <main class="main">
    <div class="bg"></div>
    <slot />
  </main>
  <Navigation />
</template>

<script setup lang="ts">
import Navigation from './Navigation.vue'
</script>

<style scoped>
.main {
  position: relative;
  height: calc(100vh - 4rem);
}

.bg {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background-image: url(/frame.svg);
  filter: invert(var(--color-scheme)) opacity(0.05);
  z-index: -1;
}

.main>* {
  padding: 1rem 1rem 5rem;
}
</style>
