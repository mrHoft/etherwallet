import { toTronBase58Address, toTronHexAddress } from '~/api/tron/address'

const BASE58_ADDRESS = 'TNXoiAJ3dct8Fjg4M9fkLFh9S2v9TXc32G'
const HEX_ADDRESS = '0x89cbcb2372e1c2fbc00f24895a406a0c722c89f3'
const PREFIXED_HEX_ADDRESS = '4189cbcb2372e1c2fbc00f24895a406a0c722c89f3'

describe('tron address helpers', () => {
  it('normalizes base58 addresses to the 20-byte hex form', () => {
    expect(toTronHexAddress(BASE58_ADDRESS)).toBe(HEX_ADDRESS)
  })

  it('accepts hex addresses with and without the 41 prefix', () => {
    expect(toTronHexAddress(HEX_ADDRESS)).toBe(HEX_ADDRESS)
    expect(toTronHexAddress(PREFIXED_HEX_ADDRESS)).toBe(HEX_ADDRESS)
  })

  it('converts hex addresses back to base58', () => {
    expect(toTronBase58Address(PREFIXED_HEX_ADDRESS)).toBe(BASE58_ADDRESS)
    expect(toTronBase58Address(HEX_ADDRESS)).toBe(BASE58_ADDRESS)
  })

  it('rejects invalid addresses', () => {
    expect(() => toTronHexAddress('not-an-address')).toThrow('Invalid Tron address')
    expect(() => toTronHexAddress('')).toThrow('Invalid Tron address')
    expect(toTronBase58Address('not-an-address')).toBe('')
  })
})
