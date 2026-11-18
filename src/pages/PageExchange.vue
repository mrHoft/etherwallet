<template>
  <div class="exchange-container">
    <form class="exchange-form" @submit.prevent="handleSubmit">
      <h1 class="page-title">Exchange</h1>

      <div class="form-group">
        <label class="form-label" for="from-wallet">From Wallet</label>
        <select id="from-wallet" v-model="selectedWallet" class="form-select" :disabled="isSubmitting" required>
          <option value="" disabled>Select a wallet</option>
          <option v-for="[key] in walletEntries" :key="key" :value="key">
            {{ key }}
          </option>
        </select>
        <p v-if="walletEntries.length === 0" class="field-hint">
          No wallets found. Create a wallet before exchanging tokens.
        </p>
      </div>

      <div class="swap-panel">
        <div class="swap-block">
          <div class="swap-block__header">
            <label class="form-label" for="from-amount">{{ fromLabel }}</label>
            <span class="balance">
              Balance:
              <span v-if="fromBalance">{{ fromBalance.text }}</span>
              <span v-else-if="balanceLoading">...</span>
              <span v-else>0</span>
              <button v-if="canUseMax" type="button" class="max-button" :disabled="isSubmitting" @click="applyMax">
                MAX
              </button>
            </span>
          </div>
          <div class="swap-block__row">
            <input id="from-amount" :value="amount" type="text" inputmode="decimal" class="form-input"
              placeholder="0.0000" :disabled="isSubmitting" required @input="handleFromInput" />
            <select id="from-token" v-model="fromToken" class="form-select token-select" :disabled="isSubmitting"
              aria-label="From token">
              <option v-for="option in tokenOptions" :key="option.symbol" :value="option.symbol">
                {{ option.symbol }}
              </option>
            </select>
          </div>
          <p v-if="amountError" class="field-error">{{ amountError }}</p>
        </div>

        <button type="button" class="swap-direction" :disabled="isSubmitting" aria-label="Swap from and to tokens"
          @click="reverseTokens">
          ⇅
        </button>

        <div class="swap-block">
          <div class="swap-block__header">
            <label class="form-label" for="to-amount">{{ toLabel }}</label>
            <span class="balance">
              Balance:
              <span v-if="toBalance">{{ toBalance.text }}</span>
              <span v-else-if="balanceLoading">...</span>
              <span v-else>0</span>
            </span>
          </div>
          <div class="swap-block__row">
            <input id="to-amount" :value="toAmount" type="text" inputmode="decimal" class="form-input"
              placeholder="0.0000" :disabled="isSubmitting" required @input="handleToInput" />
            <select id="to-token" v-model="toToken" class="form-select token-select" :disabled="isSubmitting"
              aria-label="To token">
              <option v-for="option in tokenOptions" :key="option.symbol" :value="option.symbol">
                {{ option.symbol }}
              </option>
            </select>
          </div>
          <p v-if="toAmountError" class="field-error">{{ toAmountError }}</p>
        </div>
      </div>

      <div class="quote-details">
        <div class="quote-row">
          <span>Rate</span>
          <span class="quote-value">{{ exchangeRate || '—' }}</span>
        </div>
        <div class="quote-row">
          <span>Minimum received</span>
          <span class="quote-value">{{ minimumReceived || '—' }}</span>
        </div>
        <div v-if="quote?.mode === 'exactOut'" class="quote-row">
          <span>Maximum sold</span>
          <span class="quote-value">{{ maximumSold || '—' }}</span>
        </div>
        <div class="quote-row">
          <span>Route</span>
          <span class="quote-value">{{ routeLabel || '—' }}</span>
        </div>
        <div class="quote-row">
          <label for="slippage">Slippage tolerance</label>
          <span class="slippage-control">
            <input id="slippage" v-model="slippagePercent" type="text" inputmode="decimal" class="slippage-input"
              :disabled="isSubmitting" aria-label="Slippage tolerance percent" />
            %
          </span>
        </div>
        <div class="quote-row">
          <span>Gas price</span>
          <span class="quote-value">{{ formattedGasPrice }}</span>
        </div>

        <p v-if="quoteLoading" class="quote-status">Fetching the best route...</p>
        <p v-else-if="quoteError" class="quote-error">{{ quoteError }}</p>
        <p v-else-if="slippageError" class="quote-error">{{ slippageError }}</p>
        <p v-else-if="isSameToken" class="quote-error">Select two different tokens.</p>
        <p v-else-if="insufficientBalance" class="quote-error">Insufficient {{ fromToken }} balance.</p>
      </div>

      <div class="form-group">
        <label class="form-label" for="password">Password</label>
        <Password id="password" ref="passwordRef" v-model="password" />
      </div>

      <button type="submit" class="submit-button" :disabled="!isFormValid || isSubmitting">
        {{ submitLabel }}
      </button>

      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>

      <div v-if="successMessage" class="success-message">
        {{ successMessage }}
        <a v-if="successTxHash" :href="`https://etherscan.io/tx/${successTxHash}`" target="_blank"
          rel="noopener noreferrer">View transaction</a>
        <span v-if="successApprovalTxHash">
          ·
          <a :href="`https://etherscan.io/tx/${successApprovalTxHash}`" target="_blank"
            rel="noopener noreferrer">Approval transaction</a>
        </span>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ethers } from 'ethers'
