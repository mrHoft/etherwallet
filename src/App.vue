<template>
  <Layout>
    <component :is="currentComponent" />
  </Layout>
</template>

<script setup lang="ts">
import { shallowRef, onMounted, onUnmounted, markRaw } from 'vue'
import Layout from './components/Layout.vue'
import { getRouteComponent } from './routes'

const currentComponent = shallowRef(markRaw(getRouteComponent(window.location.pathname)))

const handleNavigation = () => {
  currentComponent.value = markRaw(getRouteComponent(window.location.pathname))
}

onMounted(() => {
  window.addEventListener('popstate', handleNavigation)
})

onUnmounted(() => {
  window.removeEventListener('popstate', handleNavigation)
})
</script>
