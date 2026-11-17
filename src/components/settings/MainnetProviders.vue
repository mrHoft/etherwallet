<template>
  <SettingsSection title="Mainnet providers"
    description="Requests are sent to these mainnet RPC providers in the order shown. Drag the handle to change priority, or add your own endpoint.">
    <Tabs class="provider-tabs" :model-value="activeNetwork" :tabs="networkTabs" aria-label="Network"
      @update:model-value="selectNetwork" />

    <ul v-if="providers.length" class="provider-list" @dragover.prevent @drop.prevent="handleDrop"
      @dragend="handleDragEnd">
      <li v-for="url in providers" :key="url"
        :class="['provider-row', { 'provider-row--checking': isChecking(url), 'provider-row--dragging': draggedUrl === url }]"
        @dragover.prevent="handleDragOver($event, url)">
        <span class="provider-drag" draggable="true" role="button" tabindex="0" aria-label="Reorder provider"
          title="Drag to reorder, or use the arrow keys" @dragstart="handleDragStart($event, url)"
          @keydown.up.prevent="handleMoveProvider(url, -1)" @keydown.down.prevent="handleMoveProvider(url, 1)">⠿</span>
        <span :class="['provider-url', healthClass(url)]">{{ url }}</span>
        <span v-if="latencyLabel(url)" :class="['provider-latency', latencyClass(url)]">{{ latencyLabel(url) }}</span>
        <ButtonSquare label="♥" aria-label="Check provider health" title="Check provider health"
          :loading="isChecking(url)" @click="handleCheckProvider(url)" />
        <ButtonSquare label="-" aria-label="Remove provider" title="Remove provider"
          @click="handleRemoveProvider(url)" />
      </li>
    </ul>

    <p v-else class="provider-empty">No providers configured. Add one below to enable network requests.</p>

    <form class="provider-form" novalidate @submit.prevent="handleAddProvider">
      <input v-model="newProviderUrl" type="url" class="provider-input" placeholder="https://..."
        aria-label="New RPC provider URL" />
      <ButtonSquare label="+" aria-label="Add provider" title="Add provider" type="submit" />
    </form>

    <div class="provider-actions">
      <button type="button" class="provider-restore" title="Reset providers to the defaults"
        @click="handleRestoreDefaults">Restore default</button>
    </div>

    <p class="provider-hint">
      Use
      <a :href="providerHintUrl" target="_blank" rel="noopener noreferrer">chainlist.org</a>
      , for example, to search for new providers.
    </p>
    <p v-if="providerError" class="provider-message provider-message--error">{{ providerError }}</p>
    <p v-else-if="providerMessage" class="provider-message">{{ providerMessage }}</p>
  </SettingsSection>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { rpcProvider as ethereumProvider } from '~/api/ethereum/provider'
import {
  addRpcUrl as addEthereumRpcUrl,
  getRpcUrls as getEthereumRpcUrls,
  removeRpcUrl as removeEthereumRpcUrl,
  resetRpcUrls as resetEthereumRpcUrls,
  setRpcUrlOrder as setEthereumRpcUrlOrder,
} from '~/api/ethereum/rpcUrls'
import { rpcProvider as tronProvider } from '~/api/tron/provider'
import {
  addRpcUrl as addTronRpcUrl,
  getRpcUrls as getTronRpcUrls,
  removeRpcUrl as removeTronRpcUrl,
  resetRpcUrls as resetTronRpcUrls,
  setRpcUrlOrder as setTronRpcUrlOrder,
} from '~/api/tron/rpcUrls'
import ButtonSquare from '~/components/ui/ButtonSquare.vue'
import Tabs from '~/components/ui/Tabs.vue'
import SettingsSection from '~/components/settings/SettingsSection.vue'

type HealthStatus = 'idle' | 'checking' | 'healthy' | 'unhealthy'
type NetworkId = 'ethereum' | 'tron'

interface RpcUrlActions {
  getRpcUrls: () => string[]
  addRpcUrl: (url: string) => string
  removeRpcUrl: (url: string) => void
  resetRpcUrls: () => void
  setRpcUrlOrder: (urls: string[]) => void
}

interface ProviderActions {
  checkProviderHealthy: (url: string) => Promise<{ healthy: boolean; latencyMs: number }>
  resetProvider: () => void
}

interface NetworkConfig {
  label: string
  chainId: number
  rpcUrls: RpcUrlActions
  provider: ProviderActions
}

const networkIds: NetworkId[] = ['ethereum', 'tron']