import { getWallets } from '~/utils/wallets'
import { TOKEN_INFO } from '~/api/ethereum/config'
import Password from '~/components/ui/Password.vue'
import { formatGasPriceLabel } from '~/utils/gasPrice'
import { ethState } from '~/api/ethereum/ethState'
import { decryptWallet } from '~/api/ethereum/create'
import { getTokenBalances } from '~/api/ethereum/multicall3'
import {
  DEFAULT_SLIPPAGE_BPS,
  MAX_SLIPPAGE_BPS,
  describeSwapError,
  executeSwap,
  getSwapQuote,
  type SwapMode,
  type SwapQuote,
  type SwapStage
} from '~/api/ethereum/exchange'
import { getFormValues, saveFormValues } from '~/utils/formValues'

const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'
const QUOTE_DEBOUNCE_MS = 400
const ETH_GAS_RESERVE_UNITS = 400_000n
const FORM_NETWORK = 'ethereum'
const FORM_NAME = 'exchange'

const wallets = getWallets()
const walletEntries = Object.entries(wallets)
const tokenOptions = Object.entries(TOKEN_INFO)
  .filter(([, info]) => !info.interestBearing)
  .map(([symbol, info]) => ({
    symbol,
    name: info.name
  }))
const tokenSymbols = new Set(tokenOptions.map(option => option.symbol))

const savedFormValues = getFormValues(FORM_NETWORK, FORM_NAME)
const savedWallet = savedFormValues.walletFrom ?? ''
const savedFromToken = savedFormValues.tokenFrom ?? ''
const savedToToken = savedFormValues.tokenTo ?? ''

const password = ref<string>('')
const passwordRef = ref()
const selectedWallet = ref<string>(
  Object.prototype.hasOwnProperty.call(wallets, savedWallet) ? savedWallet : ''
)
const fromToken = ref<string>(tokenSymbols.has(savedFromToken) ? savedFromToken : 'ETH')
const toToken = ref<string>(tokenSymbols.has(savedToToken) ? savedToToken : 'USDC')
const amount = ref<string>('')
const toAmount = ref<string>('')
const quoteMode = ref<SwapMode>('exactIn')
const slippagePercent = ref<string>((DEFAULT_SLIPPAGE_BPS / 100).toString())
const quote = ref<SwapQuote | null>(null)
const quoteLoading = ref<boolean>(false)
const quoteError = ref<string>('')
const isSubmitting = ref<boolean>(false)
const stage = ref<SwapStage | ''>('')
const errorMessage = ref<string>('')
const successMessage = ref<string>('')
const successTxHash = ref<string>('')
const successApprovalTxHash = ref<string>('')
const gasPrice = ref<bigint>(0n)
const ethUsd = ref<number | null>(null)
const balances = ref<Record<string, { raw: string; formatted: string }>>({})
const balanceLoading = ref<boolean>(false)

