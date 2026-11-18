<template>
  <section>
    <div class="wallets" @dragover.prevent @drop.prevent="handleDrop" @dragend="handleDragEnd">
      <template v-if="walletEntries.length === 0">
        <WalletCardNew />
      </template>
      <template v-else>
        <WalletCard v-for="([walletName, wallet], index) in walletEntries" :key="walletName"
          :class="{ 'wallet-card--dragging': draggedWalletName === walletName }" :wallet-name="walletName"
          :address="getWalletAddress(wallet)" :network="wallet.network"
          :style="{ animationDelay: `${index * 0.05}s` }" draggable="true"
          @dragstart="handleDragStart($event, walletName)" @dragover.prevent="handleDragOver($event, walletName)"
          @show-qr="handleShowQR($event, wallet.network)" />
      </template>
    </div>
    <ModalQRCode ref="modalQRRef" />
  </section>
</template>

<script setup lang="ts">
import { onActivated, ref } from 'vue'
import { getWallets, setWalletOrder, type StoredWallet, type WalletNetwork } from '~/utils/wallets'
import { getWalletAddress } from '~/utils/walletAddress'
import WalletCard from '~/components/WalletCard.vue'
import WalletCardNew from '~/components/WalletCardNew.vue'
import ModalQRCode from '~/components/ModalQRCode.vue'

defineOptions({ name: 'PageHome' })

const modalQRRef = ref<InstanceType<typeof ModalQRCode>>()

const handleShowQR = (address: string, network: WalletNetwork) => {
  modalQRRef.value?.show(address, network)
}

const walletEntries = ref<[string, StoredWallet][]>(Object.entries(getWallets()))

const draggedWalletName = ref<string | null>(null)
const dragStartOrder = ref<string[]>([])
const didDrop = ref(false)

const handleDragStart = (event: DragEvent, walletName: string): void => {
  draggedWalletName.value = walletName
  dragStartOrder.value = walletEntries.value.map(([name]) => name)
  didDrop.value = false

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', walletName)

    const card = event.currentTarget as HTMLElement | null
    if (card) event.dataTransfer.setDragImage(card, 16, 16)
  }
}

const handleDragOver = (event: DragEvent, hoveredWalletName: string): void => {
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'

  const dragged = draggedWalletName.value
  if (!dragged || dragged === hoveredWalletName) return

  const reordered = [...walletEntries.value]
  const draggedIndex = reordered.findIndex(([name]) => name === dragged)
  if (draggedIndex === -1) return

  const draggedEntry = reordered[draggedIndex]
  reordered.splice(draggedIndex, 1)

  const hoveredIndex = reordered.findIndex(([name]) => name === hoveredWalletName)
  if (hoveredIndex === -1) return

  reordered.splice(hoveredIndex + 1, 0, draggedEntry)

  if (reordered.every(([name], index) => name === walletEntries.value[index]?.[0])) return

  walletEntries.value = reordered
}

const handleDrop = (): void => {
  if (!draggedWalletName.value) return

  didDrop.value = true

  const order = walletEntries.value.map(([name]) => name)
  const orderChanged = order.some((name, index) => name !== dragStartOrder.value[index])
  if (!orderChanged) return

  setWalletOrder(order)
}

const handleDragEnd = (): void => {
  if (!didDrop.value) {
    walletEntries.value = Object.entries(getWallets())
  }

  draggedWalletName.value = null
  dragStartOrder.value = []
  didDrop.value = false
}

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

.wallet-card--dragging {
  opacity: 0.4;
}
</style>