const networkMap: Record<NetworkId, NetworkConfig> = {
  ethereum: {
    label: 'Ethereum',
    chainId: 1,
    rpcUrls: {
      getRpcUrls: getEthereumRpcUrls,
      addRpcUrl: addEthereumRpcUrl,
      removeRpcUrl: removeEthereumRpcUrl,
      resetRpcUrls: resetEthereumRpcUrls,
      setRpcUrlOrder: setEthereumRpcUrlOrder,
    },
    provider: ethereumProvider,
  },
  tron: {
    label: 'Tron',
    chainId: 728126428,
    rpcUrls: {
      getRpcUrls: getTronRpcUrls,
      addRpcUrl: addTronRpcUrl,
      removeRpcUrl: removeTronRpcUrl,
      resetRpcUrls: resetTronRpcUrls,
      setRpcUrlOrder: setTronRpcUrlOrder,
    },
    provider: tronProvider,
  },
}

const networkTabs: { value: NetworkId; label: string }[] = networkIds.map(networkId => ({
  value: networkId,
  label: networkMap[networkId].label,
}))

const activeNetwork = ref<NetworkId>('ethereum')
const network = computed(() => networkMap[activeNetwork.value])
const providers = ref<string[]>(network.value.rpcUrls.getRpcUrls())
const newProviderUrl = ref<string>('')
const providerMessage = ref<string>('')
const providerError = ref<string>('')
const healthStatuses = ref<Record<string, HealthStatus>>({})
const healthLatencies = ref<Record<string, number>>({})
const draggedUrl = ref<string | null>(null)
const dragStartOrder = ref<string[]>([])
const didDrop = ref<boolean>(false)

let checkSequence = 0
const checkTokens = new Map<string, number>()

const providerHintUrl = computed(() => `https://chainlist.org/chain/${network.value.chainId}`)

const getHealthStatus = (url: string): HealthStatus => healthStatuses.value[url] ?? 'idle'

const isChecking = (url: string): boolean => getHealthStatus(url) === 'checking'

const healthClass = (url: string): string => {
  const status = getHealthStatus(url)

  if (status === 'healthy') return 'provider-url--healthy'
  if (status === 'unhealthy') return 'provider-url--unhealthy'

  return ''
}

const latencyLabel = (url: string): string => {
  const status = getHealthStatus(url)
  if (status !== 'healthy' && status !== 'unhealthy') return ''

  const latency = healthLatencies.value[url]
  if (typeof latency !== 'number') return ''

  return status === 'healthy' ? `${latency} ms` : `failed (${latency} ms)`
}

const latencyClass = (url: string): string => {
  const status = getHealthStatus(url)

  if (status === 'healthy') return 'provider-latency--healthy'
  if (status === 'unhealthy') return 'provider-latency--unhealthy'

  return ''
}

const resetNetworkState = (): void => {
  providers.value = network.value.rpcUrls.getRpcUrls()
  newProviderUrl.value = ''
  providerMessage.value = ''
  providerError.value = ''
  healthStatuses.value = {}
  healthLatencies.value = {}
  draggedUrl.value = null
  dragStartOrder.value = []
  didDrop.value = false
  checkTokens.clear()
}

const selectNetwork = (networkId: NetworkId): void => {
  if (activeNetwork.value === networkId) return

  activeNetwork.value = networkId
  resetNetworkState()
}

const handleDragStart = (event: DragEvent, url: string): void => {
  draggedUrl.value = url
  dragStartOrder.value = [...providers.value]
  didDrop.value = false

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', url)

    const row = (event.currentTarget as HTMLElement | null)?.closest<HTMLElement>('.provider-row')
    if (row) event.dataTransfer.setDragImage(row, 16, row.offsetHeight / 2)
  }
}

const handleDragOver = (event: DragEvent, hoveredUrl: string): void => {
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'

  const dragged = draggedUrl.value
  if (!dragged || dragged === hoveredUrl) return

  const reordered = [...providers.value]
  const draggedIndex = reordered.indexOf(dragged)
  if (draggedIndex === -1) return

  reordered.splice(draggedIndex, 1)

  const hoveredIndex = reordered.indexOf(hoveredUrl)
  if (hoveredIndex === -1) return

  reordered.splice(hoveredIndex + 1, 0, dragged)

  if (reordered.every((url, index) => url === providers.value[index])) return

  providers.value = reordered
}

const handleDrop = (): void => {
  if (!draggedUrl.value) return

  didDrop.value = true

  const orderChanged = providers.value.some((url, index) => url !== dragStartOrder.value[index])
  if (!orderChanged) return

  network.value.rpcUrls.setRpcUrlOrder(providers.value)
  providerError.value = ''
  providerMessage.value = 'Provider order updated.'
}

const handleDragEnd = (): void => {
  if (!didDrop.value && dragStartOrder.value.length > 0) {
    providers.value = [...dragStartOrder.value]
  }

  draggedUrl.value = null
  dragStartOrder.value = []
  didDrop.value = false
}

