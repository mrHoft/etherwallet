jest.mock('~/api/tron/provider', () => ({
  rpcProvider: { getProvider: jest.fn() },
}))

jest.mock('~/api/tron/tokenPrice', () => ({
  getTokenPrices: jest.fn(),
}))

import { Interface } from 'ethers'

const BASE58_ADDRESS = 'TNXoiAJ3dct8Fjg4M9fkLFh9S2v9TXc32G'
const HEX_ADDRESS = '0x89cbcb2372e1c2fbc00f24895a406a0c722c89f3'
const USDT_CONTRACT = '0xa614f803b6fd780986a42c78ec9c7f77e6ded13c'
const TRC20_INTERFACE = new Interface(['function balanceOf(address) view returns (uint256)'])

describe('tron balances', () => {
  let balances: typeof import('~/api/tron/balances')
  let rpcProvider: { getProvider: jest.Mock }
  let getTokenPrices: jest.Mock
  let provider: { getBalance: jest.Mock; call: jest.Mock }

  beforeEach(async () => {
    jest.resetModules()
    jest.clearAllMocks()

    provider = {
      getBalance: jest.fn(),
      call: jest.fn(),
    }

    balances = await import('~/api/tron/balances')
    rpcProvider = (await import('~/api/tron/provider')).rpcProvider as unknown as {
      getProvider: jest.Mock
    }
    getTokenPrices = (await import('~/api/tron/tokenPrice')).getTokenPrices as jest.Mock

    rpcProvider.getProvider.mockReturnValue(provider)
    getTokenPrices.mockResolvedValue({ TRX: 0.3, USDT: 1 })
  })

  it('formats native and TRC20 balances with USD values', async () => {
    provider.getBalance.mockResolvedValue(1_500_000n)
    provider.call.mockResolvedValue(
      TRC20_INTERFACE.encodeFunctionResult('balanceOf', [2_000_000n])
    )

    const result = await balances.getTokenBalances(BASE58_ADDRESS, ['TRX', 'USDT'])

    expect(result).toEqual({
      TRX: {
        raw: '1500000',
        formatted: '1.5',
        decimals: 6,
        tokenPriceUsd: 0.3,
        usdValue: expect.closeTo(0.45, 10),
      },
      USDT: {
        raw: '2000000',
        formatted: '2.0',
        decimals: 6,
        tokenPriceUsd: 1,
        usdValue: 2,
      },
    })

    expect(provider.getBalance).toHaveBeenCalledWith(HEX_ADDRESS)
    expect(provider.call).toHaveBeenCalledWith({
      to: USDT_CONTRACT,
      data: TRC20_INTERFACE.encodeFunctionData('balanceOf', [HEX_ADDRESS]),
    })
    expect(getTokenPrices).toHaveBeenCalledWith(['TRX', 'USDT'])
  })

  it('keeps balances without USD values when prices are unavailable', async () => {
    getTokenPrices.mockResolvedValue({})
    provider.getBalance.mockResolvedValue(1_000_000n)
    provider.call.mockResolvedValue(
      TRC20_INTERFACE.encodeFunctionResult('balanceOf', [0n])
    )

    await expect(balances.getTokenBalances(BASE58_ADDRESS, ['TRX', 'USDT'])).resolves.toEqual({
      TRX: {
        raw: '1000000',
        formatted: '1.0',
        decimals: 6,
        tokenPriceUsd: undefined,
        usdValue: undefined,
      },
      USDT: {
        raw: '0',
        formatted: '0.0',
        decimals: 6,
        tokenPriceUsd: undefined,
        usdValue: undefined,
      },
    })
  })

  it('uses zero for a single failed token call', async () => {
    provider.getBalance.mockResolvedValue(2_000_000n)
    provider.call.mockRejectedValue(new Error('contract call failed'))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const result = await balances.getTokenBalances(BASE58_ADDRESS, ['TRX', 'USDT'])

    expect(result.TRX.raw).toBe('2000000')
    expect(result.USDT.raw).toBe('0')
  })

  it('throws when every chain call fails', async () => {
    provider.getBalance.mockRejectedValue(new Error('rpc down'))
    provider.call.mockRejectedValue(new Error('rpc down'))

    await expect(balances.getTokenBalances(BASE58_ADDRESS, ['TRX', 'USDT'])).rejects.toThrow(
      'Failed to read Tron balances'
    )
  })

  it('rejects invalid addresses and unknown symbols', async () => {
    await expect(balances.getTokenBalances('not-an-address', ['TRX'])).rejects.toThrow(
      'Invalid Tron address'
    )
    await expect(balances.getTokenBalances(BASE58_ADDRESS, ['NOPE'])).rejects.toThrow(
      'Unknown token symbols'
    )
  })

  it('sums token balances into a portfolio value', async () => {
    provider.getBalance.mockResolvedValue(10_000_000n)
    provider.call.mockResolvedValue(
      TRC20_INTERFACE.encodeFunctionResult('balanceOf', [5_000_000n])
    )

    await expect(balances.getPortfolioValue(BASE58_ADDRESS, ['TRX', 'USDT'])).resolves.toEqual({
      balances: expect.any(Object),
      totalUsdValue: expect.closeTo(8, 10),
    })
  })
})