const fromInfo = computed(() => TOKEN_INFO[fromToken.value])
const toInfo = computed(() => TOKEN_INFO[toToken.value])

const normalizeAddress = (address: string): string => {
  if (!address) return ''
  return address.startsWith('0x') ? address : `0x${address}`
}

const getAddressFromJson = (encryptedJson: string): string => {
  try {
    const parsedData = JSON.parse(encryptedJson) as { address?: string }
    return normalizeAddress(parsedData.address || '')
  } catch {
    return ''
  }
}

const walletAddress = computed<string>(() => {
  const encryptedJson = getWallets()[selectedWallet.value]?.encryptedJson
  return encryptedJson ? getAddressFromJson(encryptedJson) : ''
})

const getRouteAddress = (symbol: string): string => {
  const info = TOKEN_INFO[symbol]
  if (!info) return ''

  if (info.contractAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS) {
    return TOKEN_INFO.WETH?.contractAddress.toLowerCase() ?? ''
  }

  return info.contractAddress.toLowerCase()
}

const isSameToken = computed<boolean>(() => getRouteAddress(fromToken.value) === getRouteAddress(toToken.value))

const getAmountError = (value: string, decimals: number): string => {
  const trimmedValue = value.trim()
  if (!trimmedValue) return ''
  if (!/^\d*\.?\d+$/.test(trimmedValue)) return 'Enter a valid amount'

  try {
    const parsedAmount = ethers.parseUnits(trimmedValue, decimals)
    if (parsedAmount <= 0n) return 'Amount must be greater than 0'
  } catch {
    return `Maximum ${decimals} decimal places`
  }

  return ''
}

const amountError = computed<string>(() => getAmountError(amount.value, fromInfo.value.decimals))
const toAmountError = computed<string>(() => getAmountError(toAmount.value, toInfo.value.decimals))
const isAmountValid = computed<boolean>(() => amount.value.trim() !== '' && amountError.value === '')
const isToAmountValid = computed<boolean>(() => toAmount.value.trim() !== '' && toAmountError.value === '')

const activeAmount = computed<string>(() =>
  quoteMode.value === 'exactIn' ? amount.value : toAmount.value
)
const isActiveAmountValid = computed<boolean>(() =>
  quoteMode.value === 'exactIn' ? isAmountValid.value : isToAmountValid.value
)

const fromLabel = computed<string>(() => (quoteMode.value === 'exactIn' ? 'From' : 'From (estimated)'))
const toLabel = computed<string>(() =>
  quoteMode.value === 'exactIn' ? 'To (estimated)' : 'To'
)

const slippageBps = computed<number>(() => {
  const value = slippagePercent.value.trim()
  if (!value) return -1

  const parsedValue = Number(value)
  if (!Number.isFinite(parsedValue)) return -1
  if (parsedValue < 0 || parsedValue > MAX_SLIPPAGE_BPS / 100) return -1

  return Math.round(parsedValue * 100)
})

const slippageError = computed<string>(() =>
  slippageBps.value < 0 ? `Slippage must be between 0% and ${MAX_SLIPPAGE_BPS / 100}%` : ''
)

const canQuote = computed<boolean>(() =>
  !isSameToken.value && isActiveAmountValid.value && slippageBps.value >= 0
)

