import { TronWeb } from 'tronweb'

const HEX_ADDRESS_PATTERN = /^[0-9a-fA-F]{40}$/
const TRON_HEX_ADDRESS_PATTERN = /^41[0-9a-fA-F]{40}$/

const toHexBody = (address: string): string | null => {
  const trimmed = address.trim()
  if (!trimmed) return null

  if (HEX_ADDRESS_PATTERN.test(trimmed)) return trimmed.toLowerCase()
  if (TRON_HEX_ADDRESS_PATTERN.test(trimmed)) return trimmed.slice(2).toLowerCase()

  if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
    const body = trimmed.slice(2)
    if (!HEX_ADDRESS_PATTERN.test(body)) return null
    return body.toLowerCase()
  }

  try {
    const hex = TronWeb.address.toHex(trimmed)
    if (typeof hex !== 'string' || !TRON_HEX_ADDRESS_PATTERN.test(hex)) return null
    return hex.slice(2).toLowerCase()
  } catch {
    return null
  }
}

/**
 * Converts a base58 or hex Tron address to the 20-byte `0x` form expected by
 * the Tron JSON-RPC methods (`eth_getBalance`, `eth_call`).
 */
export const toTronHexAddress = (address: string): string => {
  const body = toHexBody(address)
  if (!body) throw new Error(`Invalid Tron address: ${address}`)
  return `0x${body}`
}

/**
 * Converts a Tron hex address (with or without the `41` network prefix) to
 * base58. Returns an empty string when the value is not a valid address.
 */
export const toTronBase58Address = (address: string): string => {
  const body = toHexBody(address)
  if (!body) return ''

  try {
    return TronWeb.address.fromHex(`41${body}`) || ''
  } catch {
    return ''
  }
}
