<template>
  <div class="page-settings">
    <div class="settings-container">
      <h1 class="page-title">Settings</h1>

      <ThemeSettings />
      <BalanceDeltaPeriod />
      <GasDisplay />
      <DecoySettings />
      <ApiKeySettings />
      <MainnetProviders />
      <ResetCache />
    </div>
  </div>
</template>

<script setup lang="ts">
import ApiKeySettings from '~/components/settings/ApiKeySettings.vue'
import BalanceDeltaPeriod from '~/components/settings/BalanceDeltaPeriod.vue'
import DecoySettings from '~/components/settings/DecoySettings.vue'
import GasDisplay from '~/components/settings/GasDisplay.vue'
import MainnetProviders from '~/components/settings/MainnetProviders.vue'
import ResetCache from '~/components/settings/ResetCache.vue'
import ThemeSettings from '~/components/settings/ThemeSettings.vue'
</script>

<style scoped>
.page-settings {
  max-width: 600px;
  margin: 0 auto;
}

.settings-container {
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
