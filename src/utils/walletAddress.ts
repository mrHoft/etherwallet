import { TronWeb } from 'tronweb'
import type { StoredWallet } from '~/utils/wallets'

interface KeystoreData {
  address?: string
}

// The keystore stores the address as unprefixed lowercase hex, regardless of network.
export const getKeystoreAddress = (encryptedJson: string): string => {
  try {
    const parsedData = JSON.parse(encryptedJson) as KeystoreData
    return parsedData.address?.toLowerCase() ?? ''
  } catch {
    return ''
  }
}

// Display form: 0x-prefixed hex for Ethereum, base58 for Tron.
export const getWalletAddress = (wallet: StoredWallet): string => {
  const hex = getKeystoreAddress(wallet.encryptedJson)
  if (!hex) return ''

  if (wallet.network !== 'tron') return `0x${hex}`

  try {
    return TronWeb.address.fromHex(`41${hex}`) || ''
  } catch {
    return ''
  }
}
