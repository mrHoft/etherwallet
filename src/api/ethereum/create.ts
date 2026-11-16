import { ethers } from "ethers"

export interface WalletResult {
  address: string
  privateKey: string
  mnemonicPhrase: string
  derivationPath: string | null
  encryptedJson: string
}

/**
 * Creates a new Ethereum wallet with mnemonic phrase
 * @param password - BIP39 password (25th extension word)
 * @returns Wallet information including address, private key, and mnemonic
 */
export async function createWallet(password: string): Promise<WalletResult> {
  const now = Date.now()
  const mnemonic = ethers.Mnemonic.fromEntropy(
    ethers.randomBytes(16), // 128 bits = 12 words
    password
  )

  const wallet = ethers.HDNodeWallet.fromMnemonic(mnemonic)
  const encryptedJson = await wallet.encrypt(password)

  console.log(`Creation take: ${Date.now() - now}ms`)

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonicPhrase: mnemonic.phrase,
    derivationPath: wallet.path,
    encryptedJson
  }
}

/**
 * Creates wallet from the mnemonic
 * @param mnemonic - Existing mnemonic phrase
 * @param password - BIP39 extension word
 */
export async function createWalletFromMnemonic(mnemonicPhrase: string, password: string): Promise<WalletResult> {
  const wallet = ethers.HDNodeWallet.fromPhrase(mnemonicPhrase, password)
  const encryptedJson = await wallet.encrypt(password)

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonicPhrase,
    derivationPath: wallet.path,
    encryptedJson
  }
}

/**
 * Creates wallet from an existing private key
 * @param privateKey - Existing private key (hex string with or without 0x prefix)
 * @param password - Password for encrypting the wallet JSON
 * @returns Wallet information including address, private key, and encrypted JSON
 */
export async function createWalletFromPrivateKey(privateKey: string, password: string): Promise<WalletResult> {
  // Ensure private key has 0x prefix
  const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`

  // Create wallet from private key
  const wallet = new ethers.Wallet(formattedPrivateKey)

  // Encrypt the wallet with password
  const encryptedJson = await wallet.encrypt(password)

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonicPhrase: '', // No mnemonic phrase when creating from private key
    derivationPath: null, // No derivation path when creating from private key
    encryptedJson
  }
}

export function decryptWallet(encryptedJson: string, password: string) {
  return ethers.Wallet.fromEncryptedJson(encryptedJson, password)
}
