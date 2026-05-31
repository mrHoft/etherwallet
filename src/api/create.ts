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
 * @param passphrase - BIP39 passphrase (25th extension word)
 * @returns Wallet information including address, private key, and mnemonic
 */
export async function createWallet(passphrase: string): Promise<WalletResult> {
  const now = Date.now()
  const mnemonic = ethers.Mnemonic.fromEntropy(
    ethers.randomBytes(16), // 128 bits = 12 words
    passphrase
  )

  const wallet = ethers.HDNodeWallet.fromMnemonic(mnemonic)
  const encryptedJson = await wallet.encrypt(passphrase)

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
 * Creates multiple wallets from the same mnemonic
 * @param mnemonic - Existing mnemonic phrase
 * @param passphrase - BIP39 extension word
 */
export async function createWalletsFromMnemonic(mnemonicPhrase: string, passphrase: string, index = 0): Promise<WalletResult> {

  const path = `m/44'/60'/0'/0/${index}`
  const wallet = ethers.HDNodeWallet.fromPhrase(mnemonicPhrase, passphrase, path)
  const encryptedJson = await wallet.encrypt(passphrase)

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonicPhrase,
    derivationPath: path,
    encryptedJson
  }
}