const handleMoveProvider = (url: string, direction: -1 | 1): void => {
  const index = providers.value.indexOf(url)
  if (index === -1) return

  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= providers.value.length) return

  const reordered = [...providers.value]
  reordered.splice(index, 1)
  reordered.splice(targetIndex, 0, url)
  providers.value = reordered

  network.value.rpcUrls.setRpcUrlOrder(reordered)
  providerError.value = ''
  providerMessage.value = 'Provider order updated.'
}

const handleAddProvider = (): void => {
  providerMessage.value = ''
  providerError.value = ''

  try {
    const addedUrl = network.value.rpcUrls.addRpcUrl(newProviderUrl.value)
    providers.value = network.value.rpcUrls.getRpcUrls()
    healthStatuses.value = { ...healthStatuses.value, [addedUrl]: 'idle' }

    const latencies = { ...healthLatencies.value }
    delete latencies[addedUrl]
    healthLatencies.value = latencies

    newProviderUrl.value = ''
    providerMessage.value = 'Provider added.'
    network.value.provider.resetProvider()
  } catch (error) {
    providerError.value = error instanceof Error ? error.message : 'Failed to add provider'
  }
}

const handleRemoveProvider = (url: string): void => {
  network.value.rpcUrls.removeRpcUrl(url)
  providers.value = network.value.rpcUrls.getRpcUrls()

  const statuses = { ...healthStatuses.value }
  delete statuses[url]
  healthStatuses.value = statuses

  const latencies = { ...healthLatencies.value }
  delete latencies[url]
  healthLatencies.value = latencies

  checkTokens.delete(url)
  providerError.value = ''
  providerMessage.value = 'Provider removed.'
  network.value.provider.resetProvider()
}

const handleRestoreDefaults = (): void => {
  network.value.rpcUrls.resetRpcUrls()
  providers.value = network.value.rpcUrls.getRpcUrls()
  healthStatuses.value = {}
  healthLatencies.value = {}
  checkTokens.clear()
  providerError.value = ''
  providerMessage.value = 'Default providers restored.'
  network.value.provider.resetProvider()
}

const handleCheckProvider = async (url: string): Promise<void> => {
  if (isChecking(url)) return

  const networkId = activeNetwork.value
  const providerActions = network.value.provider
  const token = ++checkSequence
  checkTokens.set(url, token)
  healthStatuses.value = { ...healthStatuses.value, [url]: 'checking' }

  const { healthy, latencyMs } = await providerActions.checkProviderHealthy(url)

  if (activeNetwork.value !== networkId) return
  if (checkTokens.get(url) !== token || !providers.value.includes(url)) return

  healthStatuses.value = {
    ...healthStatuses.value,
    [url]: healthy ? 'healthy' : 'unhealthy'
  }
  healthLatencies.value = { ...healthLatencies.value, [url]: latencyMs }
}
</script>

<style scoped>
.provider-tabs {
  margin-bottom: 0.75rem;
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

.provider-drag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 1.25rem;
  height: 2.25rem;
  color: var(--color60);
  font-family: var(--mono);
  font-size: 1rem;
  line-height: 1;
  cursor: grab;
  user-select: none;
  transition: color 0.2s ease;
}

.provider-drag:hover {
  color: var(--color90);
}

.provider-drag:focus-visible {
  outline: var(--border-thickness) solid var(--color-accent60);
  outline-offset: 2px;
  border-radius: 0.25rem;
}

.provider-row--dragging {
  opacity: 0.4;
}

.provider-row--dragging .provider-drag {
  cursor: grabbing;
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

.provider-latency {
  flex: 0 0 auto;
  min-width: 3rem;
  color: var(--color60);
  font-family: var(--mono);
  font-size: 0.75rem;
  text-align: right;
  white-space: nowrap;
}

.provider-latency--healthy {
  color: var(--color-up);
}

.provider-latency--unhealthy {
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
  margin-left: 1.75rem;
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

.provider-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.provider-restore {
  background: transparent;
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.5rem;
  color: var(--color70);
  padding: 0.5rem 1rem;
  font-family: var(--sans);
  font-size: 0.85rem;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.provider-restore:hover {
  background: var(--color30);
  border-color: var(--color60);
  color: var(--color90);
}

.provider-restore:focus-visible {
  outline: var(--border-thickness) solid var(--color-accent60);
  outline-offset: 2px;
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

.provider-hint {
  margin: 0.5rem 0 0;
  color: var(--color70);
  font-family: var(--sans);
  font-size: 0.8rem;
  line-height: 1.5;
}
</style>