const formatTokenAmount = (raw: string | bigint, decimals: number, maxFractionDigits = 6): string => {
  try {
    const formatted = ethers.formatUnits(raw, decimals)
    if (!formatted.includes('.')) return formatted

    const [whole, fraction] = formatted.split('.')
    const trimmedFraction = fraction.slice(0, maxFractionDigits).replace(/0+$/, '')
    return trimmedFraction ? `${whole}.${trimmedFraction}` : whole
  } catch {
    return '0'
  }
}

const formatExactAmount = (raw: bigint, decimals: number): string => {
  const formatted = ethers.formatUnits(raw, decimals)
  return formatted.includes('.') ? formatted.replace(/0+$/, '').replace(/\.$/, '') : formatted
}

const getBalance = (symbol: string): { raw: bigint; text: string } | null => {
  const storedBalance = balances.value[symbol]
  const info = TOKEN_INFO[symbol]
  if (!storedBalance || !info) return null

  try {
    const raw = BigInt(storedBalance.raw)
    return { raw, text: formatTokenAmount(raw, info.decimals, 6) }
  } catch {
    return null
  }
}

const fromBalance = computed(() => getBalance(fromToken.value))
const toBalance = computed(() => getBalance(toToken.value))
const canUseMax = computed<boolean>(() => (fromBalance.value?.raw ?? 0n) > 0n)

const requiredFromAmount = computed<bigint | null>(() => {
  if (quoteMode.value === 'exactOut') {
    return quote.value?.mode === 'exactOut' ? quote.value.amountInMax : null
  }

  if (!isAmountValid.value) return null

  try {
    return ethers.parseUnits(amount.value.trim(), fromInfo.value.decimals)
  } catch {
    return null
  }
})

const insufficientBalance = computed<boolean>(() => {
  if (!fromBalance.value || requiredFromAmount.value === null) return false
  return requiredFromAmount.value > fromBalance.value.raw
})

const minimumReceived = computed<string>(() => {
  if (!quote.value) return ''
  return `${formatTokenAmount(quote.value.amountOutMin, toInfo.value.decimals, 8)} ${toToken.value}`
})

const maximumSold = computed<string>(() => {
  if (!quote.value) return ''
  return `${formatTokenAmount(quote.value.amountInMax, fromInfo.value.decimals, 8)} ${fromToken.value}`
})

const formatRate = (value: number): string => {
  if (value >= 1000) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
  }
  if (value >= 1) {
    return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
  }
  if (value >= 0.0001) {
    return value.toPrecision(4)
  }
  return value.toExponential(2)
}

const exchangeRate = computed<string>(() => {
  if (!quote.value) return ''

  const amountIn = Number(ethers.formatUnits(quote.value.amountIn, fromInfo.value.decimals))
  const amountOut = Number(ethers.formatUnits(quote.value.amountOut, toInfo.value.decimals))

  if (!Number.isFinite(amountIn) || amountIn <= 0 || !Number.isFinite(amountOut)) return ''

  return `1 ${fromToken.value} ≈ ${formatRate(amountOut / amountIn)} ${toToken.value}`
})

const routeLabel = computed<string>(() => {
  if (!quote.value) return ''

  const symbols = [...quote.value.pathSymbols]

  if (quote.value.kind === 'ethToToken' && symbols[0]?.toUpperCase() === 'WETH') {
    symbols[0] = 'ETH'
  }
  if (quote.value.kind === 'tokenToEth' && symbols[symbols.length - 1]?.toUpperCase() === 'WETH') {
    symbols[symbols.length - 1] = 'ETH'
  }

  return symbols.join(' → ')
})

const formattedGasPrice = computed<string>(() =>
  formatGasPriceLabel(gasPrice.value, ethUsd.value)
)

const isFormValid = computed<boolean>(() =>
  password.value.length >= 3 &&
  selectedWallet.value !== '' &&
  !isSameToken.value &&
  isActiveAmountValid.value &&
  !insufficientBalance.value &&
  slippageBps.value >= 0 &&
  quote.value !== null &&
  !quoteLoading.value &&
  !quoteError.value
)

