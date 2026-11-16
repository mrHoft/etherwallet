<template>
  <SettingsSection title="Etherscan" description="Used to request transaction history">
    <label class="api-key-label" for="etherscan-api-key">ETHERSCAN_API_KEY</label>
    <input id="etherscan-api-key" :value="apiKey" class="api-key-input" type="text" autocomplete="off"
      spellcheck="false" placeholder="Enter your Etherscan API key" @input="handleApiKeyInput" />
    <p class="api-key-hint">Stored locally in this browser. When empty, the build-time key is used.</p>
  </SettingsSection>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { getStoredEtherscanApiKey, setEtherscanApiKey } from '~/api/config'
import SettingsSection from '~/components/settings/SettingsSection.vue'

const apiKey = ref<string>(getStoredEtherscanApiKey())

const handleApiKeyInput = (event: Event): void => {
  const target = event.target as HTMLInputElement
  apiKey.value = target.value
  setEtherscanApiKey(target.value)
}
</script>

<style scoped>
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
