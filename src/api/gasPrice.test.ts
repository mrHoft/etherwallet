/// <reference types="jest" />

import { ethers } from 'ethers';
import { getFormattedGasPrice, getOptimizedGasPrice } from './gasPrice';

describe('gasPrice', () => {
  // Helper to create a mocked ethers.Provider
  const createMockProvider = (feeData: any) => {
    return {
      getFeeData: jest.fn().mockResolvedValue(feeData),
    } as unknown as ethers.Provider;
  };

  describe('getFormattedGasPrice', () => {
    it('shows loading and failure placeholders', () => {
      expect(getFormattedGasPrice(0n, 1800)).toBe('Loading...');
      expect(getFormattedGasPrice(-1n, 1800)).toBe('Failed to load');
    });

    it('shows only Gwei when the ETH price is unavailable', () => {
      expect(getFormattedGasPrice(10_000_000_000n, null)).toBe('10.00 Gwei');
      expect(getFormattedGasPrice(10_000_000_000n, 0)).toBe('10.00 Gwei');
      expect(getFormattedGasPrice(10_000_000_000n, Number.NaN)).toBe('10.00 Gwei');
    });

    it('adds the USD value of the displayed Gwei amount', () => {
      expect(getFormattedGasPrice(10_000_000_000n, 1800)).toBe('10.00 Gwei (0.000018$)');
    });

    it('uses two decimals once the Gwei value is worth a cent', () => {
      expect(getFormattedGasPrice(6_000_000_000_000n, 1800)).toBe('6000.00 Gwei (0.01$)');
    });
  });

  describe('getOptimizedGasPrice', () => {
    it('should return 110% of maxFeePerGas and maxPriorityFeePerGas when both are not null', async () => {
      const maxFeePerGas = 30000000000n;
      const maxPriorityFeePerGas = 1500000000n;
      const provider = createMockProvider({
        maxFeePerGas,
        maxPriorityFeePerGas
      });

      const result = await getOptimizedGasPrice(provider);

      expect(result.maxFeePerGas).toBe((maxFeePerGas * 110n) / 100n);
      expect(result.maxPriorityFeePerGas).toBe((maxPriorityFeePerGas * 110n) / 100n);
    });

    it('should throw an error when maxFeePerGas is null', async () => {
      const provider = createMockProvider({
        maxFeePerGas: null,
        maxPriorityFeePerGas: 1500000000n
      });

      await expect(getOptimizedGasPrice(provider)).rejects.toThrow('Network does not support EIP-1559');
    });

    it('should throw an error when maxPriorityFeePerGas is null', async () => {
      const provider = createMockProvider({
        maxFeePerGas: 30000000000n,
        maxPriorityFeePerGas: null
      });

      await expect(getOptimizedGasPrice(provider)).rejects.toThrow('Network does not support EIP-1559');
    });
  });
});
