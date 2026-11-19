import { ethers } from 'ethers'
import { TronWeb, type Types } from 'tronweb'
import { TOKEN_INFO, TRONGRID_BASE_URL } from './config'

const STRX_SYMBOL = 'sTRX'
const TRX_SYMBOL = 'TRX'

const DEFAULT_FEE_LIMIT = 150_000_000
const CONFIRMATION_POLL_INTERVAL_MS = 3000
const CONFIRMATION_TIMEOUT_MS = 60_000

const STRX_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'tokenAmount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export type STRXStage = 'depositing' | 'withdrawing' | 'claiming' | 'waitingConfirmation'

export interface STRXActionOptions {
  waitForConfirmation?: boolean
  feeLimit?: number
  confirmationTimeoutMs?: number
  onStage?: (stage: STRXStage) => void
}

export interface STRXResult {
  txId: string
  transactionInfo: Types.TransactionInfo | null
}

interface ContractSendOptions {
  feeLimit: number
  callValue?: number
}

interface ContractMethod {
  send: (options: ContractSendOptions) => Promise<unknown>
}

interface SendResult {
  txId: string
  transactionInfo: Types.TransactionInfo | null
}

const sleep = (milliseconds: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, milliseconds))

const getTokenAddress = (symbol: string): string => {
  const contractAddress = TOKEN_INFO[symbol]?.contractAddress

  if (!contractAddress) {
    throw new Error(`No TRC-20 contract configured for: ${symbol}`)
  }

  return contractAddress
}

const getTokenDecimals = (symbol: string): number => {
  const tokenInfo = TOKEN_INFO[symbol]

  if (!tokenInfo) {
    throw new Error(`Token not found: ${symbol}`)
  }

  return tokenInfo.decimals
}

const parseAmount = (amount: string | number, decimals: number, symbol: string): bigint => {
  const value = amount.toString().trim()

  if (!/^\d*\.?\d+$/.test(value)) {
    throw new Error(`Invalid amount: ${amount}`)
  }

  let parsedAmount: bigint

  try {
    parsedAmount = ethers.parseUnits(value, decimals)
  } catch {
    throw new Error(`Invalid amount for ${symbol}: maximum ${decimals} decimal places`)
  }

  if (parsedAmount <= 0n) {
    throw new Error('Amount must be greater than 0')
  }

  return parsedAmount
}

const toBigInt = (value: unknown): bigint => {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') return BigInt(value)
  if (typeof value === 'string' && value.length > 0) return BigInt(value)
  if (value && typeof (value as { toString: () => string }).toString === 'function') {
    return BigInt((value as { toString: () => string }).toString())
  }

  throw new Error(`Cannot convert value to bigint: ${String(value)}`)
}

const createTronWeb = (privateKey: string): TronWeb => {
  const normalizedPrivateKey = privateKey.trim()

  if (!/^(0x)?[0-9a-fA-F]{64}$/.test(normalizedPrivateKey)) {
    throw new Error('Invalid Tron private key')
  }

  const tronWeb = new TronWeb({
    fullHost: TRONGRID_BASE_URL,
    privateKey: normalizedPrivateKey,
  })

  if (!tronWeb.defaultAddress.base58) {
    throw new Error('Invalid Tron private key')
  }

  return tronWeb
}

const getOwnerAddress = (tronWeb: TronWeb): string => {
  const address = tronWeb.defaultAddress.base58

  if (!address) {
    throw new Error('Invalid Tron private key')
  }

  return address
}

const waitForConfirmation = async (
  tronWeb: TronWeb,
  txId: string,
  timeoutMs: number
): Promise<Types.TransactionInfo> => {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    let transactionInfo: Types.TransactionInfo | null = null

    try {
      transactionInfo = await tronWeb.trx.getTransactionInfo(txId)
    } catch {
      transactionInfo = null
    }

    if (transactionInfo?.id) {
      if (
        transactionInfo.result === 'FAILED' ||
        transactionInfo.receipt?.result === 'REVERT'
      ) {
        throw new Error(`Transaction failed: ${txId}`)
      }

      return transactionInfo
    }

    await sleep(CONFIRMATION_POLL_INTERVAL_MS)
  }

  throw new Error(`Transaction confirmation timed out: ${txId}`)
}

const sendTransaction = async (
  tronWeb: TronWeb,
  method: ContractMethod,
  options: STRXActionOptions,
  waitingStage: STRXStage,
  callValue?: number
): Promise<SendResult> => {
  const txId = String(
    await method.send({
      feeLimit: options.feeLimit ?? DEFAULT_FEE_LIMIT,
      ...(callValue === undefined ? {} : { callValue }),
    })
  )

  if (options.waitForConfirmation === false) {
    return { txId, transactionInfo: null }
  }

  options.onStage?.(waitingStage)

  const transactionInfo = await waitForConfirmation(
    tronWeb,
    txId,
    options.confirmationTimeoutMs ?? CONFIRMATION_TIMEOUT_MS
  )

  return { txId, transactionInfo }
}

/**
 * Stakes TRX for sTRX by sending the amount as the value of the payable
 * `deposit` call. The Staked TRX Proxy mints sTRX shares to the signing wallet.
 */
export async function deposit(
  privateKey: string,
  amount: string | number,
  options: STRXActionOptions = {}
): Promise<STRXResult> {
  const parsedAmount = parseAmount(amount, getTokenDecimals(TRX_SYMBOL), TRX_SYMBOL)
  const tronWeb = createTronWeb(privateKey)
  const strx = tronWeb.contract(STRX_ABI, getTokenAddress(STRX_SYMBOL))

  options.onStage?.('depositing')

  const { txId, transactionInfo } = await sendTransaction(
    tronWeb,
    strx.methods.deposit(),
    options,
    'waitingConfirmation',
    Number(parsedAmount)
  )

  return {
    txId,
    transactionInfo,
  }
}

/**
 * Unstakes sTRX by burning the token amount. The contract queues the matching
 * TRX for withdrawal, which becomes claimable after the protocol delay.
 */
export async function withdraw(
  privateKey: string,
  amount: string | number | 'max',
  options: STRXActionOptions = {}
): Promise<STRXResult> {
  const tronWeb = createTronWeb(privateKey)
  const owner = getOwnerAddress(tronWeb)
  const strx = tronWeb.contract(STRX_ABI, getTokenAddress(STRX_SYMBOL))

  const parsedAmount = amount === 'max'
    ? toBigInt(await strx.methods.balanceOf(owner).call())
    : parseAmount(amount, getTokenDecimals(STRX_SYMBOL), STRX_SYMBOL)

  if (parsedAmount <= 0n) {
    throw new Error('Amount must be greater than 0')
  }

  options.onStage?.('withdrawing')

  const { txId, transactionInfo } = await sendTransaction(
    tronWeb,
    strx.methods.withdraw(parsedAmount),
    options,
    'waitingConfirmation'
  )

  return {
    txId,
    transactionInfo,
  }
}

/**
 * Claims TRX that has finished unstaking and passed the protocol delay.
 */
export async function claim(
  privateKey: string,
  options: STRXActionOptions = {}
): Promise<STRXResult> {
  const tronWeb = createTronWeb(privateKey)
  const strx = tronWeb.contract(STRX_ABI, getTokenAddress(STRX_SYMBOL))

  options.onStage?.('claiming')

  const { txId, transactionInfo } = await sendTransaction(
    tronWeb,
    strx.methods.claim(),
    options,
    'waitingConfirmation'
  )

  return {
    txId,
    transactionInfo,
  }
}
