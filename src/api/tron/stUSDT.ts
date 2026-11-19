import { ethers } from 'ethers'
import { TronWeb, type Types } from 'tronweb'
import {
  STUSDT_MINTER_ADDRESS,
  STUSDT_UNSTAKING_ADDRESS,
  TOKEN_INFO,
  TRONGRID_BASE_URL,
} from './config'

const STUSDT_SYMBOL = 'stUSDT'
const USDT_SYMBOL = 'USDT'

const DEFAULT_FEE_LIMIT = 150_000_000
const CONFIRMATION_POLL_INTERVAL_MS = 3000
const CONFIRMATION_TIMEOUT_MS = 60_000

const TRC20_ABI = [
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

const MINTER_ABI = [
  {
    name: 'submit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_amountOfToken', type: 'uint256' }],
    outputs: [],
  },
] as const

const UNSTAKING_ABI = [
  {
    name: 'requestWithdrawal',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_amountOfStUSDT', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'claimWithdrawals',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_requestIds', type: 'uint256[]' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export type StUSDTStage =
  | 'approving'
  | 'waitingApproval'
  | 'depositing'
  | 'withdrawing'
  | 'claiming'
  | 'waitingConfirmation'

export interface StUSDTActionOptions {
  waitForConfirmation?: boolean
  feeLimit?: number
  confirmationTimeoutMs?: number
  onStage?: (stage: StUSDTStage) => void
}

export interface StUSDTResult {
  txId: string
  approvalTxId?: string
  requestId?: bigint
  transactionInfo: Types.TransactionInfo | null
}

interface ContractMethod {
  send: (options: { feeLimit: number }) => Promise<unknown>
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
  options: StUSDTActionOptions,
  waitingStage: StUSDTStage
): Promise<SendResult> => {
  const txId = String(await method.send({
    feeLimit: options.feeLimit ?? DEFAULT_FEE_LIMIT,
  }))

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

const ensureAllowance = async (
  tronWeb: TronWeb,
  token: ReturnType<TronWeb['contract']>,
  owner: string,
  spender: string,
  amount: bigint,
  options: StUSDTActionOptions
): Promise<string | undefined> => {
  const allowance = toBigInt(await token.methods.allowance(owner, spender).call())

  if (allowance >= amount) {
    return undefined
  }

  options.onStage?.('approving')

  // The deposit/withdrawal transaction spends the allowance immediately, so
  // the approval has to be confirmed even when the caller asked not to wait
  // for the main transaction.
  const approval = await sendTransaction(
    tronWeb,
    token.methods.approve(spender, amount),
    { ...options, waitForConfirmation: true },
    'waitingApproval'
  )

  return approval.txId
}

const decodeUint256 = (value: string | undefined): bigint | undefined => {
  if (!value) return undefined

  return BigInt(value.startsWith('0x') ? value : `0x${value}`)
}

/**
 * Stakes USDT for stUSDT by approving the stUSDT MinterProxy and calling
 * `submit`. The MinterProxy mints stUSDT shares to the wallet that signs the
 * transaction.
 */
export async function deposit(
  privateKey: string,
  amount: string | number,
  options: StUSDTActionOptions = {}
): Promise<StUSDTResult> {
  const parsedAmount = parseAmount(amount, getTokenDecimals(USDT_SYMBOL), USDT_SYMBOL)
  const tronWeb = createTronWeb(privateKey)
  const owner = getOwnerAddress(tronWeb)
  const usdt = tronWeb.contract(TRC20_ABI, getTokenAddress(USDT_SYMBOL))
  const minter = tronWeb.contract(MINTER_ABI, STUSDT_MINTER_ADDRESS)

  const approvalTxId = await ensureAllowance(
    tronWeb,
    usdt,
    owner,
    STUSDT_MINTER_ADDRESS,
    parsedAmount,
    options
  )

  options.onStage?.('depositing')

  const { txId, transactionInfo } = await sendTransaction(
    tronWeb,
    minter.methods.submit(parsedAmount),
    options,
    'waitingConfirmation'
  )

  return {
    txId,
    approvalTxId,
    transactionInfo,
  }
}

/**
 * Creates an unstaking request for stUSDT. The UnstUSDTProxy burns the stUSDT
 * amount and queues a withdrawal that becomes claimable after the protocol
 * delay. Use `claimWithdrawals` with the returned request id once it matures.
 */
export async function withdraw(
  privateKey: string,
  amount: string | number | 'max',
  options: StUSDTActionOptions = {}
): Promise<StUSDTResult> {
  const tronWeb = createTronWeb(privateKey)
  const owner = getOwnerAddress(tronWeb)
  const stUsdt = tronWeb.contract(TRC20_ABI, getTokenAddress(STUSDT_SYMBOL))
  const unstaking = tronWeb.contract(UNSTAKING_ABI, STUSDT_UNSTAKING_ADDRESS)

  const parsedAmount = amount === 'max'
    ? toBigInt(await stUsdt.methods.balanceOf(owner).call())
    : parseAmount(amount, getTokenDecimals(STUSDT_SYMBOL), STUSDT_SYMBOL)

  if (parsedAmount <= 0n) {
    throw new Error('Amount must be greater than 0')
  }

  const approvalTxId = await ensureAllowance(
    tronWeb,
    stUsdt,
    owner,
    STUSDT_UNSTAKING_ADDRESS,
    parsedAmount,
    options
  )

  options.onStage?.('withdrawing')

  const { txId, transactionInfo } = await sendTransaction(
    tronWeb,
    unstaking.methods.requestWithdrawal(parsedAmount),
    options,
    'waitingConfirmation'
  )

  return {
    txId,
    approvalTxId,
    requestId: decodeUint256(transactionInfo?.contractResult?.[0]),
    transactionInfo,
  }
}

/**
 * Claims finalized stUSDT withdrawal requests. Each id comes from a previous
 * `withdraw` call, and the request must have passed the protocol delay.
 */
export async function claimWithdrawals(
  privateKey: string,
  requestIds: Array<string | number | bigint>,
  options: StUSDTActionOptions = {}
): Promise<StUSDTResult> {
  if (requestIds.length === 0) {
    throw new Error('At least one withdrawal request id is required')
  }

  const tronWeb = createTronWeb(privateKey)
  const unstaking = tronWeb.contract(UNSTAKING_ABI, STUSDT_UNSTAKING_ADDRESS)
  const ids = requestIds.map(requestId => toBigInt(requestId))

  options.onStage?.('claiming')

  const { txId, transactionInfo } = await sendTransaction(
    tronWeb,
    unstaking.methods.claimWithdrawals(ids),
    options,
    'waitingConfirmation'
  )

  return {
    txId,
    transactionInfo,
  }
}
