<template>
  <Layout :show-navigation="currentRoute.showNavigation !== false">
    <KeepAlive :include="['PageHome']">
      <component :is="currentComponent" />
    </KeepAlive>
  </Layout>
</template>

<script setup lang="ts">
import { computed, shallowRef, onMounted, onUnmounted, markRaw } from 'vue'
import Layout from './components/Layout.vue'
import { getRoute } from './routes'

const currentRoute = shallowRef(getRoute(window.location.pathname))

const currentComponent = computed(() => markRaw(currentRoute.value.component))

const handleNavigation = () => {
  currentRoute.value = getRoute(window.location.pathname)
}

onMounted(() => {
  window.addEventListener('popstate', handleNavigation)
})

onUnmounted(() => {
  window.removeEventListener('popstate', handleNavigation)
})
</script>
