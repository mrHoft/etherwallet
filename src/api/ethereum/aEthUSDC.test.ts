import { ethers } from 'ethers'
import { deposit, withdraw } from '~/api/ethereum/aEthUSDC'
import { rpcProvider } from '~/api/ethereum/provider'

const POOL_ADDRESS = '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2'
const USDC_ADDRESS = '0x0000000000000000000000000000000000000001'
const WETH_ADDRESS = '0x0000000000000000000000000000000000000003'

jest.mock('~/api/ethereum/provider', () => ({
  rpcProvider: {
    getProvider: jest.fn(),
  },
}))

jest.mock('~/api/ethereum/config', () => ({
  TOKEN_INFO: {
    USDC: {
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      contractAddress: '0x0000000000000000000000000000000000000001',
      chainlinkFeed: '0x0000000000000000000000000000000000000009',
      coingeckoId: 'usd-coin',
    },
    WETH: {
      name: 'Wrapped Ethereum',
      symbol: 'WETH',
      decimals: 18,
      contractAddress: '0x0000000000000000000000000000000000000003',
      chainlinkFeed: '0x0000000000000000000000000000000000000009',
      coingeckoId: 'weth',
    },
    aEthUSDC: {
      name: 'Aave Ethereum USDC',
      symbol: 'aEthUSDC',
      decimals: 6,
      contractAddress: '0x0000000000000000000000000000000000000002',
      chainlinkFeed: '0x0000000000000000000000000000000000000009',
      coingeckoId: 'usd-coin',
      interestBearing: {
        protocol: 'aave-v3',
        pool: '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2',
        underlying: 'USDC',
      },
    },
    aWETH: {
      name: 'Aave Ethereum WETH',
      symbol: 'aWETH',
      decimals: 18,
      contractAddress: '0x0000000000000000000000000000000000000004',
      chainlinkFeed: '0x0000000000000000000000000000000000000009',
      coingeckoId: 'weth',
      interestBearing: {
        protocol: 'aave-v3',
        pool: '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2',
        underlying: 'WETH',
      },
    },
    cToken: {
      name: 'Compound Token',
      symbol: 'cToken',
      decimals: 8,
      contractAddress: '0x0000000000000000000000000000000000000005',
      chainlinkFeed: '0x0000000000000000000000000000000000000009',
      coingeckoId: 'compound',
      interestBearing: {
        protocol: 'compound',
        pool: '0x0000000000000000000000000000000000000006',
        underlying: 'USDC',
      },
    },
    brokenUnderlying: {
      name: 'Broken Underlying',
      symbol: 'brokenUnderlying',
      decimals: 6,
      contractAddress: '0x0000000000000000000000000000000000000007',
      chainlinkFeed: '0x0000000000000000000000000000000000000009',
      coingeckoId: 'broken',
      interestBearing: {
        protocol: 'aave-v3',
        pool: '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2',
        underlying: 'MISSING',
      },
    },
    invalidPool: {
      name: 'Invalid Pool',
      symbol: 'invalidPool',
      decimals: 6,
      contractAddress: '0x0000000000000000000000000000000000000008',
      chainlinkFeed: '0x0000000000000000000000000000000000000009',
      coingeckoId: 'invalid',
      interestBearing: {
        protocol: 'aave-v3',
        pool: 'not-an-address',
        underlying: 'USDC',
      },
    },
  },
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
    estimateGas: jest.fn().mockResolvedValue(100_000n),
  })

describe('aave', () => {
  const mockPrivateKey = '0x0123456789012345678901234567890123456789012345678901234567890123'
  const mockWalletAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'

  let mockProvider: any
  let mockWallet: any
  let mockToken: any
  let mockPool: any
  let supplyTx: MockTx
  let withdrawTx: MockTx

  const mockedGetProvider = rpcProvider.getProvider as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    mockProvider = {
      getFeeData: jest.fn().mockResolvedValue({
        maxFeePerGas: 1_000_000_000n,
        maxPriorityFeePerGas: 100_000_000n,
        gasPrice: 1_000_000_000n,
      }),
    }
    mockedGetProvider.mockReturnValue(mockProvider)

    mockWallet = { address: mockWalletAddress }
    ;(ethers.Wallet as unknown as jest.Mock).mockImplementation(() => mockWallet)

    supplyTx = createTx('0xsupplyhash')
    withdrawTx = createTx('0xwithdrawhash')

    mockToken = {
      allowance: jest.fn().mockResolvedValue(0n),
      approve: jest.fn().mockResolvedValue(createTx('0xapprovalhash')),
    }

    mockPool = {
      supply: createMethod(supplyTx),
      withdraw: createMethod(withdrawTx),
    }

    ;(ethers.Contract as unknown as jest.Mock).mockImplementation((address: string) => {
      const normalized = address.toLowerCase()
      if (normalized === POOL_ADDRESS) return mockPool
      return mockToken
    })
  })

  describe('deposit', () => {
    it('approves the underlying and supplies it to the pool', async () => {
      const approvalTx = createTx('0xapprovalhash')
      mockToken.approve.mockResolvedValueOnce(approvalTx)
      const stages: string[] = []

      const result = await deposit(mockPrivateKey, 'aEthUSDC', '10', {
        onStage: stage => stages.push(stage),
      })

      expect(ethers.Contract).toHaveBeenCalledWith(
        USDC_ADDRESS,
        expect.any(Array),
        mockWallet
      )
      expect(ethers.Contract).toHaveBeenCalledWith(
        POOL_ADDRESS,
        expect.any(Array),
        mockWallet
      )

      const expectedOverrides = {
        maxFeePerGas: 1_100_000_000n,
        maxPriorityFeePerGas: 110_000_000n,
        type: 2,
      }

      expect(mockToken.allowance).toHaveBeenCalledWith(mockWalletAddress, POOL_ADDRESS)
      expect(mockToken.approve).toHaveBeenCalledWith(
        POOL_ADDRESS,
        10_000_000n,
        expectedOverrides
      )
      expect(approvalTx.wait).toHaveBeenCalledWith(1)
      expect(mockPool.supply.estimateGas).toHaveBeenCalledWith(
        USDC_ADDRESS,
        10_000_000n,
        mockWalletAddress,
        0
      )
      expect(mockPool.supply).toHaveBeenCalledWith(
        USDC_ADDRESS,
        10_000_000n,
        mockWalletAddress,
        0,
        { ...expectedOverrides, gasLimit: 120_000n }
      )
      expect(supplyTx.wait).toHaveBeenCalledWith(1)
      expect(stages).toEqual([
        'approving',
        'waitingApproval',
        'supplying',
        'waitingConfirmation',
      ])
      expect(result).toMatchObject({
        txHash: '0xsupplyhash',
        approvalTxHash: '0xapprovalhash',
      })
      expect(result.txReceipt).not.toBeNull()
    })

    it('skips approval when the existing allowance is sufficient', async () => {
      mockToken.allowance.mockResolvedValue(10_000_000n)

      const result = await deposit(mockPrivateKey, 'aEthUSDC', '10', {
        waitForConfirmation: false,
      })

      expect(mockToken.approve).not.toHaveBeenCalled()
      expect(mockPool.supply).toHaveBeenCalled()
      expect(supplyTx.wait).not.toHaveBeenCalled()
      expect(result.approvalTxHash).toBeUndefined()
      expect(result.txReceipt).toBeNull()
    })

    it('resets a stale non-zero allowance before approving the amount', async () => {
      const resetTx = createTx('0xresethash')
      const approvalTx = createTx('0xapprovalhash')
      mockToken.allowance.mockResolvedValue(1n)
      mockToken.approve
        .mockResolvedValueOnce(resetTx)
        .mockResolvedValueOnce(approvalTx)
      const stages: string[] = []

      const result = await deposit(mockPrivateKey, 'aEthUSDC', '10', {
        onStage: stage => stages.push(stage),
      })

      expect(mockToken.approve).toHaveBeenCalledTimes(2)
      expect(mockToken.approve).toHaveBeenNthCalledWith(1, POOL_ADDRESS, 0n, expect.any(Object))
      expect(mockToken.approve).toHaveBeenNthCalledWith(
        2,
        POOL_ADDRESS,
        10_000_000n,
        expect.any(Object)
      )
      expect(resetTx.wait).toHaveBeenCalledWith(1)
      expect(approvalTx.wait).toHaveBeenCalledWith(1)
      expect(result.approvalTxHash).toBe('0xapprovalhash')
      expect(stages).toEqual([
        'approving',
        'waitingApproval',
        'supplying',
        'waitingConfirmation',
      ])
    })

    it('uses a supplied gas limit without estimating', async () => {
      mockToken.allowance.mockResolvedValue(10_000_000n)

      await deposit(mockPrivateKey, 'aEthUSDC', '10', { gasLimit: 500_000n })

      expect(mockPool.supply.estimateGas).not.toHaveBeenCalled()
      expect(mockPool.supply).toHaveBeenCalledWith(
        USDC_ADDRESS,
        10_000_000n,
        mockWalletAddress,
        0,
        expect.objectContaining({ gasLimit: 500_000n })
      )
    })

    it('uses a buffered legacy gas price when EIP-1559 fees are unavailable', async () => {
      mockToken.allowance.mockResolvedValue(10_000_000n)
      mockProvider.getFeeData.mockResolvedValue({
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
        gasPrice: 2_000_000_000n,
      })

      await deposit(mockPrivateKey, 'aEthUSDC', '10')

      expect(mockPool.supply).toHaveBeenCalledWith(
        USDC_ADDRESS,
        10_000_000n,
        mockWalletAddress,
        0,
        { gasPrice: 2_200_000_000n, gasLimit: 120_000n }
      )
    })

    it('uses the receipt token decimals for 18-decimal underlyings', async () => {
      mockToken.allowance.mockResolvedValue(1n)

      await deposit(mockPrivateKey, 'aWETH', '1.5')

      expect(mockPool.supply).toHaveBeenCalledWith(
        WETH_ADDRESS,
        ethers.parseEther('1.5'),
        mockWalletAddress,
        0,
        expect.any(Object)
      )
    })

    it('rejects unknown receipt tokens', async () => {
      await expect(deposit(mockPrivateKey, 'UNKNOWN', '1')).rejects.toThrow(
        'Token not found: UNKNOWN'
      )
    })

    it('rejects tokens that are not interest-bearing', async () => {
      await expect(deposit(mockPrivateKey, 'USDC', '1')).rejects.toThrow(
        'USDC is not an interest-bearing token'
      )
    })

    it('rejects unsupported interest-bearing protocols', async () => {
      await expect(deposit(mockPrivateKey, 'cToken', '1')).rejects.toThrow(
        'Unsupported interest-bearing protocol: compound'
      )
    })

    it('rejects missing underlying tokens', async () => {
      await expect(deposit(mockPrivateKey, 'brokenUnderlying', '1')).rejects.toThrow(
        'Underlying token not found: MISSING'
      )
    })

    it('rejects invalid pool addresses', async () => {
      await expect(deposit(mockPrivateKey, 'invalidPool', '1')).rejects.toThrow(
        'Invalid Aave Pool address: not-an-address'
      )
    })

    it('validates the amount before touching the provider', async () => {
      await expect(deposit(mockPrivateKey, 'aEthUSDC', 'abc')).rejects.toThrow(
        'Invalid amount: abc'
      )
      await expect(deposit(mockPrivateKey, 'aEthUSDC', '0')).rejects.toThrow(
        'Amount must be greater than 0'
      )
      await expect(deposit(mockPrivateKey, 'aEthUSDC', '1.1234567')).rejects.toThrow(
        'Invalid amount for USDC: maximum 6 decimal places'
      )

      expect(mockedGetProvider).not.toHaveBeenCalled()
    })

    it('rejects a failed supply transaction', async () => {
      mockToken.allowance.mockResolvedValue(10_000_000n)
      supplyTx.wait.mockResolvedValue({ blockNumber: 2, gasUsed: 100_000n, status: 0 })

      await expect(deposit(mockPrivateKey, 'aEthUSDC', '10')).rejects.toThrow(
        'Transaction failed! Status: 0, Hash: 0xsupplyhash'
      )
    })
  })

  describe('withdraw', () => {
    it('withdraws the requested receipt-token amount', async () => {
      const stages: string[] = []

      const result = await withdraw(mockPrivateKey, 'aEthUSDC', '2.5', {
        onStage: stage => stages.push(stage),
      })

      expect(mockPool.withdraw.estimateGas).toHaveBeenCalledWith(
        USDC_ADDRESS,
        2_500_000n,
        mockWalletAddress
      )
      expect(mockPool.withdraw).toHaveBeenCalledWith(
        USDC_ADDRESS,
        2_500_000n,
        mockWalletAddress,
        {
          maxFeePerGas: 1_100_000_000n,
          maxPriorityFeePerGas: 110_000_000n,
          type: 2,
          gasLimit: 120_000n,
        }
      )
      expect(withdrawTx.wait).toHaveBeenCalledWith(1)
      expect(stages).toEqual(['withdrawing', 'waitingConfirmation'])
      expect(result.txHash).toBe('0xwithdrawhash')
      expect(result.txReceipt).not.toBeNull()
    })

    it('uses MaxUint256 for a max withdrawal', async () => {
      const result = await withdraw(mockPrivateKey, 'aEthUSDC', 'max', {
        waitForConfirmation: false,
      })

      expect(mockPool.withdraw).toHaveBeenCalledWith(
        USDC_ADDRESS,
        ethers.MaxUint256,
        mockWalletAddress,
        expect.objectContaining({ gasLimit: 120_000n })
      )
      expect(withdrawTx.wait).not.toHaveBeenCalled()
      expect(result.txReceipt).toBeNull()
    })

    it('uses the receipt token decimals to parse the amount', async () => {
      await expect(withdraw(mockPrivateKey, 'aEthUSDC', '1.1234567')).rejects.toThrow(
        'Invalid amount for aEthUSDC: maximum 6 decimal places'
      )

      expect(mockPool.withdraw).not.toHaveBeenCalled()
    })
  })
})
