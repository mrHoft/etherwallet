<template>
  <div class="page-settings">
    <div class="settings-container">
      <h1 class="page-title">Settings</h1>

      <section class="section">
        <h2 class="section-title">Mainnet providers</h2>

        <p class="section-description">
          Requests are sent to these Ethereum mainnet RPC providers. Remove unavailable endpoints or add your own.
        </p>

        <ul v-if="providers.length" class="provider-list">
          <li v-for="url in providers" :key="url"
            :class="['provider-row', { 'provider-row--checking': isChecking(url) }]">
            <span :class="['provider-url', healthClass(url)]">{{ url }}</span>
            <SquareButton label="♥" aria-label="Check provider health" title="Check provider health"
              :loading="isChecking(url)" @click="handleCheckProvider(url)" />
            <SquareButton label="-" aria-label="Remove provider" title="Remove provider"
              @click="handleRemoveProvider(url)" />
          </li>
        </ul>

        <p v-else class="provider-empty">No providers configured. Add one below to enable network requests.</p>

        <form class="provider-form" novalidate @submit.prevent="handleAddProvider">
          <input v-model="newProviderUrl" type="url" class="provider-input" placeholder="https://..."
            aria-label="New RPC provider URL" />
          <SquareButton label="+" aria-label="Add provider" title="Add provider" type="submit" />
        </form>

        <p v-if="providerError" class="provider-message provider-message--error">{{ providerError }}</p>
        <p v-else-if="providerMessage" class="provider-message">{{ providerMessage }}</p>
      </section>

      <section class="section">
        <h2 class="section-title">Reset cache</h2>

        <ul class="reset-description">
          <li>Reset cached values for token balances.</li>
          <li>Reset starting account value.</li>
        </ul>

        <button type="button" class="button-reset" @click="handleReset">Reset</button>

        <p v-if="statusMessage" class="status-message">{{ statusMessage }}</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { resetAccountBalance } from '~/utils/accountBalance'
import { addRpcUrl, getRpcUrls, removeRpcUrl } from '~/api/rpcUrls'
import { rpcProvider } from '~/api/provider'
import SquareButton from '~/components/SquareButton.vue'

type HealthStatus = 'idle' | 'checking' | 'healthy' | 'unhealthy'

const statusMessage = ref<string>('')
const providers = ref<string[]>(getRpcUrls())
const newProviderUrl = ref<string>('')
const providerMessage = ref<string>('')
const providerError = ref<string>('')
const healthStatuses = ref<Record<string, HealthStatus>>({})

let checkSequence = 0
const checkTokens = new Map<string, number>()

const getHealthStatus = (url: string): HealthStatus => healthStatuses.value[url] ?? 'idle'

const isChecking = (url: string): boolean => getHealthStatus(url) === 'checking'

const healthClass = (url: string): string => {
  const status = getHealthStatus(url)

  if (status === 'healthy') return 'provider-url--healthy'
  if (status === 'unhealthy') return 'provider-url--unhealthy'

  return ''
}

const handleAddProvider = (): void => {
  providerMessage.value = ''
  providerError.value = ''

  try {
    const addedUrl = addRpcUrl(newProviderUrl.value)
    providers.value = getRpcUrls()
    healthStatuses.value = { ...healthStatuses.value, [addedUrl]: 'idle' }
    newProviderUrl.value = ''
    providerMessage.value = 'Provider added.'
    rpcProvider.resetProvider()
  } catch (error) {
    providerError.value = error instanceof Error ? error.message : 'Failed to add provider'
  }
}

const handleRemoveProvider = (url: string): void => {
  removeRpcUrl(url)
  providers.value = getRpcUrls()

  const statuses = { ...healthStatuses.value }
  delete statuses[url]
  healthStatuses.value = statuses

  checkTokens.delete(url)
  providerError.value = ''
  providerMessage.value = 'Provider removed.'
  rpcProvider.resetProvider()
}

const handleCheckProvider = async (url: string): Promise<void> => {
  if (isChecking(url)) return

  const token = ++checkSequence
  checkTokens.set(url, token)
  healthStatuses.value = { ...healthStatuses.value, [url]: 'checking' }

  const isHealthy = await rpcProvider.checkProviderHealthy(url)

  if (checkTokens.get(url) !== token || !providers.value.includes(url)) return

  healthStatuses.value = {
    ...healthStatuses.value,
    [url]: isHealthy ? 'healthy' : 'unhealthy'
  }
}

const handleReset = (): void => {
  resetAccountBalance()
  statusMessage.value = 'Cache cleared. Starting values will be recreated when a wallet is opened.'
}
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

.section {
  background-color: var(--color10);
  border-radius: 0.5rem;
  padding: 1rem;
  border: var(--border-thickness) solid var(--color40);
}

.section-title {
  font-family: var(--heading);
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color90);
  margin: 0 0 0.75rem;
}

.section-description {
  margin: 0 0 0.75rem;
  color: var(--color70);
  font-family: var(--sans);
  font-size: 0.9rem;
  line-height: 1.5;
}

.provider-list {
  list-style: none;
  margin: 0 0 0.25rem;
  padding: 0;
}

.provider-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.provider-url {
  flex: 1;
  min-width: 0;
  height: 2.25rem;
  padding: 0 0.75rem;
  background: var(--color20);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.5rem;
  color: var(--color90);
  font-family: var(--mono);
  font-size: 0.85rem;
  line-height: 2.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
}

.provider-url--healthy {
  color: var(--color-up);
}

.provider-url--unhealthy {
  color: var(--color-down);
}

.provider-row--checking .provider-url {
  animation: provider-pulse 1s ease-in-out infinite;
}

@keyframes provider-pulse {
  0%,
  100% {
    opacity: 0.45;
  }

  50% {
    opacity: 1;
  }
}

.provider-empty {
  margin: 0 0 1rem;
  color: var(--color60);
  font-family: var(--sans);
  font-size: 0.9rem;
  font-style: italic;
}

.provider-form {
  display: flex;
  gap: 0.5rem;
}

.provider-input {
  flex: 1;
  min-width: 0;
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

.provider-input::placeholder {
  color: var(--color60);
  font-family: var(--sans);
}

.provider-input:focus {
  border-color: var(--color-accent60);
  background: var(--color10);
}

.provider-message {
  margin-top: 0.75rem;
  color: var(--color-up);
  font-family: var(--mono);
  font-size: 0.8rem;
}

.provider-message--error {
  color: var(--color-down);
}

.reset-description {
  margin: 0 0 1rem;
  padding-left: 1.25rem;
  color: var(--color80);
  font-family: var(--sans);
  font-size: 0.95rem;
  line-height: 1.6;
}

.button-reset {
  background-color: var(--color-accent60);
  color: white;
  border: none;
  border-radius: 0.5rem;
  padding: 0.5rem 1.5rem;
  font-family: var(--sans);
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.button-reset:hover {
  background-color: var(--color-accent80);
}

.status-message {
  margin-top: 0.75rem;
  color: var(--color-up);
  font-family: var(--mono);
  font-size: 0.8rem;
}
</style>
