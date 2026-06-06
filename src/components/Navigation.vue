<!-- components/Navigation.vue -->
<template>
  <nav class="navigation">
    <div class="navigation__container">
      <button v-for="route in navigationRoutes" :key="route.path" class="button-nav"
        :class="{ 'button-nav--active': currentPath === route.path }" :disabled="currentPath === route.path"
        @click="navigateTo(route.path)">
        <svg class="navigation__icon" viewBox="0 0 24 24" fill="currentColor">
          <path :d="route.icon" />
        </svg>
        <span class="navigation__label">{{ route.label }}</span>
      </button>
      <!--
      <button class="button-nav" @click="navigateToRandom">
        <svg class="navigation__icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
        <span class="navigation__label">Not Found</span>
      </button>
      -->
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const navigationRoutes = [
  {
    path: '/',
    label: 'Home',
    icon: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z'
  },
  {
    path: '/create',
    label: 'Create',
    icon: 'm12,2C6.48,2,2,6.48,2,12s4.48,10,10,10,10-4.48,10-10S17.52,2,12,2Zm7,11h-6v6h-2v-6h-6v-2h6v-6h2v6h6v2Z'
  },
  /* {
    path: '/account',
    label: 'Account',
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'
  }, */
  {
    path: '/send',
    label: 'Send',
    icon: 'm12,2C6.48,2,2,6.48,2,12s4.48,10,10,10,10-4.48,10-10S17.52,2,12,2Zm5.85,10.15h-2v-2.59l-8.29,8.29-1.41-1.41,8.29-8.29h-2.59v-2h6v6Z'
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: 'm12,8.74c4.23-.06,4.23,6.58,0,6.52-4.23.06-4.23-6.58,0-6.52Z m8.29,0.41c-1.85,0-2.71-1.37-1.69-2.92,1.46-2.2-3.46-5.2-4.94-2.87-.99,1.57-2.25,1.48-3.37,0-1.55-2.05-6.43.42-4.92,2.88.97,1.58.18,2.91-1.68,2.91-2.69,0-2.75,5.71,0,5.71,1.85,0,2.58,1.29,1.68,2.92-1.43,2.58,3.52,5.19,4.94,2.87.97-1.58,2.32-1.53,3.37,0,1.71,2.49,6.24-.79,4.94-2.87-.98-1.58-.18-2.92,1.68-2.92,2.76,0,2.84-5.71-.01-5.71Z'
  }
]

const currentPath = ref(window.location.pathname)

const updateCurrentPath = () => {
  currentPath.value = window.location.pathname
}

const navigateTo = (path: string) => {
  if (currentPath.value !== path) {
    window.history.pushState({}, '', path)
    updateCurrentPath()
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
}
/*
const navigateToRandom = () => {
  const sequence = Array.from(
    { length: Math.floor(Math.random() * 3) + 4 },
    () => String.fromCharCode(Math.floor(Math.random() * 25) + 97)
  )
  const randomPath = `/${sequence.join('')}`
  window.history.pushState({}, '', randomPath)
  updateCurrentPath()
  window.dispatchEvent(new PopStateEvent('popstate'))
}
*/
onMounted(() => {
  window.addEventListener('popstate', updateCurrentPath)
})

onUnmounted(() => {
  window.removeEventListener('popstate', updateCurrentPath)
})
</script>

<style scoped>
.navigation {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--color20);
  backdrop-filter: blur(10px);
  border-top: var(--border-thickness) solid var(--color40);
  box-shadow: var(--shadow);
  z-index: 1000;
}

.navigation__container {
  display: flex;
  justify-content: space-around;
  align-items: center;
  max-width: 500px;
  margin: 0 auto;
  height: 4rem;
}

.button-nav {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px 16px;
  transition: all 0.2s ease;
  color: var(--color70);
  font-size: 12px;
  border-radius: 8px;
  font-family: var(--sans);
}

.button-nav:not(:disabled):hover {
  color: var(--link-color);
  background: var(--color30);
}

.button-nav--active {
  color: var(--link-color);
  font-weight: 500;
}

.button-nav:disabled {
  opacity: 0.6;
  cursor: default;
}

.navigation__icon {
  width: 24px;
  height: 24px;
}

.navigation__label {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.18px;
}
</style>
