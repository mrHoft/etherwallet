<template>
  <div class="wallet-card">
    <div class="card-header">
      <h3 class="wallet-title">{{ formatWalletName(walletName) }}</h3>
      <div class="qr-placeholder" @click.stop="showQR">
        <svg class="placeholder-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <rect x="7" y="7" width="4" height="4"></rect>
          <rect x="13" y="7" width="4" height="4"></rect>
          <rect x="7" y="13" width="4" height="4"></rect>
          <rect x="13" y="13" width="4" height="4"></rect>
        </svg>
      </div>
    </div>
    <div class="address-section">
      <div class="address-value">
        <span class="address-hash">{{ formatAddress(address) }}</span>
        <CopyIcon :text="address" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import CopyIcon from '~/components/CopyIcon.vue'

const props = defineProps<{ walletName: string, address: string }>()

const emit = defineEmits<{ showQr: [address: string] }>()

const showQR = () => {
  if (props.address) {
    emit('showQr', props.address)
  }
}

const formatWalletName = (name: string): string => {
  return name.replace(/_/g, ' ')
}

const formatAddress = (address: string): string => {
  if (!address || address.length < 8) return address
  const last8 = address.slice(-8)
  return `... ${last8.slice(0, 4)} ${last8.slice(4, 8)}`
}
</script>

<style scoped>
.wallet-card {
  aspect-ratio: 1.75;
  background: linear-gradient(135deg, var(--color10) 0%, var(--color20) 100%);
  border-radius: 1rem;
  padding: 1.5rem;
  border: var(--border-thickness) solid var(--color40);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.wallet-card::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--color-accent60);
  transform: scaleX(0);
  transition: transform 0.3s ease;
}

.wallet-card:hover {
  /* transform: translateY(-4px); */
  border-color: var(--color-accent60);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.3);
}

.wallet-card:hover::before {
  transform: scaleX(1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.wallet-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color90);
  margin: 0;
  letter-spacing: -0.01em;
  text-transform: capitalize;
}

.address-section {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  padding: 16px;
}

.address-value {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.address-hash {
  font-family: 'Courier New', 'SF Mono', monospace;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color80);
  letter-spacing: 0.5px;
}

.qr-placeholder {
  color: var(--color50);
  transition: color 0.3s ease;
}

.qr-placeholder:hover {
  color: var(--color-accent60);
}

.placeholder-icon {
  width: 80px;
  height: 80px;
}
</style>
