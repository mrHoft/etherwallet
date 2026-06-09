/// <reference types="jest" />

import { ethers } from 'ethers';
import { getGasPrice, getOptimizedGasPrice } from './gasPrice';

describe('gasPrice', () => {
  // Helper to create a mocked ethers.Provider
  const createMockProvider = (feeData: any) => {
    return {
      getFeeData: jest.fn().mockResolvedValue(feeData),
    } as unknown as ethers.Provider;
  };

  describe('getGasPrice', () => {
    it('should return gasPrice when it is not null', async () => {
      const expectedGasPrice = 20000000000n;
      const provider = createMockProvider({ gasPrice: expectedGasPrice });

      const result = await getGasPrice(provider);

      expect(result).toBe(expectedGasPrice);
    });

    it('should throw an error when gasPrice is null', async () => {
      const provider = createMockProvider({ gasPrice: null });

      await expect(getGasPrice(provider)).rejects.toThrow('Failed to get gas price');
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
