import { ethers } from 'ethers'
import { deposit, getMaxStakeAmount, withdraw } from '~/api/ethereum/stETH'
import { rpcProvider } from '~/api/ethereum/provider'
import { transferToken } from '~/api/ethereum/transfer'

const STETH_ADDRESS = '0xae7ab96520de3a18e5e111b5eaab095312d7fe84'
const WITHDRAWAL_QUEUE_ADDRESS = '0x889edc2edab5f40e902b864ad4d7ade8e412f9b1'

jest.mock('~/api/ethereum/provider', () => ({
  rpcProvider: {
    getProvider: jest.fn(),
  },
}))

jest.mock('~/api/ethereum/config', () => ({
  LIDO_WITHDRAWAL_QUEUE_ADDRESS: '0x889edc2edab5f40e902b864ad4d7ade8e412f9b1',
  TOKEN_INFO: {
    stETH: {
      name: 'Lido Staked Ether',
      symbol: 'stETH',
      decimals: 18,
      contractAddress: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
      chainlinkFeed: '0xcfe54b5cd566ab89272946f602d76ea879cab4a8',
      coingeckoId: 'staked-ether',
    },
  },
}))

jest.mock('~/api/ethereum/transfer', () => ({
  transferToken: jest.fn(),
}))

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers') as any
  const realEthers = actual.ethers || actual.default || actual

  return {
    __esModule: true,
    ...actual,
    ethers: {
      ...realEthers,
      Wallet: jest.fn(),
      Contract: jest.fn(),
    },
  }
})

interface MockTx {
  hash: string
  wait: jest.Mock
}

const createTx = (hash: string, status = 1): MockTx => ({
  hash,
  wait: jest.fn().mockResolvedValue({
    blockNumber: 1,
    gasUsed: 100_000n,
    status,
  }),
})

const createMethod = (tx: MockTx) =>
  Object.assign(jest.fn().mockResolvedValue(tx), {
    estimateGas: jest.fn().mockResolvedValue(200_000n),
  })

