import { ethers } from 'ethers'
import { TOKEN_INFO } from '~/api/ethereum/config'
import { rpcProvider } from '~/api/ethereum/provider'

const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]

const POOL_ABI = [
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
  'function withdraw(address asset, uint256 amount, address to) returns (uint256)',
]

const GAS_BUFFER_PERCENT = 120n
const FEE_BUFFER_PERCENT = 110n

export type AaveStage =
  | 'approving'
  | 'waitingApproval'
  | 'supplying'
  | 'withdrawing'
  | 'waitingConfirmation'

export interface AaveActionOptions {
  waitForConfirmation?: boolean
  confirmations?: number
  gasLimit?: bigint
  onStage?: (stage: AaveStage) => void
}

export interface AaveActionResult {
  txHash: string
  approvalTxHash?: string
  txReceipt: ethers.TransactionReceipt | null
}

interface AaveContext {
  receiptSymbol: string
  receiptDecimals: number
  underlyingSymbol: string
  underlyingAddress: string
  underlyingDecimals: number
  poolAddress: string
}

const resolveAaveContext = (receiptSymbol: string): AaveContext => {
  const receiptInfo = TOKEN_INFO[receiptSymbol]

  if (!receiptInfo) {
    throw new Error(`Token not found: ${receiptSymbol}`)
  }

  const interestBearing = receiptInfo.interestBearing

  if (!interestBearing) {
    throw new Error(`${receiptSymbol} is not an interest-bearing token`)
  }

  if (interestBearing.protocol !== 'aave-v3') {
    throw new Error(`Unsupported interest-bearing protocol: ${interestBearing.protocol}`)
  }

  const underlyingInfo = TOKEN_INFO[interestBearing.underlying]

  if (!underlyingInfo) {
    throw new Error(`Underlying token not found: ${interestBearing.underlying}`)
  }

  if (!ethers.isAddress(interestBearing.pool)) {
    throw new Error(`Invalid Aave Pool address: ${interestBearing.pool}`)
  }

  return {
    receiptSymbol,
    receiptDecimals: receiptInfo.decimals,
    underlyingSymbol: underlyingInfo.symbol,
    underlyingAddress: underlyingInfo.contractAddress,
    underlyingDecimals: underlyingInfo.decimals,
    poolAddress: interestBearing.pool,
  }
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

const getFeeOverrides = async (provider: ethers.Provider): Promise<ethers.Overrides> => {
  const feeData = await provider.getFeeData()

  if (feeData.maxFeePerGas !== null && feeData.maxPriorityFeePerGas !== null) {
    return {
      maxFeePerGas: (feeData.maxFeePerGas * FEE_BUFFER_PERCENT) / 100n,
      maxPriorityFeePerGas: (feeData.maxPriorityFeePerGas * FEE_BUFFER_PERCENT) / 100n,
      type: 2,
    }
  }

  if (feeData.gasPrice !== null) {
    return { gasPrice: (feeData.gasPrice * FEE_BUFFER_PERCENT) / 100n }
  }

  return {}
}

const addGasBuffer = (estimatedGas: bigint): bigint =>
  (estimatedGas * GAS_BUFFER_PERCENT) / 100n

const waitForTransaction = async (
  tx: ethers.ContractTransactionResponse,
  confirmations: number
): Promise<ethers.TransactionReceipt> => {
  const receipt = await tx.wait(confirmations)

  if (!receipt) {
    throw new Error('Transaction receipt not found')
  }

  if (receipt.status === 0) {
    throw new Error(`Transaction failed! Status: ${receipt.status}, Hash: ${tx.hash}`)
  }

  return receipt
}

export async function deposit(
  privateKey: string,
  receiptSymbol: string,
  amount: string | number,
  options: AaveActionOptions = {}
): Promise<AaveActionResult> {
  const context = resolveAaveContext(receiptSymbol)
  const parsedAmount = parseAmount(amount, context.underlyingDecimals, context.underlyingSymbol)
  const provider = rpcProvider.getProvider()
  const wallet = new ethers.Wallet(privateKey, provider)
  const token = new ethers.Contract(context.underlyingAddress, ERC20_ABI, wallet)
  const pool = new ethers.Contract(context.poolAddress, POOL_ABI, wallet)
  const confirmations = options.confirmations ?? 1
  const feeOverrides = await getFeeOverrides(provider)

  let approvalTxHash: string | undefined

  const allowance: bigint = await token.allowance(wallet.address, context.poolAddress)

  if (allowance < parsedAmount) {
    options.onStage?.('approving')

    if (allowance > 0n) {
      const resetTx = await token.approve(context.poolAddress, 0n, feeOverrides)
      await waitForTransaction(resetTx, confirmations)
    }

    const approvalTx = await token.approve(context.poolAddress, parsedAmount, feeOverrides)
    approvalTxHash = approvalTx.hash

    options.onStage?.('waitingApproval')
    await waitForTransaction(approvalTx, confirmations)
  }

  options.onStage?.('supplying')

  const gasLimit = options.gasLimit ?? addGasBuffer(
    await pool.supply.estimateGas(
      context.underlyingAddress,
      parsedAmount,
      wallet.address,
      0
    )
  )

  const tx = await pool.supply(
    context.underlyingAddress,
    parsedAmount,
    wallet.address,
    0,
    { ...feeOverrides, gasLimit }
  )

  let txReceipt: ethers.TransactionReceipt | null = null

  if (options.waitForConfirmation !== false) {
    options.onStage?.('waitingConfirmation')
    txReceipt = await waitForTransaction(tx, confirmations)
  }

  return {
    txHash: tx.hash,
    approvalTxHash,
    txReceipt,
  }
}

export async function withdraw(
  privateKey: string,
  receiptSymbol: string,
  amount: string | number | 'max',
  options: AaveActionOptions = {}
): Promise<AaveActionResult> {
  const context = resolveAaveContext(receiptSymbol)
  const withdrawAll = amount === 'max'
  const parsedAmount = withdrawAll
    ? ethers.MaxUint256
    : parseAmount(amount, context.receiptDecimals, context.receiptSymbol)

  const provider = rpcProvider.getProvider()
  const wallet = new ethers.Wallet(privateKey, provider)
  const pool = new ethers.Contract(context.poolAddress, POOL_ABI, wallet)
  const confirmations = options.confirmations ?? 1
  const feeOverrides = await getFeeOverrides(provider)

  options.onStage?.('withdrawing')

  const gasLimit = options.gasLimit ?? addGasBuffer(
    await pool.withdraw.estimateGas(
      context.underlyingAddress,
      parsedAmount,
      wallet.address
    )
  )

  const tx = await pool.withdraw(
    context.underlyingAddress,
    parsedAmount,
    wallet.address,
    { ...feeOverrides, gasLimit }
  )

  let txReceipt: ethers.TransactionReceipt | null = null

  if (options.waitForConfirmation !== false) {
    options.onStage?.('waitingConfirmation')
    txReceipt = await waitForTransaction(tx, confirmations)
  }

  return {
    txHash: tx.hash,
    txReceipt,
  }
}
