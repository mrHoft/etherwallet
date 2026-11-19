<template>
  <section class="aethusdc-section">
    <div class="section-header">
      <div class="token-heading">
        <IconToken :symbol="RECEIPT_SYMBOL" />
        <div>
          <h2 class="section-title">{{ receiptInfo.name }}</h2>
          <span>APY/APR: {{ APY }}</span>
        </div>
      </div>
      <div class="token-balance">
        <span v-if="aethusdcBalance" class="balance-value">{{ aethusdcBalance.text }}</span>
        <span v-else-if="balanceLoading" class="balance-value">...</span>
        <span v-else class="balance-value">0</span>
        <span class="balance-unit">{{ RECEIPT_SYMBOL }}</span>
      </div>
    </div>

    <form class="aethusdc-form" @submit.prevent="handleSubmit">
      <div class="form-group">
        <label class="form-label" for="aethusdc-wallet">Wallet</label>
        <select id="aethusdc-wallet" v-model="selectedWallet" class="form-select" :disabled="isSubmitting" required>
          <option value="" disabled>Select a wallet</option>
          <option v-for="[key] in walletEntries" :key="key" :value="key">
            {{ key }}
          </option>
        </select>
        <p v-if="walletEntries.length === 0" class="field-hint">
          No wallets found. Create a wallet before using Aave.
        </p>
      </div>

      <Tabs :model-value="activeTab" :tabs="tabOptions" :disabled="isSubmitting" @update:model-value="switchTab" />

      <div v-if="activeTab === 'deposit'" class="tab-panel">
        <div class="form-group">
          <div class="amount-header">
            <label class="form-label" for="aethusdc-deposit-amount">Amount ({{ underlyingSymbol }})</label>
            <span class="amount-balance">
              Balance:
              <span v-if="underlyingBalance">{{ underlyingBalance.text }}</span>
              <span v-else-if="balanceLoading">...</span>
              <span v-else>0</span>
              <button v-if="underlyingBalance" type="button" class="max-button" :disabled="isSubmitting"
                @click="applyDepositMax">
                MAX
              </button>
            </span>
          </div>
          <input id="aethusdc-deposit-amount" v-model="depositAmount" type="text" inputmode="decimal" class="form-input"
            placeholder="0.0000" :disabled="isSubmitting" required />
        </div>

        <p v-if="amountError" class="field-error">{{ amountError }}</p>
        <p v-else-if="insufficientBalance" class="field-error">
          Insufficient {{ underlyingSymbol }} balance.
        </p>

        <div class="estimate">
          <div class="quote-row">
            <span>Estimated {{ RECEIPT_SYMBOL }} received</span>
            <span class="quote-value">{{ estimatedReceipt || '—' }}</span>
          </div>
        </div>
      </div>

      <div v-else class="tab-panel">
        <div class="form-group">
          <div class="amount-header">
            <label class="form-label" for="aethusdc-withdraw-amount">Amount ({{ RECEIPT_SYMBOL }})</label>
            <span class="amount-balance">
              Balance:
              <span v-if="aethusdcBalance">{{ aethusdcBalance.text }}</span>
              <span v-else-if="balanceLoading">...</span>
              <span v-else>0</span>
              <button v-if="aethusdcBalance" type="button" class="max-button" :disabled="isSubmitting"
                @click="applyWithdrawMax">
                MAX
              </button>
            </span>
          </div>
          <input id="aethusdc-withdraw-amount" :value="withdrawAmount" type="text" inputmode="decimal" class="form-input"
            placeholder="0.0000" :disabled="isSubmitting" required @input="handleWithdrawInput" />
        </div>

        <p v-if="amountError" class="field-error">{{ amountError }}</p>
        <p v-else-if="insufficientBalance" class="field-error">
          Insufficient {{ RECEIPT_SYMBOL }} balance.
        </p>
      </div>

      <div class="form-group">
        <label class="form-label" for="aethusdc-password">Password</label>
        <Password id="aethusdc-password" ref="passwordRef" v-model="password" />
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
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatUnits, parseUnits } from 'ethers'
import IconToken from '~/components/ui/IconToken.vue'
import Password from '~/components/ui/Password.vue'
import Tabs from '~/components/ui/Tabs.vue'
import { TOKEN_INFO } from '~/api/ethereum/config'
import { getTokenBalances } from '~/api/ethereum/multicall3'
import { decryptWallet } from '~/api/ethereum/create'
import { getWallets } from '~/utils/wallets'
import { deposit, withdraw, type AaveStage } from '~/api/ethereum/aEthUSDC'

type Tab = 'deposit' | 'withdraw'

const tabOptions: { value: Tab; label: string }[] = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdraw', label: 'Withdraw' },
]

