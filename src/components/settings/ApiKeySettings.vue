<template>
  <SettingsSection title="API keys" description="Used to request transaction history.">
    <Tabs v-model="activeTab" :tabs="tabs" aria-label="API key provider" />

    <div v-if="activeTab === 'etherscan'" class="api-key-panel">
      <label class="api-key-label" for="etherscan-api-key">ETHERSCAN_API_KEY</label>
      <input id="etherscan-api-key" :value="etherscanApiKey" class="api-key-input" type="text"
        autocomplete="off" spellcheck="false" placeholder="Enter your Etherscan API key"
        @input="handleEtherscanInput" />
      <p class="api-key-hint">
        Get your own key on
        <a href="https://docs.etherscan.io/set-up-your-api-key" target="_blank"
          rel="noopener noreferrer">etherscan.io</a>
      </p>
    </div>

    <div v-else class="api-key-panel">
      <label class="api-key-label" for="trongrid-api-key">TRONGRID_API_KEY</label>
      <input id="trongrid-api-key" :value="tronGridApiKey" class="api-key-input" type="text"
        autocomplete="off" spellcheck="false" placeholder="Enter your TronGrid API key"
        @input="handleTronGridInput" />
      <p class="api-key-hint">
        Get your own key on
        <a href="https://www.trongrid.io/" target="_blank" rel="noopener noreferrer">trongrid.io</a>
      </p>
    </div>
  </SettingsSection>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { getStoredEtherscanApiKey, setEtherscanApiKey } from '~/api/etherscan'
import { getStoredTronGridApiKey, setTronGridApiKey } from '~/api/tron/history'
import SettingsSection from '~/components/settings/SettingsSection.vue'
import Tabs from '~/components/ui/Tabs.vue'

type ApiKeyProvider = 'etherscan' | 'trongrid'

const tabs: { value: ApiKeyProvider; label: string }[] = [
  { value: 'etherscan', label: 'Etherscan' },
  { value: 'trongrid', label: 'TronGrid' },
]

const activeTab = ref<ApiKeyProvider>('etherscan')
const etherscanApiKey = ref<string>(getStoredEtherscanApiKey())
const tronGridApiKey = ref<string>(getStoredTronGridApiKey())

const handleEtherscanInput = (event: Event): void => {
  const target = event.target as HTMLInputElement
  etherscanApiKey.value = target.value
  setEtherscanApiKey(target.value)
}

const handleTronGridInput = (event: Event): void => {
  const target = event.target as HTMLInputElement
  tronGridApiKey.value = target.value
  setTronGridApiKey(target.value)
}
</script>

<style scoped>
.api-key-panel {
  margin-top: 0.75rem;
}

.api-key-label {
  display: block;
  margin: 0 0 0.5rem;
  font-family: var(--heading);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color90);
}

.api-key-input {
  width: 100%;
  box-sizing: border-box;
  height: 2.25rem;
  padding: 0 0.75rem;
  background: var(--color20);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.5rem;
  color: var(--color90);
  font-family: var(--mono);
  font-size: 0.85rem;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.api-key-input:focus {
  border-color: var(--color-accent60);
  background: var(--color10);
}

.api-key-hint {
  margin: 0.5rem 0 0;
  color: var(--color70);
  font-family: var(--sans);
  font-size: 0.8rem;
  line-height: 1.5;
}
</style>
