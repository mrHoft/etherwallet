<template>
  <div class="add-wallet">
    <Tabs v-model="network" class="network-tabs" :tabs="tabs" aria-label="Network" />

    <EthereumWalletAdd v-if="network === 'ethereum'" :show="show" @success="emit('success', $event)"
      @cancel="emit('cancel')" />
    <TronWalletAdd v-else :show="show" @success="emit('success', $event)" @cancel="emit('cancel')" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Tabs from '~/components/ui/Tabs.vue'
import EthereumWalletAdd from '~/components/ethereum/WalletAdd.vue'
import TronWalletAdd from '~/components/tron/WalletAdd.vue'

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
.add-wallet {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.network-tabs {
  margin-bottom: 0.5rem;
}
</style>
