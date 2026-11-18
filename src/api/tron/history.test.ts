jest.mock('~/api/env', () => ({ env: { VITE_TRONGRID_API_KEY: 'fallback-tron-key' } }))

jest.mock('~/utils/storage', () => ({
  storage: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
}))

import { toTronBase58Address } from '~/api/tron/address'

const BASE58_ADDRESS = 'TNXoiAJ3dct8Fjg4M9fkLFh9S2v9TXc32G'
const OTHER_ADDRESS = 'TPtKNQuP9goF725MLLvtF3smX9SaAs2SuR'
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

const jsonResponse = (data: unknown, ok = true, status = 200): Response => ({
  ok,
  status,
  json: jest.fn().mockResolvedValue(data),
} as unknown as Response)

describe('tron history', () => {
  let history: typeof import('~/api/tron/history')
  let storage: {
    get: jest.Mock
    set: jest.Mock
    remove: jest.Mock
  }
  let fetchMock: jest.Mock

  beforeEach(async () => {
    jest.resetModules()
    jest.clearAllMocks()

    fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch

    history = await import('~/api/tron/history')
    storage = (await import('~/utils/storage')).storage as unknown as typeof storage
  })

  afterEach(() => {
    delete (global as { fetch?: unknown }).fetch
  })

  describe('api key', () => {
    it('returns a stored string key', () => {
      storage.get.mockReturnValue('  stored-key  ')

      expect(history.getStoredTronGridApiKey()).toBe('  stored-key  ')
      expect(storage.get).toHaveBeenCalledWith('trongridApiKey')
    })

    it('ignores stored values that are not strings', () => {
      storage.get.mockReturnValue(42)

      expect(history.getStoredTronGridApiKey()).toBe('')
    })

    it('trims the key before storing it', () => {
      history.setTronGridApiKey('  new-key  ')

      expect(storage.set).toHaveBeenCalledWith('trongridApiKey', 'new-key')
    })

    it('prefers the trimmed stored key over the environment fallback', () => {
      storage.get.mockReturnValue('  stored-key  ')

      expect(history.getTronGridApiKey()).toBe('stored-key')
    })

    it('falls back to the environment key when no stored key exists', () => {
      storage.get.mockReturnValue(undefined)

      expect(history.getTronGridApiKey()).toBe('fallback-tron-key')
    })

    it('falls back to the environment key when the stored key is blank', () => {
      storage.get.mockReturnValue('   ')

      expect(history.getTronGridApiKey()).toBe('fallback-tron-key')
    })

    it('sends the stored key in the TRON-PRO-API-KEY header', async () => {
      storage.get.mockReturnValue('stored-key')
      fetchMock.mockResolvedValue(jsonResponse({ success: true, data: [], meta: {} }))

      await history.getTokenHistory(BASE58_ADDRESS, 'USDT')

      expect(fetchMock.mock.calls[0][1]).toMatchObject({
        headers: { 'TRON-PRO-API-KEY': 'stored-key' },
      })
    })

    it('sends the environment key when no stored key exists', async () => {
      storage.get.mockReturnValue(undefined)
      fetchMock.mockResolvedValue(jsonResponse({ success: true, data: [], meta: {} }))

      await history.getTokenHistory(BASE58_ADDRESS, 'USDT')

      expect(fetchMock.mock.calls[0][1]).toMatchObject({
        headers: { 'TRON-PRO-API-KEY': 'fallback-tron-key' },
      })
    })
  })

  it('maps TRC20 transfers and returns the next fingerprint', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      success: true,
      data: [
        {
          transaction_id: 'incoming-tx',
          block_timestamp: 1_700_000_000_000,
          from: OTHER_ADDRESS,
          to: BASE58_ADDRESS,
          value: '2000000',
          type: 'Transfer',
          token_info: { decimals: 6 },
        },
        {
          transaction_id: 'outgoing-tx',
          block_timestamp: 1_699_999_999_000,
          from: BASE58_ADDRESS,
          to: OTHER_ADDRESS,
          value: '500000',
          type: 'Transfer',
          token_info: { decimals: 6 },
        },
        {
          transaction_id: 'approval-tx',
          from: BASE58_ADDRESS,
          to: USDT_CONTRACT,
          value: '0',
          type: 'Approval',
        },
      ],
      meta: { fingerprint: 'next-page' },
    }))

    const page = await history.getTokenHistory(BASE58_ADDRESS, 'USDT')

    expect(page.nextFingerprint).toBe('next-page')
    expect(page.transactions).toEqual([
      {
        hash: 'incoming-tx',
        timestamp: 1_700_000_000,
        from: OTHER_ADDRESS,
        to: BASE58_ADDRESS,
        value: '2000000',
        decimals: 6,
        direction: 'incoming',
        type: 'Transfer',
      },
      {
        hash: 'outgoing-tx',
        timestamp: 1_699_999_999,
        from: BASE58_ADDRESS,
        to: OTHER_ADDRESS,
        value: '500000',
        decimals: 6,
        direction: 'outgoing',
        type: 'Transfer',
      },
    ])
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.trongrid.io/v1/accounts/${BASE58_ADDRESS}/transactions/trc20?limit=10&only_confirmed=true&contract_address=${USDT_CONTRACT}`
    )
  })

  it('maps native TRX transfers and filters other contract types', async () => {
    const ownerHex = '41c0c07f3f5b517d39bfa7a600f5d5808725772164'
    const ownerAddress = toTronBase58Address(ownerHex)

    fetchMock.mockResolvedValue(jsonResponse({
      success: true,
      data: [
        {
          txID: 'native-tx',
          block_timestamp: 1_794_924_522_000,
          ret: [{ contractRet: 'SUCCESS' }],
          raw_data: {
            contract: [{
              type: 'TransferContract',
              parameter: {
                value: {
                  amount: 1,
                  owner_address: ownerHex,
                  to_address: '4189cbcb2372e1c2fbc00f24895a406a0c722c89f3',
                },
              },
            }],
          },
        },
        {
          txID: 'contract-tx',
          block_timestamp: 1_794_924_000_000,
          ret: [{ contractRet: 'SUCCESS' }],
          raw_data: {
            contract: [{
              type: 'TriggerSmartContract',
              parameter: { value: { owner_address: ownerHex } },
            }],
          },
        },
      ],
      meta: {},
    }))

    const page = await history.getTokenHistory(BASE58_ADDRESS, 'TRX')

    expect(page.transactions).toEqual([
      {
        hash: 'native-tx',
        timestamp: 1_794_924_522,
        from: ownerAddress,
        to: BASE58_ADDRESS,
        value: '1',
        decimals: 6,
        direction: 'incoming',
        type: 'Transfer',
      },
    ])
    expect(page.nextFingerprint).toBeNull()
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.trongrid.io/v1/accounts/${BASE58_ADDRESS}/transactions?limit=10&only_confirmed=true`
    )
  })

  it('passes the fingerprint for the next page', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: [], meta: {} }))

    await history.getTokenHistory(BASE58_ADDRESS, 'USDT', 10, 'cursor-token')

    expect(fetchMock.mock.calls[0][0]).toContain('fingerprint=cursor-token')
  })

  it('throws on HTTP and API errors', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 429))
    await expect(history.getTokenHistory(BASE58_ADDRESS, 'USDT')).rejects.toThrow(
      'TronGrid request failed with status 429'
    )

    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, Error: 'bad request' }))
    await expect(history.getTokenHistory(BASE58_ADDRESS, 'USDT')).rejects.toThrow('bad request')
  })

  it('rejects invalid addresses and unknown symbols', async () => {
    await expect(history.getTokenHistory('not-an-address', 'USDT')).rejects.toThrow(
      'Invalid Tron address'
    )
    await expect(history.getTokenHistory(BASE58_ADDRESS, 'NOPE')).rejects.toThrow(
      'Unknown token symbol'
    )
  })
})
