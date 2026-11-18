import { TronWeb } from 'tronweb'
import { ethers } from 'ethers'

export interface TronWalletResult {
  address: string
  privateKey: string
  mnemonicPhrase: string
  derivationPath: string | null
  encryptedJson: string
}

const DEFAULT_DERIVATION_PATH = "m/44'/195'/0'/0/0"

const privateKeyToAddress = (privateKey: string): string => {
  const address = TronWeb.address.fromPrivateKey(privateKey)
  if (!address) throw new Error('Invalid Tron private key')
  return address
}

// Tron and Ethereum share secp256k1 keys, so the private key can be stored in
// the same encrypted keystore format the rest of the app already decrypts.
const encryptPrivateKey = (privateKey: string, password: string): Promise<string> => {
  return new ethers.Wallet(privateKey).encrypt(password)
}

/**
 * Creates a new Tron wallet with mnemonic phrase
 * @param password - BIP39 password (25th extension word) and keystore encryption password
 * @returns Tron wallet information including base58 address, private key, and mnemonic
 */
export async function createWallet(password: string): Promise<TronWalletResult> {
  const { mnemonic, privateKey, address, path } = TronWeb.createRandom(password)
  const encryptedJson = await encryptPrivateKey(privateKey, password)

  return {
    address,
    privateKey,
    mnemonicPhrase: mnemonic?.phrase ?? '',
    derivationPath: path,
    encryptedJson,
  }
}

/**
 * Creates a Tron wallet from the mnemonic
 * @param mnemonicPhrase - Existing mnemonic phrase
 * @param password - BIP39 extension word and keystore encryption password
 */
export async function createWalletFromMnemonic(mnemonicPhrase: string, password: string): Promise<TronWalletResult> {
  const { privateKey, address } = TronWeb.fromMnemonic(mnemonicPhrase, DEFAULT_DERIVATION_PATH, password)
  const encryptedJson = await encryptPrivateKey(privateKey, password)

  return {
    address,
    privateKey,
    mnemonicPhrase,
    derivationPath: DEFAULT_DERIVATION_PATH,
    encryptedJson,
  }
}

/**
 * Creates a Tron wallet from an existing private key
 * @param privateKey - Existing private key (hex string with or without 0x prefix)
 * @param password - Password for encrypting the wallet JSON
 * @returns Tron wallet information including base58 address, private key, and encrypted JSON
 */
export async function createWalletFromPrivateKey(privateKey: string, password: string): Promise<TronWalletResult> {
  const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
  const address = privateKeyToAddress(formattedPrivateKey)
  const encryptedJson = await encryptPrivateKey(formattedPrivateKey, password)

  return {
    address,
    privateKey: formattedPrivateKey,
    mnemonicPhrase: '', // No mnemonic phrase when creating from private key
    derivationPath: null, // No derivation path when creating from private key
    encryptedJson,
  }
}
