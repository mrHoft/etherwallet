<template>
  <div class="page-settings">
    <div class="settings-container">
      <h1 class="page-title">Settings</h1>

      <section class="section">
        <h2 class="section-title">Theme</h2>

        <p class="section-description">
          Choose how EtherWallet looks. System follows your device appearance.
        </p>

        <div class="theme-options" role="group" aria-label="Theme">
          <button type="button" :class="['theme-option', { 'theme-option--active': themePreference === 'light' }]"
            :aria-pressed="themePreference === 'light'" @click="setThemePreference('light')">
            <span class="theme-option__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke-width="1.5">
                <circle fill="currentColor" cx="12" cy="12" r="5" />
                <path stroke="currentColor"
                  d="M12 2V6M12 18V22M18 12H22M2 12H6M5 5L7.8 7.8M16.2 16.2L19 19M16.2 7.8L19 5M5 19L7.8 16.2" />
              </svg>
            </span>
            <span>Light</span>
          </button>

          <button type="button" :class="['theme-option', { 'theme-option--active': themePreference === 'dark' }]"
            :aria-pressed="themePreference === 'dark'" @click="setThemePreference('dark')">
            <span class="theme-option__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                fill="currentColor">
                <path
                  d="m21.96,16.11c-1.69,3.75-5.4,5.89-9.44,5.89-5.8,0-10.52-4.72-10.52-10.53,0-4.02,2.41-7.92,5.84-9.43.43-.19.72.22.57.56-.63,1.36-.99,2.77-.99,4.27,0,5.34,4.34,9.69,9.67,9.69,1.51,0,3.03-.3,4.31-1.01.46-.26.79.07.56.56Z" />
              </svg>
            </span>
            <span>Dark</span>
          </button>

          <button type="button" :class="['theme-option', { 'theme-option--active': themePreference === 'system' }]"
            :aria-pressed="themePreference === 'system'" @click="setThemePreference('system')">
            <span class="theme-option__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="4" width="18" height="13" rx="2" />
                <path d="M8 21H16M12 17V21" />
              </svg>
            </span>
            <span>System</span>
          </button>
        </div>
      </section>

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
import { useTheme } from '~/composables/useTheme'

type HealthStatus = 'idle' | 'checking' | 'healthy' | 'unhealthy'

const { preference: themePreference, setPreference: setThemePreference } = useTheme()
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

.theme-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.theme-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 4.25rem;
  padding: 0.65rem 0.5rem;
  background-color: var(--color20);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.5rem;
  color: var(--color70);
  font-family: var(--sans);
  font-size: 0.85rem;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.theme-option:hover {
  background-color: var(--color30);
  color: var(--color90);
}

.theme-option:focus-visible {
  outline: var(--border-thickness) solid var(--color-accent60);
  outline-offset: 2px;
}

.theme-option--active {
  background-color: var(--color30);
  border-color: var(--color-accent60);
  color: var(--color90);
}

.theme-option--active .theme-option__icon {
  color: var(--color-accent80);
}

.theme-option__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.theme-option__icon svg {
  width: 1.5rem;
  height: 1.5rem;
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
