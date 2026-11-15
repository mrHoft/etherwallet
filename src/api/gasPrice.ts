import { ethers } from 'ethers';
import { rpcProvider } from './provider';

const GWEI_IN_WEI = 1e9

const formatGweiUsd = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '0.00'
  if (value >= 0.01) return value.toFixed(2)

  const fixed = value.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
  return fixed || '0.00'
}

export const getFormattedGasPrice = (gasPrice: bigint, ethUsd: number | null): string => {
  if (gasPrice === 0n) return 'Loading...'
  if (gasPrice < 0n) return 'Failed to load'

  const gwei = Number(gasPrice) / GWEI_IN_WEI
  if (!Number.isFinite(gwei)) return 'Failed to load'

  const gweiLabel = `${gwei.toFixed(2)} Gwei`

  if (ethUsd === null || !Number.isFinite(ethUsd) || ethUsd <= 0) {
    return gweiLabel
  }

  const usdValue = (gwei * ethUsd) / GWEI_IN_WEI
  return `${gweiLabel} (${formatGweiUsd(usdValue)}$)`
}

export async function getOptimizedGasPrice(provider?: ethers.Provider): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  provider = provider || rpcProvider.getProvider();
  const feeData = await provider.getFeeData();

  if (feeData.maxFeePerGas === null || feeData.maxPriorityFeePerGas === null) {
    throw new Error("Network does not support EIP-1559");
  }

  return {
    maxFeePerGas: (feeData.maxFeePerGas * 110n) / 100n,
    maxPriorityFeePerGas: (feeData.maxPriorityFeePerGas * 110n) / 100n,
  };
}
