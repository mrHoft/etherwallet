<template>
  <main class="main">
    <slot />
  </main>
  <Navigation />
</template>

<script setup lang="ts">
import Navigation from './Navigation.vue'
</script>

<style scoped>
.main {
  height: calc(100vh - 4rem);
}
</style>