interface BalanceView {
  raw: bigint
  text: string
}

const RECEIPT_SYMBOL = 'aEthUSDC'
const APY = '~4.1%'
const receiptInfo = TOKEN_INFO[RECEIPT_SYMBOL]
const underlyingSymbol = receiptInfo.interestBearing?.underlying ?? 'USDC'
const underlyingInfo = TOKEN_INFO[underlyingSymbol]

const wallets = getWallets()
const walletEntries = Object.entries(wallets).filter(([, wallet]) => wallet.network !== 'tron')

const selectedWallet = ref<string>('')
const password = ref<string>('')
const passwordRef = ref()
const activeTab = ref<Tab>('deposit')
const depositAmount = ref<string>('')
const withdrawAmount = ref<string>('')
const withdrawAll = ref<boolean>(false)
const isSubmitting = ref<boolean>(false)
const stage = ref<AaveStage | ''>('')
const errorMessage = ref<string>('')
const successMessage = ref<string>('')
const successTxHash = ref<string>('')
const successApprovalTxHash = ref<string>('')
const balances = ref<Record<string, { raw: string; formatted: string }>>({})
const balanceLoading = ref<boolean>(false)

let balanceSequence = 0

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

const formatTokenAmount = (raw: string | bigint, decimals: number, maxFractionDigits = 6): string => {
  try {
    const formatted = formatUnits(raw, decimals)
    if (!formatted.includes('.')) return formatted

    const [whole, fraction] = formatted.split('.')
    const trimmedFraction = fraction.slice(0, maxFractionDigits).replace(/0+$/, '')
    return trimmedFraction ? `${whole}.${trimmedFraction}` : whole
  } catch {
    return '0'
  }
}

const formatExactAmount = (raw: bigint, decimals: number): string => {
  const formatted = formatUnits(raw, decimals)
  return formatted.includes('.') ? formatted.replace(/0+$/, '').replace(/\.$/, '') : formatted
}

const getBalance = (symbol: string): BalanceView | null => {
  const storedBalance = balances.value[symbol]
  const info = TOKEN_INFO[symbol]

  if (!storedBalance || !info) return null

  try {
    const raw = BigInt(storedBalance.raw)
    return {
      raw,
      text: formatTokenAmount(raw, info.decimals, 6),
    }
  } catch {
    return null
  }
}

const aethusdcBalance = computed(() => getBalance(RECEIPT_SYMBOL))
const underlyingBalance = computed(() => getBalance(underlyingSymbol))

const loadBalances = async (): Promise<void> => {
  const sequence = ++balanceSequence
  const address = walletAddress.value

  if (!address) {
    balances.value = {}
    balanceLoading.value = false
    return
  }

  balanceLoading.value = true

  try {
    const result = await getTokenBalances(address, [underlyingSymbol, RECEIPT_SYMBOL])
    if (sequence !== balanceSequence) return

    const nextBalances: Record<string, { raw: string; formatted: string }> = {}

    for (const symbol of [underlyingSymbol, RECEIPT_SYMBOL]) {
      const balance = result[symbol]
      if (balance) {
        nextBalances[symbol] = {
          raw: balance.raw,
          formatted: balance.formatted,
        }
      }
    }

    balances.value = nextBalances
  } catch (error) {
    if (sequence === balanceSequence) {
      console.error('Failed to load Aave balances:', error)
    }
  } finally {
    if (sequence === balanceSequence) {
      balanceLoading.value = false
    }
  }
}

const getAmountError = (value: string, decimals: number): string => {
  const trimmedValue = value.trim()
  if (!trimmedValue) return ''
  if (!/^\d*\.?\d+$/.test(trimmedValue)) return 'Enter a valid amount'

  try {
    const parsedAmount = parseUnits(trimmedValue, decimals)
    if (parsedAmount <= 0n) return 'Amount must be greater than 0'
  } catch {
    return `Maximum ${decimals} decimal places`
  }

  return ''
}

const activeAmount = computed<string>(() =>
  activeTab.value === 'deposit' ? depositAmount.value : withdrawAmount.value
)

const activeDecimals = computed<number>(() =>
  activeTab.value === 'deposit' ? underlyingInfo.decimals : receiptInfo.decimals
)

const amountError = computed<string>(() =>
  getAmountError(activeAmount.value, activeDecimals.value)
)

const isAmountValid = computed<boolean>(() =>
  activeAmount.value.trim() !== '' && amountError.value === ''
)

const requiredAmount = computed<bigint | null>(() => {
  if (!isAmountValid.value) return null

  try {
    return parseUnits(activeAmount.value.trim(), activeDecimals.value)
  } catch {
    return null
  }
})

