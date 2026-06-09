import { ethers } from 'ethers';
import { TOKEN_INFO } from './const';
import { rpcProvider } from './provider';
import { getGasPrice, getOptimizedGasPrice } from './gasPrice';

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

export async function transferTokens(
  privateKey: string,
  recipientAddress: string,
  tokenSymbol: string, // or contract address
  amount: number | string, // human-readable amount (e.g., "1.5" tokens)
  provider: ethers.Provider, // Changed to ethers.Provider for flexibility (can revert to FallbackProvider if strictly needed)
  options?: {
    gasLimit?: number | string | bigint;
    waitForConfirmation?: boolean;
    confirmations?: number;
  }
): Promise<{
  txHash: string;
  txResponse: ethers.TransactionResponse;
  txReceipt: ethers.TransactionReceipt | null;
}> {
  const tokenInfo = TOKEN_INFO[tokenSymbol] || Object.values(TOKEN_INFO).find(t => t.contractAddress.toLowerCase() === tokenSymbol.toLowerCase());
  if (!tokenInfo) throw new Error(`Token not found: ${tokenSymbol}`);

  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`Using wallet: ${wallet.address}`);
  console.log(`Sending ${amount} ${tokenInfo.symbol} to ${recipientAddress}`);

  const tokenContract = new ethers.Contract(tokenInfo.contractAddress, ERC20_ABI, wallet);

  const decimals = tokenInfo.decimals;
  const rawAmount = ethers.parseUnits(amount.toString(), decimals);
  const nonce = await provider.getTransactionCount(wallet.address, 'pending');
  const txData = tokenContract.interface.encodeFunctionData('transfer', [recipientAddress, rawAmount]);

  const txOptions: ethers.TransactionRequest = {
    nonce,
    from: wallet.address,
    to: tokenInfo.contractAddress,
    data: txData,
  };

  try {
    // Try to use EIP-1559 if supported
    const gasFees = await getOptimizedGasPrice(provider);
    txOptions.maxFeePerGas = gasFees.maxFeePerGas;
    txOptions.maxPriorityFeePerGas = gasFees.maxPriorityFeePerGas;
    txOptions.type = 2;
  } catch (error) {
    // Fallback to legacy gas price
    const gasPrice = await getGasPrice(provider);
    txOptions.gasPrice = gasPrice;
  }

  // Set gas limit (estimate or use provided)
  let gasLimit: bigint;
  if (options?.gasLimit) {
    gasLimit = BigInt(options.gasLimit);
  } else {
    const transferMethod = tokenContract.getFunction('transfer');
    const estimatedGas = await transferMethod.estimateGas(
      recipientAddress,
      rawAmount,
      { from: wallet.address }
    );

    gasLimit = (BigInt(estimatedGas) * 120n) / 100n; // Adds 20% buffer
  }
  txOptions.gasLimit = gasLimit;

  console.log(`Gas limit: ${gasLimit.toString()}`);
  console.log(`Raw amount: ${rawAmount.toString()}`);

  // Sign and send transaction
  console.log("Signing and sending transaction...");
  const txResponse = await wallet.sendTransaction(txOptions);

  console.log(`Transaction sent! Hash: ${txResponse.hash}`);

  // Wait for confirmation if requested
  let txReceipt: ethers.TransactionReceipt | null = null;
  if (options?.waitForConfirmation !== false) {
    const confirmations = options?.confirmations || 1;
    console.log(`Waiting for ${confirmations} confirmation(s)...`);
    txReceipt = await txResponse.wait(confirmations);

    if (!txReceipt || txReceipt.status === 0) {
      throw new Error("Transaction failed!");
    }
    console.log(`Transaction confirmed in block: ${txReceipt.blockNumber}`);
  }

  return { txHash: txResponse.hash, txResponse, txReceipt };
}

export async function example() {
  const privateKey = "0x..."; // Your private key
  const recipientAddress = "0x..."; // Recipient wallet
  const tokenSymbol = "USDC"; // Or contract address like "0x..."
  const amount = "10.5"; // 10.5 tokens

  const provider = rpcProvider.getProvider();

  try {
    const result = await transferTokens(
      privateKey,
      recipientAddress,
      tokenSymbol,
      amount,
      provider,
      {
        waitForConfirmation: true,
        confirmations: 2
      }
    );

    console.log(`Transfer complete! TX: ${result.txHash}`);
  } catch (error) {
    console.error("Transfer failed:", error);
  }
}
