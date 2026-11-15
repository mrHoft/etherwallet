<template>
  <section>
    <div class="wallets">
      <template v-if="walletEntries.length === 0">
        <WalletCardNew />
      </template>
      <template v-else>
        <WalletCard v-for="([walletName, encryptedJson], index) in walletEntries" :key="walletName"
          :wallet-name="walletName" :address="getAddressFromJson(encryptedJson)"
          :style="{ animationDelay: `${index * 0.05}s` }" @show-qr="handleShowQR" />
      </template>
    </div>
    <ModalQRCode ref="modalQRRef" />
  </section>
</template>

<script setup lang="ts">
import { onActivated, ref } from 'vue'
import { getWallets } from '~/utils/wallets'
import WalletCard from '~/components/WalletCard.vue'
import WalletCardNew from '~/components/WalletCardNew.vue'
import ModalQRCode from '~/components/ModalQRCode.vue'

defineOptions({ name: 'PageHome' })

const modalQRRef = ref<InstanceType<typeof ModalQRCode>>()

const handleShowQR = (address: string) => {
  modalQRRef.value?.show(address)
}

interface WalletData {
  address: string
  [key: string]: unknown
}

const getAddressFromJson = (encryptedJson: string): string => {
  try {
    const parsedData: WalletData = JSON.parse(encryptedJson)
    if (!parsedData.address) return ''
    if (!parsedData.address.startsWith('0x')) {
      return `0x${parsedData.address}`
    }
    return parsedData.address
  } catch (error) {
    console.error('Failed to parse wallet JSON:', error)
    return ''
  }
}

const walletEntries = ref<[string, string][]>(Object.entries(getWallets()))

const refreshWalletEntries = () => {
  walletEntries.value = Object.entries(getWallets())
}

onActivated(refreshWalletEntries)
</script>

<style scoped>
.wallets {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.wallet-card {
  animation: fadeInUp 0.5s ease-out backwards;
}
</style>
