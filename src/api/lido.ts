import { ethers } from 'ethers'
import { LIDO_WITHDRAWAL_QUEUE_ADDRESS, TOKEN_INFO } from '~/api/ethereum/config'
import { rpcProvider } from '~/api/ethereum/provider'
import { transferToken } from '~/api/ethereum/transfer'

const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
]

const WITHDRAWAL_QUEUE_ABI = [
  'function requestWithdrawals(uint256[] _amounts, address _owner) returns (uint256[] requestIds)',
]

const GAS_BUFFER_PERCENT = 120n
const FEE_BUFFER_PERCENT = 110n
const MAX_STAKE_SAFETY_BUFFER_PERCENT = 120n

const MIN_WITHDRAWAL_AMOUNT = 100n
const MAX_WITHDRAWAL_AMOUNT = 1000n * 10n ** 18n

export type LidoStage =
  | 'staking'
  | 'approving'
  | 'waitingApproval'
  | 'requestingWithdrawal'
  | 'waitingConfirmation'

export interface LidoActionOptions {
  waitForConfirmation?: boolean
  confirmations?: number
  gasLimit?: bigint
  onStage?: (stage: LidoStage) => void
}

export interface LidoActionResult {
  txHash: string
  approvalTxHash?: string
  txReceipt: ethers.TransactionReceipt | null
}

const getStethInfo = (): typeof TOKEN_INFO.stETH => {
  const stethInfo = TOKEN_INFO.stETH

  if (!stethInfo) {
    throw new Error('stETH token not found')
  }

  return stethInfo
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

const splitWithdrawalAmounts = (amount: bigint): bigint[] => {
  if (amount < MIN_WITHDRAWAL_AMOUNT) {
    throw new Error(`Minimum withdrawal amount is ${MIN_WITHDRAWAL_AMOUNT} wei of stETH`)
  }

  const amounts: bigint[] = []
  let remaining = amount

  while (remaining > MAX_WITHDRAWAL_AMOUNT) {
    amounts.push(MAX_WITHDRAWAL_AMOUNT)
    remaining -= MAX_WITHDRAWAL_AMOUNT
  }

  if (remaining >= MIN_WITHDRAWAL_AMOUNT) {
    amounts.push(remaining)
  } else if (remaining > 0n && amounts.length > 0) {
    const shortfall = MIN_WITHDRAWAL_AMOUNT - remaining
    amounts[amounts.length - 1] -= shortfall
    amounts.push(MIN_WITHDRAWAL_AMOUNT)
  }

  return amounts
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
  tx: ethers.TransactionResponse,
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

export async function getMaxStakeAmount(address: string): Promise<bigint> {
  if (!ethers.isAddress(address)) {
    throw new Error(`Invalid wallet address: ${address}`)
  }

  const provider = rpcProvider.getProvider()
  const balance = await provider.getBalance(address)

  if (balance === 0n) {
    return 0n
  }

  const feeData = await provider.getFeeData()
  const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice

  if (gasPrice === null || gasPrice === 0n) {
    return balance
  }

  const stethInfo = getStethInfo()
  const sampleValue = balance > ethers.parseEther('0.01')
    ? ethers.parseEther('0.01')
    : balance / 2n

  if (sampleValue <= 0n) {
    return 0n
  }

  let gasLimit = 150000n

  try {
    gasLimit = await provider.estimateGas({
      from: address,
      to: stethInfo.contractAddress,
      value: sampleValue,
    })
  } catch {
    // Keep the conservative fallback limit.
  }

  const bufferedGasLimit = addGasBuffer(gasLimit)
  const bufferedGasPrice = (gasPrice * FEE_BUFFER_PERCENT) / 100n
  const reserve = (bufferedGasLimit * bufferedGasPrice * MAX_STAKE_SAFETY_BUFFER_PERCENT) / 100n

  return balance > reserve ? balance - reserve : 0n
}

export async function deposit(
  privateKey: string,
  amount: string | number,
  options: LidoActionOptions = {}
): Promise<LidoActionResult> {
  const stethInfo = getStethInfo()

  options.onStage?.('staking')

  const transfer = await transferToken(
    privateKey,
    stethInfo.contractAddress,
    'ETH',
    amount,
    {
      gasLimit: options.gasLimit,
      waitForConfirmation: false,
    }
  )

  let txReceipt: ethers.TransactionReceipt | null = null

  if (options.waitForConfirmation !== false) {
    options.onStage?.('waitingConfirmation')
    txReceipt = await waitForTransaction(transfer.txResponse, options.confirmations ?? 1)
  }

  return {
    txHash: transfer.txHash,
    txReceipt,
  }
}

export async function withdraw(
  privateKey: string,
  amount: string | number | 'max',
  options: LidoActionOptions = {}
): Promise<LidoActionResult> {
  const stethInfo = getStethInfo()
  const provider = rpcProvider.getProvider()
  const wallet = new ethers.Wallet(privateKey, provider)
  const token = new ethers.Contract(stethInfo.contractAddress, ERC20_ABI, wallet)
  const queue = new ethers.Contract(LIDO_WITHDRAWAL_QUEUE_ADDRESS, WITHDRAWAL_QUEUE_ABI, wallet)
  const confirmations = options.confirmations ?? 1
  const feeOverrides = await getFeeOverrides(provider)

  const parsedAmount = amount === 'max'
    ? await token.balanceOf(wallet.address)
    : parseAmount(amount, stethInfo.decimals, stethInfo.symbol)

  const requestAmounts = splitWithdrawalAmounts(parsedAmount)
  const totalAmount = requestAmounts.reduce((sum, value) => sum + value, 0n)

  let approvalTxHash: string | undefined

  const allowance: bigint = await token.allowance(wallet.address, LIDO_WITHDRAWAL_QUEUE_ADDRESS)

  if (allowance < totalAmount) {
    options.onStage?.('approving')

    const approvalTx = await token.approve(
      LIDO_WITHDRAWAL_QUEUE_ADDRESS,
      totalAmount,
      feeOverrides
    )
    approvalTxHash = approvalTx.hash

    options.onStage?.('waitingApproval')
    await waitForTransaction(approvalTx, confirmations)
  }

  options.onStage?.('requestingWithdrawal')

  const gasLimit = options.gasLimit ?? addGasBuffer(
    await queue.requestWithdrawals.estimateGas(requestAmounts, wallet.address)
  )

  const tx = await queue.requestWithdrawals(
    requestAmounts,
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
    approvalTxHash,
    txReceipt,
  }
}
