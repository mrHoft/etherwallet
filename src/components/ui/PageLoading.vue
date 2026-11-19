<template>
  <div class="page-loading">
    <div class="loading-spinner"></div>
  </div>
</template>

<style scoped>
.page-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem;
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: var(--border-thickness) solid var(--color30);
  border-top-color: var(--color-accent60);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
