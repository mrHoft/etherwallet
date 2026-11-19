import { TronWeb } from 'tronweb'
import { claim, deposit, withdraw } from '~/api/tron/sTRX'
import { TOKEN_INFO } from '~/api/tron/config'

jest.mock('tronweb', () => ({
  TronWeb: jest.fn(),
}))

const OWNER_ADDRESS = 'TNXoiAJ3dct8Fjg4M9fkLFh9S2v9TXc32G'
const STRX_ADDRESS = TOKEN_INFO.sTRX.contractAddress as string
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

describe('tron sTRX', () => {
  const mockedTronWeb = TronWeb as unknown as jest.Mock

  let mockTronWeb: {
    defaultAddress: { base58: string | false }
    trx: { getTransactionInfo: jest.Mock }
    contract: jest.Mock
  }
  let mockStrx: {
    methods: {
      deposit: jest.Mock
      withdraw: jest.Mock
      claim: jest.Mock
      balanceOf: jest.Mock
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockStrx = {
      methods: {
        deposit: jest.fn(() => createSend('deposit-tx')),
        withdraw: jest.fn(() => createSend('withdraw-tx')),
        claim: jest.fn(() => createSend('claim-tx')),
        balanceOf: jest.fn(() => createCall(0n)),
      },
    }

    mockTronWeb = {
      defaultAddress: { base58: OWNER_ADDRESS },
      trx: {
        getTransactionInfo: jest.fn(async (txId: string) => ({
          id: txId,
          result: 'SUCCESS',
          receipt: { result: 'SUCCESS' },
          contractResult: [],
        })),
      },
      contract: jest.fn((_abi: unknown, address: string) => {
        if (address === STRX_ADDRESS) return mockStrx
        throw new Error(`Unexpected contract address: ${address}`)
      }),
    }

    mockedTronWeb.mockImplementation(() => mockTronWeb)
  })

  describe('deposit', () => {
    it('sends TRX to the payable deposit method', async () => {
      const stages: string[] = []

      const result = await deposit(PRIVATE_KEY, '10', {
        onStage: stage => stages.push(stage),
      })

      expect(mockStrx.methods.deposit).toHaveBeenCalledWith()
      const send = mockStrx.methods.deposit.mock.results[0].value.send as jest.Mock
      expect(send).toHaveBeenCalledWith({
        feeLimit: 150_000_000,
        callValue: 10_000_000,
      })
      expect(stages).toEqual(['depositing', 'waitingConfirmation'])
      expect(result.txId).toBe('deposit-tx')
      expect(result.transactionInfo?.id).toBe('deposit-tx')
    })

    it('does not wait for confirmation when asked', async () => {
      const result = await deposit(PRIVATE_KEY, '10', {
        waitForConfirmation: false,
      })

      expect(mockTronWeb.trx.getTransactionInfo).not.toHaveBeenCalled()
      expect(result.txId).toBe('deposit-tx')
      expect(result.transactionInfo).toBeNull()
    })

    it('validates the amount before creating a TronWeb instance', async () => {
      await expect(deposit(PRIVATE_KEY, 'abc')).rejects.toThrow('Invalid amount: abc')
      await expect(deposit(PRIVATE_KEY, '0')).rejects.toThrow('Amount must be greater than 0')
      await expect(deposit(PRIVATE_KEY, '1.1234567')).rejects.toThrow(
        'Invalid amount for TRX: maximum 6 decimal places'
      )

      expect(mockedTronWeb).not.toHaveBeenCalled()
    })

    it('rejects an invalid private key', async () => {
      await expect(deposit('not-a-key', '1')).rejects.toThrow('Invalid Tron private key')

      expect(mockedTronWeb).not.toHaveBeenCalled()
    })

    it('rejects a failed transaction', async () => {
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
      await deposit(PRIVATE_KEY, '10', { feeLimit: 250_000_000 })

      const send = mockStrx.methods.deposit.mock.results[0].value.send as jest.Mock
      expect(send).toHaveBeenCalledWith({
        feeLimit: 250_000_000,
        callValue: 10_000_000,
      })
    })
  })

  describe('withdraw', () => {
    it('burns sTRX by calling withdraw', async () => {
      const stages: string[] = []

      const result = await withdraw(PRIVATE_KEY, '2.5', {
        onStage: stage => stages.push(stage),
      })

      expect(mockStrx.methods.withdraw).toHaveBeenCalledWith(
        2_500_000_000_000_000_000n
      )
      expect(stages).toEqual(['withdrawing', 'waitingConfirmation'])
      expect(result.txId).toBe('withdraw-tx')
      expect(result.transactionInfo?.id).toBe('withdraw-tx')
    })

    it('withdraws the full sTRX balance for max', async () => {
      mockStrx.methods.balanceOf.mockReturnValue(
        createCall(5_000_000_000_000_000_000n)
      )

      await withdraw(PRIVATE_KEY, 'max')

      expect(mockStrx.methods.balanceOf).toHaveBeenCalledWith(OWNER_ADDRESS)
      expect(mockStrx.methods.withdraw).toHaveBeenCalledWith(
        5_000_000_000_000_000_000n
      )
    })

    it('rejects a max withdrawal with no sTRX balance', async () => {
      await expect(withdraw(PRIVATE_KEY, 'max')).rejects.toThrow(
        'Amount must be greater than 0'
      )

      expect(mockStrx.methods.withdraw).not.toHaveBeenCalled()
    })

    it('uses sTRX decimals to parse the amount', async () => {
      await expect(withdraw(PRIVATE_KEY, '1.1234567890123456789')).rejects.toThrow(
        'Invalid amount for sTRX: maximum 18 decimal places'
      )

      expect(mockStrx.methods.withdraw).not.toHaveBeenCalled()
    })

    it('does not wait for confirmation when asked', async () => {
      const result = await withdraw(PRIVATE_KEY, '1', {
        waitForConfirmation: false,
      })

      expect(mockTronWeb.trx.getTransactionInfo).not.toHaveBeenCalled()
      expect(result.transactionInfo).toBeNull()
    })
  })

  describe('claim', () => {
    it('claims matured unstaked TRX', async () => {
      const stages: string[] = []

      const result = await claim(PRIVATE_KEY, {
        onStage: stage => stages.push(stage),
      })

      expect(mockStrx.methods.claim).toHaveBeenCalledWith()
      expect(stages).toEqual(['claiming', 'waitingConfirmation'])
      expect(result.txId).toBe('claim-tx')
    })
  })
})
