<template>
  <div class="page-interest">
    <div class="container">
      <h1 class="page-title">Interest-bearing</h1>
      <Tabs v-model="activeNetwork" :tabs="tabs" aria-label="Network" />
      <template v-if="activeNetwork === 'ethereum'">
        <StETH />
        <AEthUSDC />
      </template>
      <template v-else>
        <STRX />
        <StUSDT />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import StETH from '~/components/interest/stETH.vue'
import AEthUSDC from '~/components/interest/aEthUSDC.vue'
import STRX from '~/components/interest/sTRX.vue'
import StUSDT from '~/components/interest/stUSDT.vue'
import Tabs from '~/components/ui/Tabs.vue'

type InterestNetwork = 'ethereum' | 'tron'

const tabs: { value: InterestNetwork; label: string }[] = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'tron', label: 'Tron' },
]

const activeNetwork = ref<InterestNetwork>('ethereum')
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
