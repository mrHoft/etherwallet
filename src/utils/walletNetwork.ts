import type { WalletNetwork } from '~/utils/wallets'

const TRON_ADDRESS_PATTERN = /^T[1-9A-HJ-NP-Za-km-z]{33}$/

export const isTronAddress = (address: string): boolean => {
  return TRON_ADDRESS_PATTERN.test(address.trim())
}

// Fallback for callers that only have an address. Prefer the stored wallet network.
export const detectWalletNetwork = (address: string): WalletNetwork => {
  return isTronAddress(address) ? 'tron' : 'ethereum'
}
