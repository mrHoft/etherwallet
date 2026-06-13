import { ethers } from 'ethers';
import { TOKEN_INFO } from './const';
import { rpcProvider } from './provider';

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

export async function transferToken(
  privateKey: string,
  recipientAddress: string,
  tokenSymbolOrAddress: string, // 'ETH' for native, or token symbol/contract address
  amount: number | string, // human-readable amount (e.g., "1.5" tokens)
  options?: {
    gasLimit?: number | string | bigint;
    waitForConfirmation?: boolean;
    confirmations?: number;
  }
): Promise<{ txHash: string; txResponse: ethers.TransactionResponse; txReceipt: ethers.TransactionReceipt | null; }> {
  if (!ethers.isAddress(recipientAddress)) {
    throw new Error(`Invalid recipient address: ${recipientAddress}`);
  }

  const parsedAmount = parseFloat(amount.toString());
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error(`Invalid amount: ${amount}`);
  }

  const provider = rpcProvider.getProvider(); // ethers.FallbackProvider
  const wallet = new ethers.Wallet(privateKey, provider);
  const isNativeTransfer = tokenSymbolOrAddress.toUpperCase() === 'ETH';

  console.log(`Using wallet: ${wallet.address}`);
  console.log(`Sending ${amount} ${isNativeTransfer ? 'ETH' : tokenSymbolOrAddress} to ${recipientAddress}`);

  const nonce = await provider.getTransactionCount(wallet.address, 'pending');

  const txOptions: ethers.TransactionRequest = {
    nonce,
    from: wallet.address,
  };

  let rawAmount: bigint;

  // ==================== Native ETH Transfer ====================
  if (isNativeTransfer) {
    // Convert ETH amount to wei
    rawAmount = ethers.parseEther(amount.toString());

    txOptions.to = recipientAddress;
    txOptions.value = rawAmount;
    txOptions.data = "0x"; // No data for native transfers

    let gasLimit: bigint;
    if (options?.gasLimit) {
      try {
        gasLimit = BigInt(options.gasLimit);
      } catch {
        throw new Error(`Invalid gasLimit value: ${options.gasLimit}`);
      }
    } else {
      const estimatedGas = await provider.estimateGas({ from: wallet.address, to: recipientAddress, value: rawAmount });
      gasLimit = (estimatedGas * 120n) / 100n;
      console.log(`Estimated gas for ETH transfer: ${estimatedGas}, with buffer: ${gasLimit}`);
    }
    txOptions.gasLimit = gasLimit;

    // ==================== ERC-20 Token Transfer ====================
  } else {
    const tokenInfo = TOKEN_INFO[tokenSymbolOrAddress] || Object.values(TOKEN_INFO).find(t => t.contractAddress.toLowerCase() === tokenSymbolOrAddress.toLowerCase());

    if (!tokenInfo) {
      throw new Error(`Token not found: ${tokenSymbolOrAddress}`);
    }

    console.log(`Token: ${tokenInfo.symbol} (${tokenInfo.contractAddress})`);

    const tokenContract = new ethers.Contract(tokenInfo.contractAddress, ERC20_ABI, wallet);

    const decimals: number = await (async () => {
      try {
        return await tokenContract.decimals();
      } catch {
        console.warn(`Failed to fetch decimals from contract, using config value`);
        return tokenInfo.decimals;
      }
    })()

    // Convert token amount to raw units (with decimals)
    rawAmount = ethers.parseUnits(amount.toString(), decimals);

    // Encode transfer function data
    const txData = tokenContract.interface.encodeFunctionData('transfer', [recipientAddress, rawAmount]);

    txOptions.to = tokenInfo.contractAddress;
    txOptions.value = 0n; // No ETH value for token transfers
    txOptions.data = txData;

    // Estimate gas for token transfer
    let gasLimit: bigint;
    if (options?.gasLimit) {
      try {
        gasLimit = BigInt(options.gasLimit);
      } catch {
        throw new Error(`Invalid gasLimit value: ${options.gasLimit}`);
      }
    } else {
      try {
        // Estimate gas with the token contract's transfer method
        const transferMethod = tokenContract.getFunction('transfer');
        const estimatedGas = await transferMethod.estimateGas(recipientAddress, rawAmount);
        gasLimit = (BigInt(estimatedGas) * 120n) / 100n; // Adds 20% buffer
        console.log(`Estimated gas for token transfer: ${estimatedGas}, with buffer: ${gasLimit}`);
      } catch (error) {
        // Fallback to a reasonable default for token transfers (typically higher than ETH)
        console.warn(`Gas estimation failed, using default:`, error instanceof Error ? error.message : error);
        const defaultGas = 100000n; // 100k gas default for token transfers
        gasLimit = (defaultGas * 120n) / 100n;
      }
    }
    txOptions.gasLimit = gasLimit;
  }

  // ==================== Common Gas Fee Setup (EIP-1559 or Legacy) ====================
  const feeData = await provider.getFeeData();
  if (feeData.maxFeePerGas !== null && feeData.maxPriorityFeePerGas !== null) {
    // Use EIP-1559
    txOptions.maxFeePerGas = (feeData.maxFeePerGas * 110n) / 100n;
    txOptions.maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas * 110n) / 100n;
    txOptions.type = 2;
    console.log(`Using EIP-1559: maxFeePerGas=${feeData.maxFeePerGas}, priorityFee=${feeData.maxPriorityFeePerGas}`);
  } else {
    // Use legacy gas price
    txOptions.gasPrice = feeData.gasPrice
    console.log(`Using legacy gas price: ${feeData.gasPrice}`);
  }

  console.log(`Amount: ${amount} ${isNativeTransfer ? 'ETH' : 'tokens'} (raw: ${rawAmount.toString()})`);
  console.log(`Gas limit: ${txOptions.gasLimit?.toString()}`);
  console.log(`Recipient: ${recipientAddress}`);

  if (!isNativeTransfer) {
    console.log(`Token contract: ${txOptions.to}`);
  }

  // ==================== Sign and Send Transaction ====================
  console.log("Signing and sending transaction...");
  const txResponse = await wallet.sendTransaction(txOptions);
  console.log(`Transaction sent! Hash: ${txResponse.hash}`);

  // ==================== Wait for Confirmation ====================
  let txReceipt: ethers.TransactionReceipt | null = null;
  if (options?.waitForConfirmation !== false) {
    const confirmations = options?.confirmations || 1;
    console.log(`Waiting for ${confirmations} confirmation(s)...`);
    txReceipt = await txResponse.wait(confirmations);

    if (!txReceipt) {
      throw new Error("Transaction receipt not found!");
    }

    if (txReceipt.status === 0) {
      throw new Error(`Transaction failed! Status: ${txReceipt.status}, Hash: ${txResponse.hash}`);
    }

    console.log(`Transaction confirmed in block: ${txReceipt.blockNumber}`);
    console.log(`Gas used: ${txReceipt.gasUsed.toString()}`);
  }

  return {
    txHash: txResponse.hash,
    txResponse,
    txReceipt
  };
}

export async function example() {
  const privateKey = "0x..."; // Sender private key

  try {
    const result = await transferToken(
      privateKey,
      "0xRecipientAddress...",
      "USDC", // Or contract address like "0x..."
      "0.5",  // 0.5 USDC,
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
