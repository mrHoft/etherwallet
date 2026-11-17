<template>
  <div class="page-interest">
    <div class="container">
      <h1 class="page-title">Interest-bearing</h1>
      <Aave />
      <Lido />
    </div>
  </div>
</template>

<script setup lang="ts">
import Aave from '~/components/interest/Aave.vue'
import Lido from '~/components/interest/Lido.vue'
</script>

<style scoped>
.page-interest {
  max-width: 600px;
  margin: 0 auto;
}

.container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-title {
  font-family: var(--heading);
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color90);
  margin: 0;
}
</style>