const submitLabel = computed<string>(() => {
  if (!isSubmitting.value) return 'Exchange'

  switch (stage.value) {
    case 'approving':
      return 'Approving token...'
    case 'waitingApproval':
      return 'Waiting for approval...'
    case 'swapping':
      return 'Swapping...'
    case 'waitingConfirmation':
      return 'Waiting for confirmation...'
    default:
      return 'Processing...'
  }
})

let quoteTimer: ReturnType<typeof setTimeout> | null = null
let quoteSequence = 0
let balanceSequence = 0

const clearQuote = (): void => {
  quote.value = null
  quoteError.value = ''
  quoteLoading.value = false
}

const loadQuote = async (): Promise<void> => {
  const sequence = ++quoteSequence

  if (!canQuote.value) {
    clearQuote()
    return
  }

  quoteLoading.value = true
  quoteError.value = ''

  try {
    const nextQuote = await getSwapQuote(
      fromToken.value,
      toToken.value,
      activeAmount.value.trim(),
      slippageBps.value,
      quoteMode.value
    )

    if (sequence !== quoteSequence) return
    quote.value = nextQuote

    if (nextQuote.mode === 'exactIn') {
      toAmount.value = formatTokenAmount(nextQuote.amountOut, toInfo.value.decimals, 12)
    } else {
      amount.value = formatTokenAmount(nextQuote.amountIn, fromInfo.value.decimals, 12)
    }
  } catch (error) {
    if (sequence !== quoteSequence) return
    quote.value = null
    quoteError.value = describeSwapError(error)
  } finally {
    if (sequence === quoteSequence) {
      quoteLoading.value = false
    }
  }
}

const loadBalances = async (): Promise<void> => {
  const sequence = ++balanceSequence
  const address = walletAddress.value

  if (!address) {
    balances.value = {}
    balanceLoading.value = false
    return
  }

  const symbols = [...new Set([fromToken.value, toToken.value])] as Array<keyof typeof TOKEN_INFO>
  balanceLoading.value = true

  try {
    const result = await getTokenBalances(address, symbols)
    if (sequence !== balanceSequence) return

    const nextBalances: Record<string, { raw: string; formatted: string }> = {}
    for (const symbol of symbols) {
      const tokenBalance = result[symbol as string]
      if (tokenBalance) {
        nextBalances[symbol] = {
          raw: tokenBalance.raw,
          formatted: tokenBalance.formatted
        }
      }
    }

    balances.value = nextBalances
  } catch (error) {
    if (sequence === balanceSequence) {
      console.error('Failed to load exchange balances:', error)
    }
  } finally {
    if (sequence === balanceSequence) {
      balanceLoading.value = false
    }
  }
}

const applyMax = async (): Promise<void> => {
  const balance = fromBalance.value
  if (!balance) return

  quoteMode.value = 'exactIn'

  if (fromToken.value !== 'ETH') {
    amount.value = formatExactAmount(balance.raw, fromInfo.value.decimals)
    return
  }

  let gasReserve: bigint
  try {
    const currentGasPrice = gasPrice.value > 0n ? gasPrice.value : await ethState.getGasPrice()
    gasReserve = currentGasPrice * ETH_GAS_RESERVE_UNITS
  } catch {
    gasReserve = ethers.parseEther('0.01')
  }

  const maxAmount = balance.raw > gasReserve ? balance.raw - gasReserve : 0n
  amount.value = formatExactAmount(maxAmount, fromInfo.value.decimals)
}

const decryptWalletData = async (encryptedJson: string): Promise<string | null> => {
  try {
    const recovered = await decryptWallet(encryptedJson, password.value)
    const storedAddress = getAddressFromJson(encryptedJson)

    if (recovered.address.toLowerCase() === storedAddress.toLowerCase()) {
      return recovered.privateKey
    }

    errorMessage.value = 'Invalid password'
    return null
  } catch {
    errorMessage.value = 'Invalid password or failed to decrypt wallet'
    return null
  }
}

