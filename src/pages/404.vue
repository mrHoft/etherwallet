<template>
  <div class="not-found-page">
    <div class="container">
      <div class="content">
        <div class="error-code">404</div>
        <h1 class="title">Page Not Found</h1>
        <p class="message">
          Oops! The page you're looking for doesn't exist or has been moved.
        </p>
        <button @click="goHome" class="home-button">← Back to Home</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { router } from '~/utils/router';

const goHome = () => {
  router.navigate('/')
}
</script>

<style scoped>
.not-found-page {
  min-height: 100vh;
  background: var(--color00);
  padding: 1.5rem;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}

.container {
  max-width: 600px;
  width: 100%;
  margin: 0 auto;
  background: var(--color10);
  border-radius: 1rem;
  padding: 3rem 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.content {
  text-align: center;
}

.error-code {
  font-size: 6rem;
  font-weight: 700;
  color: var(--color-accent60);
  line-height: 1;
  margin-bottom: 1rem;
}

.title {
  font-size: 1.875rem;
  font-weight: 600;
  color: var(--color90);
  margin-bottom: 1rem;
}

.message {
  font-size: 1rem;
  color: var(--color70);
  margin-bottom: 2rem;
  line-height: 1.5;
}

.home-button {
  background: var(--color-accent60);
  color: white;
  border: none;
  padding: 0.875rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.home-button:hover {
  background: var(--color-accent80);
}

@media (max-width: 768px) {
  .not-found-page {
    padding: 1rem;
  }

  .container {
    padding: 2rem 1.5rem;
  }

  .error-code {
    font-size: 4rem;
  }

  .title {
    font-size: 1.5rem;
  }

  .message {
    font-size: 0.875rem;
  }
}

@media (max-width: 480px) {
  .container {
    padding: 1.5rem 1rem;
  }

  .error-code {
    font-size: 3rem;
  }

  .title {
    font-size: 1.25rem;
  }

  .home-button {
    padding: 0.75rem 1.25rem;
    font-size: 0.875rem;
  }
}
</style>
