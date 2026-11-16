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
import { getRoute, isLandingPath } from './routes'
import { isDecoyEnabled } from '~/utils/decoy'
import { withBase } from '~/utils/path'

const resolveRoute = () => {
  if (isLandingPath(window.location.pathname) && !isDecoyEnabled()) {
    window.history.replaceState({}, '', withBase('/home'))
  }

  return getRoute(window.location.pathname)
}

const currentRoute = shallowRef(resolveRoute())

const currentComponent = computed(() => markRaw(currentRoute.value.component))

const handleNavigation = () => {
  currentRoute.value = resolveRoute()
}

onMounted(() => {
  window.addEventListener('popstate', handleNavigation)
})

onUnmounted(() => {
  window.removeEventListener('popstate', handleNavigation)
})
</script>
