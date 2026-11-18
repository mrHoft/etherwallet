import { detectWalletNetwork, isTronAddress } from '~/utils/walletNetwork'

const TRON_ADDRESS = 'TNXoiAJ3dct8Fjg4M9fkLFh9S2v9TXc32G'
const ETHEREUM_ADDRESS = '0x89cbcb2372e1c2fbc00f24895a406a0c722c89f3'

describe('wallet network detection', () => {
  it('detects base58 Tron addresses', () => {
    expect(isTronAddress(TRON_ADDRESS)).toBe(true)
    expect(isTronAddress(` ${TRON_ADDRESS} `)).toBe(true)
    expect(detectWalletNetwork(TRON_ADDRESS)).toBe('tron')
  })

  it('treats hex addresses as Ethereum', () => {
    expect(isTronAddress(ETHEREUM_ADDRESS)).toBe(false)
    expect(detectWalletNetwork(ETHEREUM_ADDRESS)).toBe('ethereum')
    expect(detectWalletNetwork('89cbcb2372e1c2fbc00f24895a406a0c722c89f3')).toBe('ethereum')
    expect(detectWalletNetwork('4189cbcb2372e1c2fbc00f24895a406a0c722c89f3')).toBe('ethereum')
  })

  it('defaults empty or invalid values to Ethereum', () => {
    expect(isTronAddress('')).toBe(false)
    expect(detectWalletNetwork('')).toBe('ethereum')
    expect(detectWalletNetwork('not-an-address')).toBe('ethereum')
  })
})