const handleFromInput = (event: Event): void => {
  amount.value = (event.target as HTMLInputElement).value
  quoteMode.value = 'exactIn'
}

const handleToInput = (event: Event): void => {
  toAmount.value = (event.target as HTMLInputElement).value
  quoteMode.value = 'exactOut'
}

const handleSubmit = async (): Promise<void> => {
  errorMessage.value = ''
  successMessage.value = ''
  successTxHash.value = ''
  successApprovalTxHash.value = ''

  if (!isFormValid.value) return

  const activeQuote = quote.value
  if (!activeQuote) return

  const encryptedJson = getWallets()[selectedWallet.value]?.encryptedJson
  if (!encryptedJson) {
    errorMessage.value = 'Wallet not found'
    return
  }

  isSubmitting.value = true
  stage.value = ''

  try {
    const privateKey = await decryptWalletData(encryptedJson)
    if (!privateKey) {
      passwordRef.value?.clear()
      return
    }

    const swapAmount = activeQuote.mode === 'exactIn' ? amount.value.trim() : toAmount.value.trim()

    const result = await executeSwap(
      privateKey,
      fromToken.value,
      toToken.value,
      swapAmount,
      {
        mode: activeQuote.mode,
        slippageBps: slippageBps.value,
        onStage: nextStage => {
          stage.value = nextStage
        }
      }
    )

    successMessage.value = 'Exchange complete!'
    successTxHash.value = result.txHash
    successApprovalTxHash.value = result.approvalTxHash ?? ''

    passwordRef.value?.clear()
    amount.value = ''
    toAmount.value = ''
    quote.value = null
    quoteMode.value = 'exactIn'
    await loadBalances()
  } catch (error) {
    errorMessage.value = describeSwapError(error)
  } finally {
    isSubmitting.value = false
    stage.value = ''
  }
}

const reverseTokens = (): void => {
  const previousFromToken = fromToken.value
  fromToken.value = toToken.value
  toToken.value = previousFromToken
}

const loadGasPrice = async (): Promise<void> => {
  try {
    gasPrice.value = await ethState.getGasPrice()
  } catch {
    gasPrice.value = -1n
  }
}

const loadEthUsd = async (): Promise<void> => {
  try {
    ethUsd.value = await ethState.getUsdValue()
  } catch {
    ethUsd.value = null
  }
}

watch([fromToken, toToken, activeAmount, slippagePercent, quoteMode], () => {
  quoteSequence += 1
  clearQuote()

  if (quoteMode.value === 'exactIn') {
    toAmount.value = ''
  } else {
    amount.value = ''
  }

  if (quoteTimer) {
    clearTimeout(quoteTimer)
    quoteTimer = null
  }

  if (!canQuote.value) return

  quoteTimer = setTimeout(() => {
    quoteTimer = null
    void loadQuote()
  }, QUOTE_DEBOUNCE_MS)
}, { immediate: true })

watch([selectedWallet, fromToken, toToken], () => {
  saveFormValues(FORM_NETWORK, FORM_NAME, {
    walletFrom: selectedWallet.value,
    tokenFrom: fromToken.value,
    tokenTo: toToken.value
  })
  void loadBalances()
}, { immediate: true })

onMounted(() => {
  void loadGasPrice()
  void loadEthUsd()
})

onUnmounted(() => {
  quoteSequence += 1
  balanceSequence += 1
  if (quoteTimer) {
    clearTimeout(quoteTimer)
    quoteTimer = null
  }
})
</script>

<style scoped>
.exchange-container {
  max-width: 32rem;
  margin: 0 auto;
  padding: 1.5rem;
}

.exchange-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.page-title {
  font-family: var(--heading);
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color90);
  margin: 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-family: var(--heading);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color90);
}

.form-input,
.form-select {
  font-family: var(--sans);
  padding: 0.625rem 0.75rem;
  background-color: var(--color10);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.375rem;
  color: var(--color90);
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--color-accent60);
  background-color: var(--color20);
}

