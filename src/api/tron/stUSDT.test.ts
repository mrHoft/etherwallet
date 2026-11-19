import { TronWeb } from 'tronweb'
import { claimWithdrawals, deposit, withdraw } from '~/api/tron/stUSDT'
import {
  STUSDT_MINTER_ADDRESS,
  STUSDT_UNSTAKING_ADDRESS,
  TOKEN_INFO,
} from '~/api/tron/config'

jest.mock('tronweb', () => ({
  TronWeb: jest.fn(),
}))

const OWNER_ADDRESS = 'TNXoiAJ3dct8Fjg4M9fkLFh9S2v9TXc32G'
const USDT_ADDRESS = TOKEN_INFO.USDT.contractAddress as string
const STUSDT_ADDRESS = TOKEN_INFO.stUSDT.contractAddress as string
const PRIVATE_KEY = '0x0123456789012345678901234567890123456789012345678901234567890123'

interface MockMethod {
  call: jest.Mock
  send: jest.Mock
}

const createCall = (value: unknown): MockMethod => ({
  call: jest.fn().mockResolvedValue(value),
  send: jest.fn(),
})

const createSend = (txId: string): MockMethod => ({
  call: jest.fn(),
  send: jest.fn().mockResolvedValue(txId),
})

describe('tron stUSDT', () => {
  const mockedTronWeb = TronWeb as unknown as jest.Mock

  let mockTronWeb: {
    defaultAddress: { base58: string | false }
    trx: { getTransactionInfo: jest.Mock }
    contract: jest.Mock
  }
  let mockUsdt: {
    methods: {
      allowance: jest.Mock
      approve: jest.Mock
      balanceOf: jest.Mock
    }
  }
  let mockStUsdt: {
    methods: {
      allowance: jest.Mock
      approve: jest.Mock
      balanceOf: jest.Mock
    }
  }
  let mockMinter: {
    methods: {
      submit: jest.Mock
    }
  }
  let mockUnstaking: {
    methods: {
      requestWithdrawal: jest.Mock
      claimWithdrawals: jest.Mock
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockUsdt = {
      methods: {
        allowance: jest.fn(() => createCall(0n)),
        approve: jest.fn(() => createSend('approval-usdt-tx')),
        balanceOf: jest.fn(() => createCall(0n)),
      },
    }
    mockStUsdt = {
      methods: {
        allowance: jest.fn(() => createCall(0n)),
        approve: jest.fn(() => createSend('approval-stusdt-tx')),
        balanceOf: jest.fn(() => createCall(0n)),
      },
    }
    mockMinter = {
      methods: {
        submit: jest.fn(() => createSend('deposit-tx')),
      },
    }
    mockUnstaking = {
      methods: {
        requestWithdrawal: jest.fn(() => createSend('withdraw-tx')),
        claimWithdrawals: jest.fn(() => createSend('claim-tx')),
      },
    }

    mockTronWeb = {
      defaultAddress: { base58: OWNER_ADDRESS },
      trx: {
        getTransactionInfo: jest.fn(async (txId: string) => ({
          id: txId,
          result: 'SUCCESS',
          receipt: { result: 'SUCCESS' },
          contractResult: txId === 'withdraw-tx' ? [`${'0'.repeat(63)}2`] : [],
        })),
      },
      contract: jest.fn((_abi: unknown, address: string) => {
        if (address === USDT_ADDRESS) return mockUsdt
        if (address === STUSDT_ADDRESS) return mockStUsdt
        if (address === STUSDT_MINTER_ADDRESS) return mockMinter
        if (address === STUSDT_UNSTAKING_ADDRESS) return mockUnstaking
        throw new Error(`Unexpected contract address: ${address}`)
      }),
    }

    mockedTronWeb.mockImplementation(() => mockTronWeb)
  })

  describe('deposit', () => {
    it('approves USDT and submits it to the stUSDT minter', async () => {
      const stages: string[] = []

      const result = await deposit(PRIVATE_KEY, '10', {
        onStage: stage => stages.push(stage),
      })

      expect(mockUsdt.methods.allowance).toHaveBeenCalledWith(
        OWNER_ADDRESS,
        STUSDT_MINTER_ADDRESS
      )
      expect(mockUsdt.methods.approve).toHaveBeenCalledWith(
        STUSDT_MINTER_ADDRESS,
        10_000_000n
      )
      expect(mockMinter.methods.submit).toHaveBeenCalledWith(10_000_000n)
      expect(stages).toEqual([
        'approving',
        'waitingApproval',
        'depositing',
        'waitingConfirmation',
      ])
      expect(result).toMatchObject({
        txId: 'deposit-tx',
        approvalTxId: 'approval-usdt-tx',
      })
      expect(result.transactionInfo?.id).toBe('deposit-tx')
    })

    it('skips approval when the existing allowance is sufficient', async () => {
      mockUsdt.methods.allowance.mockReturnValue(createCall(10_000_000n))

      const result = await deposit(PRIVATE_KEY, '10', {
        waitForConfirmation: false,
      })

      expect(mockUsdt.methods.approve).not.toHaveBeenCalled()
      expect(result.approvalTxId).toBeUndefined()
      expect(result.transactionInfo).toBeNull()
      expect(mockTronWeb.trx.getTransactionInfo).not.toHaveBeenCalled()
    })

    it('waits for the approval even when the deposit is not awaited', async () => {
      const result = await deposit(PRIVATE_KEY, '10', {
        waitForConfirmation: false,
      })

      expect(mockTronWeb.trx.getTransactionInfo).toHaveBeenCalledWith('approval-usdt-tx')
      expect(mockTronWeb.trx.getTransactionInfo).not.toHaveBeenCalledWith('deposit-tx')
      expect(result.approvalTxId).toBe('approval-usdt-tx')
      expect(result.transactionInfo).toBeNull()
    })

    it('validates the amount before creating a TronWeb instance', async () => {
      await expect(deposit(PRIVATE_KEY, 'abc')).rejects.toThrow('Invalid amount: abc')
      await expect(deposit(PRIVATE_KEY, '0')).rejects.toThrow('Amount must be greater than 0')
      await expect(deposit(PRIVATE_KEY, '1.1234567')).rejects.toThrow(
        'Invalid amount for USDT: maximum 6 decimal places'
      )

      expect(mockedTronWeb).not.toHaveBeenCalled()
    })

    it('rejects an invalid private key', async () => {
      await expect(deposit('not-a-key', '1')).rejects.toThrow('Invalid Tron private key')

      expect(mockedTronWeb).not.toHaveBeenCalled()
    })

    it('rejects a failed transaction', async () => {
      mockUsdt.methods.allowance.mockReturnValue(createCall(10_000_000n))
      mockTronWeb.trx.getTransactionInfo.mockResolvedValue({
        id: 'deposit-tx',
        result: 'FAILED',
        receipt: { result: 'REVERT' },
        contractResult: [],
      })

      await expect(deposit(PRIVATE_KEY, '10')).rejects.toThrow(
        'Transaction failed: deposit-tx'
      )
    })

    it('uses a custom fee limit', async () => {
      mockUsdt.methods.allowance.mockReturnValue(createCall(10_000_000n))

      await deposit(PRIVATE_KEY, '10', { feeLimit: 250_000_000 })

      const send = mockMinter.methods.submit.mock.results[0].value.send as jest.Mock
      expect(send).toHaveBeenCalledWith({ feeLimit: 250_000_000 })
    })
  })

  describe('withdraw', () => {
    it('approves stUSDT and requests a withdrawal', async () => {
      const stages: string[] = []

      const result = await withdraw(PRIVATE_KEY, '2.5', {
        onStage: stage => stages.push(stage),
      })

      expect(mockStUsdt.methods.allowance).toHaveBeenCalledWith(
        OWNER_ADDRESS,
        STUSDT_UNSTAKING_ADDRESS
      )
      expect(mockStUsdt.methods.approve).toHaveBeenCalledWith(
        STUSDT_UNSTAKING_ADDRESS,
        2_500_000_000_000_000_000n
      )
      expect(mockUnstaking.methods.requestWithdrawal).toHaveBeenCalledWith(
        2_500_000_000_000_000_000n
      )
      expect(stages).toEqual([
        'approving',
        'waitingApproval',
        'withdrawing',
        'waitingConfirmation',
      ])
      expect(result).toMatchObject({
        txId: 'withdraw-tx',
        approvalTxId: 'approval-stusdt-tx',
        requestId: 2n,
      })
    })

    it('withdraws the full stUSDT balance for max', async () => {
      mockStUsdt.methods.balanceOf.mockReturnValue(createCall(5_000_000_000_000_000_000n))

      await withdraw(PRIVATE_KEY, 'max')

      expect(mockStUsdt.methods.approve).toHaveBeenCalledWith(
        STUSDT_UNSTAKING_ADDRESS,
        5_000_000_000_000_000_000n
      )
      expect(mockUnstaking.methods.requestWithdrawal).toHaveBeenCalledWith(
        5_000_000_000_000_000_000n
      )
    })

    it('rejects a max withdrawal with no stUSDT balance', async () => {
      await expect(withdraw(PRIVATE_KEY, 'max')).rejects.toThrow(
        'Amount must be greater than 0'
      )

      expect(mockStUsdt.methods.approve).not.toHaveBeenCalled()
    })

    it('uses stUSDT decimals to parse the amount', async () => {
      await expect(withdraw(PRIVATE_KEY, '1.1234567890123456789')).rejects.toThrow(
        'Invalid amount for stUSDT: maximum 18 decimal places'
      )

      expect(mockUnstaking.methods.requestWithdrawal).not.toHaveBeenCalled()
    })
  })

  describe('claimWithdrawals', () => {
    it('claims the provided request ids', async () => {
      const stages: string[] = []

      const result = await claimWithdrawals(PRIVATE_KEY, [1, '2', 3n], {
        onStage: stage => stages.push(stage),
      })

      expect(mockUnstaking.methods.claimWithdrawals).toHaveBeenCalledWith([1n, 2n, 3n])
      expect(stages).toEqual(['claiming', 'waitingConfirmation'])
      expect(result.txId).toBe('claim-tx')
    })

    it('requires at least one request id', async () => {
      await expect(claimWithdrawals(PRIVATE_KEY, [])).rejects.toThrow(
        'At least one withdrawal request id is required'
      )

      expect(mockedTronWeb).not.toHaveBeenCalled()
    })
  })
})
