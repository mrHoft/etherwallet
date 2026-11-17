jest.mock('~/api/env', () => ({
  env: {
    VITE_ETHERSCAN_API_KEY: 'fallback-key',
  },
}))

jest.mock('~/utils/storage', () => ({
  storage: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
}))

const jsonResponse = (data: unknown, ok = true, status = 200): Response => ({
  ok,
  status,
  json: jest.fn().mockResolvedValue(data),
} as unknown as Response)

describe('etherscan', () => {
  let etherscan: typeof import('~/api/etherscan')
  let storage: {
    get: jest.Mock
    set: jest.Mock
    remove: jest.Mock
  }
  let fetchMock: jest.Mock
  let consoleError: jest.SpyInstance

  beforeEach(async () => {
    jest.resetModules()
    jest.clearAllMocks()

    fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

    etherscan = await import('~/api/etherscan')
    storage = (await import('~/utils/storage')).storage as unknown as typeof storage
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete (global as { fetch?: unknown }).fetch
  })

  describe('api key', () => {
    it('returns a stored string key', () => {
      storage.get.mockReturnValue('  stored-key  ')

      expect(etherscan.getStoredEtherscanApiKey()).toBe('  stored-key  ')
      expect(storage.get).toHaveBeenCalledWith('etherscanApiKey')
    })

    it('ignores stored values that are not strings', () => {
      storage.get.mockReturnValue(42)

      expect(etherscan.getStoredEtherscanApiKey()).toBe('')
    })

    it('trims the key before storing it', () => {
      etherscan.setEtherscanApiKey('  new-key  ')

      expect(storage.set).toHaveBeenCalledWith('etherscanApiKey', 'new-key')
    })

    it('prefers the trimmed stored key over the environment fallback', () => {
      storage.get.mockReturnValue('  stored-key  ')

      expect(etherscan.getEtherscanApiKey()).toBe('stored-key')
    })

    it('falls back to the environment key when no stored key exists', () => {
      storage.get.mockReturnValue(undefined)

      expect(etherscan.getEtherscanApiKey()).toBe('fallback-key')
    })

    it('falls back to the environment key when the stored key is blank', () => {
      storage.get.mockReturnValue('   ')

      expect(etherscan.getEtherscanApiKey()).toBe('fallback-key')
    })
  })

  describe('getTokenHistory', () => {
    it('requires a contract address', async () => {
      await expect(etherscan.getTokenHistory('0xwallet', '')).rejects.toThrow(
        'Contract address is required'
      )
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('requests token transfers and returns the result array', async () => {
      const transactions = [
        { hash: '0xhash1', tokenSymbol: 'USDC' },
        { hash: '0xhash2', tokenSymbol: 'USDT' },
      ]
      fetchMock.mockResolvedValue(jsonResponse({ status: '1', result: transactions }))

      const result = await etherscan.getTokenHistory('0xwallet', '0xcontract', 5, 2)

      expect(result).toEqual(transactions)
      expect(fetchMock).toHaveBeenCalledTimes(1)

      const url = new URL(fetchMock.mock.calls[0][0] as string)
      expect(`${url.origin}${url.pathname}`).toBe('https://api.etherscan.io/v2/api')
      expect(url.searchParams.get('apikey')).toBe('fallback-key')
      expect(url.searchParams.get('chainid')).toBe('1')
      expect(url.searchParams.get('module')).toBe('account')
      expect(url.searchParams.get('action')).toBe('tokentx')
      expect(url.searchParams.get('address')).toBe('0xwallet')
      expect(url.searchParams.get('contractaddress')).toBe('0xcontract')
      expect(url.searchParams.get('startblock')).toBe('25000000')
      expect(url.searchParams.get('sort')).toBe('desc')
      expect(url.searchParams.get('offset')).toBe('5')
      expect(url.searchParams.get('page')).toBe('2')
    })

    it('prefixes addresses that do not start with 0x', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ status: '1', result: [] }))

      await etherscan.getTokenHistory('wallet-without-prefix', 'contract-without-prefix')

      const url = new URL(fetchMock.mock.calls[0][0] as string)
      expect(url.searchParams.get('address')).toBe('0xwallet-without-prefix')
      expect(url.searchParams.get('contractaddress')).toBe('contract-without-prefix')
      expect(url.searchParams.get('offset')).toBe('10')
      expect(url.searchParams.get('page')).toBe('1')
    })

    it('uses the stored API key when one is configured', async () => {
      storage.get.mockReturnValue('stored-key')
      fetchMock.mockResolvedValue(jsonResponse({ status: '1', result: [] }))

      await etherscan.getTokenHistory('0xwallet', '0xcontract')

      const url = new URL(fetchMock.mock.calls[0][0] as string)
      expect(url.searchParams.get('apikey')).toBe('stored-key')
    })

    it('returns an empty array when the response has no result', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ status: '1' }))

      await expect(
        etherscan.getTokenHistory('0xwallet', '0xcontract')
      ).resolves.toEqual([])
    })

    it('returns an empty array when the response result is not an array', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ status: '1', result: 'unexpected' }))

      await expect(
        etherscan.getTokenHistory('0xwallet', '0xcontract')
      ).resolves.toEqual([])
    })

    it('accepts an empty result for a non-success status', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ status: '0', message: 'No transactions found', result: [] })
      )

      await expect(
        etherscan.getTokenHistory('0xwallet', '0xcontract')
      ).resolves.toEqual([])
    })

    it('throws the Etherscan error message for a failed request', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ status: '0', message: 'NOTOK', result: 'Invalid address' })
      )

      await expect(
        etherscan.getTokenHistory('0xwallet', '0xcontract')
      ).rejects.toThrow('NOTOK')
      expect(consoleError).toHaveBeenCalled()
    })

    it('throws when the HTTP request fails', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, false, 500))

      await expect(
        etherscan.getTokenHistory('0xwallet', '0xcontract')
      ).rejects.toThrow('HTTP error! status: 500')
    })

    it('propagates network errors', async () => {
      fetchMock.mockRejectedValue(new Error('network down'))

      await expect(
        etherscan.getTokenHistory('0xwallet', '0xcontract')
      ).rejects.toThrow('network down')
    })

    it('serializes queued requests', async () => {
      fetchMock.mockImplementation((url: string) =>
        Promise.resolve(
          jsonResponse({
            status: '1',
            result: [{ hash: url.includes('contract1') ? '0xhash1' : '0xhash2' }],
          })
        )
      )

      const [first, second] = await Promise.all([
        etherscan.getTokenHistory('0xwallet', 'contract1'),
        etherscan.getTokenHistory('0xwallet', 'contract2'),
      ])

      expect(first).toEqual([{ hash: '0xhash1' }])
      expect(second).toEqual([{ hash: '0xhash2' }])
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })
})