.form-input:disabled,
.form-select:disabled,
.slippage-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.field-hint {
  color: var(--color70);
  font-family: var(--sans);
  font-size: 0.8rem;
  margin: 0;
}

.field-error {
  color: var(--color-down);
  font-family: var(--sans);
  font-size: 0.8rem;
  margin: 0;
}

.swap-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.swap-block {
  padding: 0.75rem;
  background-color: var(--color20);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.5rem;
}

.swap-block__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.swap-block__row {
  display: flex;
  align-items: stretch;
  gap: 0.5rem;
}

.swap-block__row .form-input {
  flex: 1;
  min-width: 0;
}

.token-select {
  width: 7.5rem;
  flex-shrink: 0;
}

.balance {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--color70);
  font-family: var(--mono);
  font-size: 0.75rem;
}

.max-button {
  padding: 0.15rem 0.4rem;
  background-color: var(--color-accent60);
  color: white;
  border: none;
  border-radius: 0.25rem;
  font-family: var(--heading);
  font-size: 0.65rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.max-button:hover:not(:disabled) {
  background-color: var(--color-accent80);
}

.max-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.swap-direction {
  align-self: center;
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color30);
  color: var(--color90);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 50%;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.swap-direction:hover:not(:disabled) {
  border-color: var(--color-accent60);
  background-color: var(--color40);
}

.swap-direction:disabled {
  opacity: 0.5;
  cursor: default;
}

.quote-details {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.75rem;
  background-color: var(--color10);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.5rem;
  font-family: var(--sans);
  font-size: 0.8rem;
}

.quote-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: var(--color70);
}

.quote-value {
  color: var(--color90);
  font-family: var(--mono);
  text-align: right;
  word-break: break-word;
}

.slippage-control {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--color90);
  font-family: var(--mono);
}

.slippage-input {
  width: 4rem;
  padding: 0.2rem 0.35rem;
  background-color: var(--color20);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.25rem;
  color: var(--color90);
  font-family: var(--mono);
  font-size: 0.8rem;
  text-align: right;
}

.slippage-input:focus {
  outline: none;
  border-color: var(--color-accent60);
}

.quote-status {
  color: var(--color70);
  font-family: var(--mono);
  font-size: 0.75rem;
  margin: 0.25rem 0 0;
}

.quote-error {
  color: var(--color-down);
  font-family: var(--sans);
  font-size: 0.8rem;
  margin: 0.25rem 0 0;
}

.submit-button {
  padding: 0.5rem 1rem;
  background-color: var(--color-accent60);
  color: var(--color90);
  font-family: var(--heading);
  font-weight: 600;
  font-size: 0.875rem;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  margin-top: 0.5rem;
}

.submit-button:hover:not(:disabled) {
  background-color: var(--color-accent80);
}

.submit-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.error-message {
  padding: 0.75rem;
  background-color: rgba(220, 38, 38, 0.1);
  border: var(--border-thickness) solid rgba(220, 38, 38, 0.3);
  border-radius: 0.375rem;
  color: var(--color-down);
  font-size: 0.875rem;
  font-family: var(--sans);
}

.success-message {
  padding: 0.75rem;
  background-color: rgba(34, 197, 94, 0.1);
  border: var(--border-thickness) solid rgba(34, 197, 94, 0.3);
  border-radius: 0.375rem;
  color: var(--color-up);
  font-size: 0.875rem;
  font-family: var(--sans);
  word-break: break-all;
}

.success-message a {
  color: var(--link-color);
  margin-left: 0.35rem;
}

.success-message a:hover {
  color: var(--link-color-hover);
}

@media (max-width: 480px) {
  .exchange-container {
    padding: 1rem;
  }

  .swap-block__row {
    flex-wrap: wrap;
  }

  .token-select {
    width: 100%;
  }
}
</style>
