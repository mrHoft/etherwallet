<template>
  <div class="restore-wallet">
    <Tabs v-model="network" class="network-tabs" :tabs="tabs" aria-label="Network" />

    <EthereumWalletRestore v-if="network === 'ethereum'" :show="show" @success="emit('success', $event)"
      @cancel="emit('cancel')" />
    <TronWalletRestore v-else :show="show" @success="emit('success', $event)" @cancel="emit('cancel')" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Tabs from '~/components/ui/Tabs.vue'
import EthereumWalletRestore from '~/components/ethereum/WalletRestore.vue'
import TronWalletRestore from '~/components/tron/WalletRestore.vue'

type Network = 'ethereum' | 'tron'

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  success: [walletName: string]
  cancel: []
}>()

const network = ref<Network>('ethereum')
const tabs: { value: Network, label: string }[] = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'tron', label: 'Tron' },
]
</script>

<style scoped>
.restore-wallet {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.network-tabs {
  margin-bottom: 0.5rem;
}
</style>
