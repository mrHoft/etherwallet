import { ethers } from 'ethers';

export async function getGasPrice(provider: ethers.Provider): Promise<bigint> {
  const feeData = await provider.getFeeData();

  if (feeData.gasPrice === null) {
    throw new Error("Failed to get gas price");
  }

  return feeData.gasPrice;
}

export async function getOptimizedGasPrice(provider: ethers.Provider): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  const feeData = await provider.getFeeData();

  if (feeData.maxFeePerGas === null || feeData.maxPriorityFeePerGas === null) {
    throw new Error("Network does not support EIP-1559");
  }

  return {
    maxFeePerGas: (feeData.maxFeePerGas * 110n) / 100n,
    maxPriorityFeePerGas: (feeData.maxPriorityFeePerGas * 110n) / 100n,
  };
}
