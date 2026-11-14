import { storage } from './storage'

export type WalletMap = Record<string, string>

export const WALLET_NAME_MAX_LENGTH = 24

const WALLET_NAME_PATTERN = /^[\p{L}\p{N} _-]+$/u
const RESERVED_NAME_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

let walletCache: WalletMap | null = null

const loadWallets = (): WalletMap => {
  if (walletCache === null) {
    const storedWallets = storage.get<WalletMap>('wallet')
    walletCache = storedWallets && typeof storedWallets === 'object' ? { ...storedWallets } : {}
  }

  return walletCache
}

const persistWallets = (wallets: WalletMap): void => {
  storage.set('wallet', wallets)
}

const hasOwnWallet = (wallets: WalletMap, name: string): boolean => {
  return Object.prototype.hasOwnProperty.call(wallets, name)
}

export const normalizeWalletName = (name: string): string => {
  return name.trim().replace(/ /g, '_')
}

export const validateWalletName = (name: string): string => {
  const trimmedName = name.trim()

  if (!trimmedName) return 'Wallet name is required'
  if (trimmedName.length > WALLET_NAME_MAX_LENGTH) {
    return `Wallet name must be ${WALLET_NAME_MAX_LENGTH} characters or fewer`
  }
  if (!WALLET_NAME_PATTERN.test(trimmedName)) {
    return 'Wallet name can contain only letters, numbers, spaces, hyphens, and underscores'
  }
  if (RESERVED_NAME_KEYS.has(normalizeWalletName(trimmedName))) {
    return 'This wallet name is not allowed'
  }

  return ''
}

export const getWallets = (): WalletMap => {
  return loadWallets()
}

export const hasWallet = (name: string): boolean => {
  return hasOwnWallet(loadWallets(), normalizeWalletName(name))
}

export const addWallet = (name: string, encryptedJson: string): string => {
  const validationError = validateWalletName(name)
  if (validationError) throw new Error(validationError)

  const walletName = normalizeWalletName(name)
  const wallets = loadWallets()

  if (hasOwnWallet(wallets, walletName)) {
    throw new Error(`A wallet named "${walletName}" already exists`)
  }

  wallets[walletName] = encryptedJson
  persistWallets(wallets)

  return walletName
}

export const renameWallet = (oldName: string, newName: string): string => {
  const validationError = validateWalletName(newName)
  if (validationError) throw new Error(validationError)

  const wallets = loadWallets()
  const walletName = normalizeWalletName(newName)

  if (!hasOwnWallet(wallets, oldName)) throw new Error('Wallet not found')
  if (walletName === oldName) return oldName

  if (hasOwnWallet(wallets, walletName)) {
    throw new Error(`A wallet named "${walletName}" already exists`)
  }

  wallets[walletName] = wallets[oldName]
  delete wallets[oldName]
  persistWallets(wallets)

  return walletName
}

export const removeWallet = (name: string): void => {
  const wallets = loadWallets()

  if (!hasOwnWallet(wallets, name)) return

  delete wallets[name]
  persistWallets(wallets)
}
