import { ethers } from "ethers"
import { type WalletResult } from './types.ts'

/**
 * Creates a new Ethereum wallet with mnemonic phrase
 * @param passphrase - Optional BIP39 passphrase (25th word)
 * @returns Wallet information including address, private key, and mnemonic
 */
export function createWallet(passphrase?: string): WalletResult {
  // Generate a random mnemonic (12 words by default)
  const mnemonic = ethers.Mnemonic.fromEntropy(
    ethers.randomBytes(16), // 128 bits = 12 words
    passphrase
  )

  // Create wallet from mnemonic
  const wallet = ethers.HDNodeWallet.fromMnemonic(mnemonic)

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonicPhrase: mnemonic.phrase,
    derivationPath: wallet.path
  }
}

/**
 * Creates multiple wallets from the same mnemonic
 * @param mnemonic - Existing mnemonic phrase
 * @param passphrase - Password
 */
export function createWalletsFromMnemonic(mnemonicPhrase: string, passphrase: string, index = 0): WalletResult {

  const path = `m/44'/60'/0'/0/${index}`
  const wallet = ethers.HDNodeWallet.fromPhrase(mnemonicPhrase, passphrase, path)

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonicPhrase,
    derivationPath: path
  }
}
