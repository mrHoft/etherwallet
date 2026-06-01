<template>
  <div class="wallet-card new-wallet-card" @click="handleCreateWallet">
    <div class="card-header">
      <h3 class="wallet-title">Create New Wallet</h3>
      <div class="card-chip">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 46 32" fill="currentColor">
          <circle cx="16" cy="16" r="16" opacity="0.5" />
          <circle cx="30" cy="16" r="16" opacity="0.5" />
        </svg>
      </div>
    </div>

    <div class="address-section">
      <div class="plus-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </div>
      <div class="create-text">Start your crypto journey</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useNavigation } from '~/composables/useNavigation'

const { navigateTo } = useNavigation()

const handleCreateWallet = () => {
  navigateTo('/create')
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

.card-chip {
  width: 46px;
  height: 32px;
  color: var(--color-accent80);
  opacity: 0.8;
}

.address-section {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.plus-icon {
  color: var(--color-accent80);
  opacity: 0.9;
  transition: all 0.3s ease;
}

.new-wallet-card:hover .plus-icon {
  transform: scale(1.1);
  color: var(--color-accent60);
}

.create-text {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color70);
  letter-spacing: 0.3px;
}
</style>