const insufficientBalance = computed<boolean>(() => {
  if (requiredAmount.value === null) return false

  const balance = activeTab.value === 'deposit' ? underlyingBalance.value : aethusdcBalance.value
  if (!balance) return false

  return requiredAmount.value > balance.raw
})

const estimatedReceipt = computed<string>(() => {
  if (activeTab.value !== 'deposit' || requiredAmount.value === null) return ''

  return `${formatExactAmount(requiredAmount.value, receiptInfo.decimals)} ${RECEIPT_SYMBOL}`
})

const isFormValid = computed<boolean>(() =>
  password.value.length >= 3 &&
  selectedWallet.value !== '' &&
  isAmountValid.value &&
  !insufficientBalance.value &&
  !isSubmitting.value
)

const submitLabel = computed<string>(() => {
  if (!isSubmitting.value) {
    return activeTab.value === 'deposit' ? 'Deposit' : 'Withdraw'
  }

  switch (stage.value) {
    case 'approving':
      return `Approving ${underlyingSymbol}...`
    case 'waitingApproval':
      return 'Waiting for approval...'
    case 'supplying':
      return 'Supplying...'
    case 'withdrawing':
      return 'Withdrawing...'
    case 'waitingConfirmation':
      return 'Waiting for confirmation...'
    default:
      return 'Processing...'
  }
})

const switchTab = (tab: Tab): void => {
  if (isSubmitting.value) return

  activeTab.value = tab
  errorMessage.value = ''
  successMessage.value = ''
  successTxHash.value = ''
  successApprovalTxHash.value = ''
}

const applyDepositMax = (): void => {
  const balance = underlyingBalance.value
  if (!balance) return

  depositAmount.value = formatExactAmount(balance.raw, underlyingInfo.decimals)
}

const applyWithdrawMax = (): void => {
  const balance = aethusdcBalance.value
  if (!balance) return

  withdrawAmount.value = formatExactAmount(balance.raw, receiptInfo.decimals)
  withdrawAll.value = true
}

const handleWithdrawInput = (event: Event): void => {
  withdrawAmount.value = (event.target as HTMLInputElement).value
  withdrawAll.value = false
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

const handleSubmit = async (): Promise<void> => {
  errorMessage.value = ''
  successMessage.value = ''
  successTxHash.value = ''
  successApprovalTxHash.value = ''

  if (!isFormValid.value) return

  const encryptedJson = getWallets()[selectedWallet.value]?.encryptedJson

  if (!encryptedJson) {
    errorMessage.value = 'Wallet not found'
    return
  }

  const action = activeTab.value
  isSubmitting.value = true
  stage.value = ''

  try {
    const privateKey = await decryptWalletData(encryptedJson)
    if (!privateKey) {
      passwordRef.value?.clear()
      return
    }

    const result = action === 'deposit'
      ? await deposit(privateKey, RECEIPT_SYMBOL, depositAmount.value.trim(), {
        onStage: nextStage => {
          stage.value = nextStage
        },
      })
      : await withdraw(
        privateKey,
        RECEIPT_SYMBOL,
        withdrawAll.value ? 'max' : withdrawAmount.value.trim(),
        {
          onStage: nextStage => {
            stage.value = nextStage
          },
        }
      )

    successMessage.value = action === 'deposit' ? 'Deposit complete.' : 'Withdrawal complete.'
    successTxHash.value = result.txHash
    successApprovalTxHash.value = result.approvalTxHash ?? ''

    passwordRef.value?.clear()

    if (action === 'deposit') {
      depositAmount.value = ''
    } else {
      withdrawAmount.value = ''
      withdrawAll.value = false
    }

    await loadBalances()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Transaction failed'
  } finally {
    isSubmitting.value = false
    stage.value = ''
  }
}

watch(selectedWallet, () => {
  void loadBalances()
}, { immediate: true })
</script>

<style scoped>
.aethusdc-section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1rem;
  background-color: var(--color20);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.token-heading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.section-title {
  font-family: var(--heading);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color90);
  margin: 0 0 0.2rem;
}

.token-symbol {
  font-family: var(--mono);
  font-size: 0.75rem;
  color: var(--color70);
  margin: 0;
}

.token-balance {
  display: flex;
  column-gap: 0.5rem;
  align-items: center;
}

.balance-value {
  font-family: var(--mono);
  font-size: 1rem;
  color: var(--color90);
}

.balance-unit {
  font-family: var(--mono);
  font-size: 0.7rem;
  color: var(--color70);
}

.aethusdc-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
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
.form-select:disabled {
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

.tab-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.amount-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.amount-balance {
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

.estimate {
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
  word-break: break-word;
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
  .section-header {
    align-items: flex-start;
  }

  .amount-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.35rem;
  }
}
</style>