describe('lido', () => {
  const mockPrivateKey = '0x0123456789012345678901234567890123456789012345678901234567890123'
  const mockWalletAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'

  let mockProvider: any
  let mockWallet: any
  let mockToken: any
  let mockQueue: any
  let withdrawalTx: MockTx

  const mockedGetProvider = rpcProvider.getProvider as jest.Mock
  const mockedTransferToken = transferToken as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    mockProvider = {
      getBalance: jest.fn().mockResolvedValue(0n),
      getFeeData: jest.fn().mockResolvedValue({
        maxFeePerGas: 1_000_000_000n,
        maxPriorityFeePerGas: 100_000_000n,
        gasPrice: 1_000_000_000n,
      }),
      estimateGas: jest.fn().mockResolvedValue(21_000n),
    }
    mockedGetProvider.mockReturnValue(mockProvider)

    mockWallet = { address: mockWalletAddress }
    ;(ethers.Wallet as unknown as jest.Mock).mockImplementation(() => mockWallet)

    withdrawalTx = createTx('0xwithdrawalhash')

    mockToken = {
      allowance: jest.fn().mockResolvedValue(10n ** 30n),
      approve: jest.fn().mockResolvedValue(createTx('0xapprovalhash')),
      balanceOf: jest.fn().mockResolvedValue(0n),
    }

    mockQueue = {
      requestWithdrawals: createMethod(withdrawalTx),
    }

    ;(ethers.Contract as unknown as jest.Mock).mockImplementation((address: string) => {
      return address.toLowerCase() === WITHDRAWAL_QUEUE_ADDRESS ? mockQueue : mockToken
    })
  })

  describe('getMaxStakeAmount', () => {
    it('rejects invalid wallet addresses', async () => {
      await expect(getMaxStakeAmount('not-an-address')).rejects.toThrow(
        'Invalid wallet address: not-an-address'
      )
    })

    it('returns zero for an empty wallet without requesting fee data', async () => {
      await expect(getMaxStakeAmount(mockWalletAddress)).resolves.toBe(0n)

      expect(mockProvider.getFeeData).not.toHaveBeenCalled()
      expect(mockProvider.estimateGas).not.toHaveBeenCalled()
    })

    it('returns the full balance when no gas price is available', async () => {
      mockProvider.getBalance.mockResolvedValue(ethers.parseEther('1'))
      mockProvider.getFeeData.mockResolvedValue({
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
        gasPrice: null,
      })

      await expect(getMaxStakeAmount(mockWalletAddress)).resolves.toBe(ethers.parseEther('1'))
      expect(mockProvider.estimateGas).not.toHaveBeenCalled()
    })

    it('reserves buffered gas costs from the balance', async () => {
      const balance = ethers.parseEther('1')
      mockProvider.getBalance.mockResolvedValue(balance)
      mockProvider.getFeeData.mockResolvedValue({
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
        gasPrice: 10_000_000_000n,
      })

      const result = await getMaxStakeAmount(mockWalletAddress)

      expect(mockProvider.estimateGas).toHaveBeenCalledWith({
        from: mockWalletAddress,
        to: STETH_ADDRESS,
        value: ethers.parseEther('0.01'),
      })

      const bufferedGasLimit = (21_000n * 120n) / 100n
      const bufferedGasPrice = (10_000_000_000n * 110n) / 100n
      const reserve = (bufferedGasLimit * bufferedGasPrice * 120n) / 100n

      expect(result).toBe(balance - reserve)
    })

    it('prefers maxFeePerGas over gasPrice', async () => {
      const balance = ethers.parseEther('1')
      mockProvider.getBalance.mockResolvedValue(balance)
      mockProvider.getFeeData.mockResolvedValue({
        maxFeePerGas: 20_000_000_000n,
        maxPriorityFeePerGas: 1_000_000_000n,
        gasPrice: 10_000_000_000n,
      })

      const result = await getMaxStakeAmount(mockWalletAddress)

      const bufferedGasLimit = (21_000n * 120n) / 100n
      const bufferedGasPrice = (20_000_000_000n * 110n) / 100n
      const reserve = (bufferedGasLimit * bufferedGasPrice * 120n) / 100n

      expect(result).toBe(balance - reserve)
    })

    it('uses half of a small balance as the gas estimation sample', async () => {
      const balance = ethers.parseEther('0.005')
      mockProvider.getBalance.mockResolvedValue(balance)

      await getMaxStakeAmount(mockWalletAddress)

      expect(mockProvider.estimateGas).toHaveBeenCalledWith(
        expect.objectContaining({ value: balance / 2n })
      )
    })

    it('falls back to a conservative gas limit when estimation fails', async () => {
      const balance = ethers.parseEther('1')
      mockProvider.getBalance.mockResolvedValue(balance)
      mockProvider.getFeeData.mockResolvedValue({
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
        gasPrice: 10_000_000_000n,
      })
      mockProvider.estimateGas.mockRejectedValue(new Error('execution reverted'))

      const result = await getMaxStakeAmount(mockWalletAddress)

      const bufferedGasLimit = (150_000n * 120n) / 100n
      const bufferedGasPrice = (10_000_000_000n * 110n) / 100n
      const reserve = (bufferedGasLimit * bufferedGasPrice * 120n) / 100n

      expect(result).toBe(balance - reserve)
    })

    it('never returns a negative amount when gas costs exceed the balance', async () => {
      mockProvider.getBalance.mockResolvedValue(ethers.parseEther('0.001'))
      mockProvider.getFeeData.mockResolvedValue({
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
        gasPrice: ethers.parseEther('1'),
      })

      await expect(getMaxStakeAmount(mockWalletAddress)).resolves.toBe(0n)
    })
  })

  describe('deposit', () => {
    const createTransferResult = (status = 1) => {
      const txResponse = {
        hash: '0xstakehash',
        wait: jest.fn().mockResolvedValue({
          blockNumber: 1,
          gasUsed: 21_000n,
          status,
        }),
      }

      return { txHash: '0xstakehash', txResponse, txReceipt: null }
    }

    it('stakes ETH through the stETH contract and waits for the receipt', async () => {
      const transfer = createTransferResult()
      mockedTransferToken.mockResolvedValue(transfer)
      const stages: string[] = []

      const result = await deposit(mockPrivateKey, '1', {
        onStage: stage => stages.push(stage),
      })

      expect(mockedTransferToken).toHaveBeenCalledWith(
        mockPrivateKey,
        STETH_ADDRESS,
        'ETH',
        '1',
        { gasLimit: undefined, waitForConfirmation: false }
      )
      expect(transfer.txResponse.wait).toHaveBeenCalledWith(1)
      expect(stages).toEqual(['staking', 'waitingConfirmation'])
      expect(result.txHash).toBe('0xstakehash')
      expect(result.txReceipt).not.toBeNull()
    })

    it('does not wait when confirmation is disabled', async () => {
      const transfer = createTransferResult()
      mockedTransferToken.mockResolvedValue(transfer)
      const stages: string[] = []

      const result = await deposit(mockPrivateKey, '1', {
        waitForConfirmation: false,
        onStage: stage => stages.push(stage),
      })

      expect(transfer.txResponse.wait).not.toHaveBeenCalled()
      expect(stages).toEqual(['staking'])
      expect(result.txReceipt).toBeNull()
    })

    it('forwards the gas limit and confirmation count', async () => {
      const transfer = createTransferResult()
      mockedTransferToken.mockResolvedValue(transfer)

      await deposit(mockPrivateKey, '1', { gasLimit: 90_000n, confirmations: 3 })

      expect(mockedTransferToken).toHaveBeenCalledWith(
        mockPrivateKey,
        STETH_ADDRESS,
        'ETH',
        '1',
        { gasLimit: 90_000n, waitForConfirmation: false }
      )
      expect(transfer.txResponse.wait).toHaveBeenCalledWith(3)
    })

    it('rejects a failed stake transaction', async () => {
      mockedTransferToken.mockResolvedValue(createTransferResult(0))

      await expect(deposit(mockPrivateKey, '1')).rejects.toThrow(
        'Transaction failed! Status: 0, Hash: 0xstakehash'
      )
    })

    it('propagates transfer errors', async () => {
      mockedTransferToken.mockRejectedValue(new Error('insufficient funds'))

      await expect(deposit(mockPrivateKey, '1')).rejects.toThrow('insufficient funds')
    })
  })

  describe('withdraw', () => {
    it('requests a withdrawal without approval when the allowance is sufficient', async () => {
      const stages: string[] = []

      const result = await withdraw(mockPrivateKey, '10', {
        onStage: stage => stages.push(stage),
      })

      expect(mockToken.approve).not.toHaveBeenCalled()
      expect(mockQueue.requestWithdrawals.estimateGas).toHaveBeenCalledWith(
        [ethers.parseEther('10')],
        mockWalletAddress
      )
      expect(mockQueue.requestWithdrawals).toHaveBeenCalledWith(
        [ethers.parseEther('10')],
        mockWalletAddress,
        {
          maxFeePerGas: 1_100_000_000n,
          maxPriorityFeePerGas: 110_000_000n,
          type: 2,
          gasLimit: 240_000n,
        }
      )
      expect(withdrawalTx.wait).toHaveBeenCalledWith(1)
      expect(stages).toEqual(['requestingWithdrawal', 'waitingConfirmation'])
      expect(result.txHash).toBe('0xwithdrawalhash')
      expect(result.approvalTxHash).toBeUndefined()
      expect(result.txReceipt).not.toBeNull()
    })

    it('approves the queue when the allowance is insufficient', async () => {
      mockToken.allowance.mockResolvedValue(0n)
      const approvalTx = createTx('0xapprovalhash')
      mockToken.approve.mockResolvedValue(approvalTx)
      const stages: string[] = []

      const result = await withdraw(mockPrivateKey, '10', {
        onStage: stage => stages.push(stage),
      })

      expect(mockToken.approve).toHaveBeenCalledWith(
        WITHDRAWAL_QUEUE_ADDRESS,
        ethers.parseEther('10'),
        expect.objectContaining({ type: 2 })
      )
      expect(approvalTx.wait).toHaveBeenCalledWith(1)
      expect(result.approvalTxHash).toBe('0xapprovalhash')
      expect(stages).toEqual([
        'approving',
        'waitingApproval',
        'requestingWithdrawal',
        'waitingConfirmation',
      ])
    })

    it('withdraws the full stETH balance for max', async () => {
      const balance = ethers.parseEther('42')
      mockToken.balanceOf.mockResolvedValue(balance)

      await withdraw(mockPrivateKey, 'max', { waitForConfirmation: false })

      expect(mockToken.balanceOf).toHaveBeenCalledWith(mockWalletAddress)
      expect(mockQueue.requestWithdrawals).toHaveBeenCalledWith(
        [balance],
        mockWalletAddress,
        expect.any(Object)
      )
    })

    it('splits large withdrawals into queue-sized requests', async () => {
      await withdraw(mockPrivateKey, '1000.00000000000000005', {
        waitForConfirmation: false,
      })

      expect(mockQueue.requestWithdrawals).toHaveBeenCalledWith(
        [ethers.parseEther('1000') - 50n, 100n],
        mockWalletAddress,
        expect.any(Object)
      )
    })

    it('rejects withdrawals below the queue minimum', async () => {
      await expect(withdraw(mockPrivateKey, '0.000000000000000099')).rejects.toThrow(
        'Minimum withdrawal amount is 100 wei of stETH'
      )
    })

    it('rejects malformed amounts', async () => {
      await expect(withdraw(mockPrivateKey, 'abc')).rejects.toThrow('Invalid amount: abc')
      await expect(withdraw(mockPrivateKey, '0')).rejects.toThrow(
        'Amount must be greater than 0'
      )
      await expect(withdraw(mockPrivateKey, '1.1234567890123456789')).rejects.toThrow(
        'Invalid amount for stETH: maximum 18 decimal places'
      )
    })

    it('uses a supplied gas limit without estimating', async () => {
      await withdraw(mockPrivateKey, '10', { gasLimit: 300_000n })

      expect(mockQueue.requestWithdrawals.estimateGas).not.toHaveBeenCalled()
      expect(mockQueue.requestWithdrawals).toHaveBeenCalledWith(
        [ethers.parseEther('10')],
        mockWalletAddress,
        expect.objectContaining({ gasLimit: 300_000n })
      )
    })

    it('rejects a failed withdrawal transaction', async () => {
      withdrawalTx.wait.mockResolvedValue({ blockNumber: 2, gasUsed: 100_000n, status: 0 })

      await expect(withdraw(mockPrivateKey, '10')).rejects.toThrow(
        'Transaction failed! Status: 0, Hash: 0xwithdrawalhash'
      )
    })
  })
})
