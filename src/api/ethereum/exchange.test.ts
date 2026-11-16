import { ethers } from 'ethers';
import { describeSwapError, executeSwap, getSwapQuote } from './exchange';
import { rpcProvider } from './provider';
import { TOKEN_INFO, UNISWAP_V2_ROUTER_ADDRESS } from './config';

jest.mock('./provider');
jest.mock('./config', () => ({
  UNISWAP_V2_ROUTER_ADDRESS: '0xRouterAddress',
  TOKEN_INFO: {
    ETH: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
      contractAddress: '0x0000000000000000000000000000000000000000',
    },
    WETH: {
      name: 'Wrapped Ethereum',
      symbol: 'WETH',
      decimals: 18,
      contractAddress: '0xWETHAddress',
    },
    USDC: {
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      contractAddress: '0xUSDCAddress',
    },
    USDT: {
      name: 'Tether USD',
      symbol: 'USDT',
      decimals: 6,
      contractAddress: '0xUSDTAddress',
    },
  },
}));

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers') as any;
  const realEthersNamespace = actual.ethers || actual.default || actual;

  return {
    __esModule: true,
    ...actual,
    ethers: {
      ...realEthersNamespace,
      Wallet: jest.fn(),
      Contract: jest.fn(),
    },
  };
});

interface MockMethod {
  (...args: any[]): Promise<any>;
  estimateGas: jest.Mock;
}

const createMethod = (hash: string): MockMethod => {
  const method = jest.fn().mockResolvedValue({
    hash,
    wait: jest.fn().mockResolvedValue({
      blockNumber: 1,
      gasUsed: 100_000n,
      status: 1,
    }),
  }) as unknown as MockMethod;

  method.estimateGas = jest.fn().mockResolvedValue(100_000n);
  return method;
};

describe('exchange', () => {
  const mockPrivateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
  const mockWalletAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

  let mockProvider: any;
  let mockWallet: any;
  let mockContract: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockProvider = {
      getFeeData: jest.fn().mockResolvedValue({
        maxFeePerGas: 1_000_000_000n,
        maxPriorityFeePerGas: 100_000_000n,
        gasPrice: 1_000_000_000n,
      }),
    };
    (rpcProvider.getProvider as jest.Mock).mockReturnValue(mockProvider);

    mockWallet = { address: mockWalletAddress };
    (ethers.Wallet as unknown as jest.Mock).mockImplementation(() => mockWallet);

    mockContract = {
      getAmountsOut: jest.fn(),
      getAmountsIn: jest.fn(),
      allowance: jest.fn(),
      approve: createMethod('0xapprovalhash'),
      swapExactTokensForTokens: createMethod('0xswaphash'),
      swapExactETHForTokens: createMethod('0xethswaphash'),
      swapExactTokensForETH: createMethod('0xethoutswaphash'),
      swapTokensForExactTokens: createMethod('0xexactoutswaphash'),
      swapETHForExactTokens: createMethod('0xexactoutethswaphash'),
      swapTokensForExactETH: createMethod('0xexactoutethoutswaphash'),
    };
    (ethers.Contract as unknown as jest.Mock).mockImplementation(() => mockContract);
  });

  describe('getSwapQuote', () => {
    it('builds a direct token-to-token quote and applies slippage', async () => {
      mockContract.getAmountsOut.mockResolvedValue([1_000_000n, 2_000_000n]);

      const quote = await getSwapQuote('USDC', 'USDT', '1', 50);

      expect(mockContract.getAmountsOut).toHaveBeenCalledWith(1_000_000n, [
        TOKEN_INFO.USDC.contractAddress,
        TOKEN_INFO.USDT.contractAddress,
      ]);
      expect(quote.kind).toBe('tokenToToken');
      expect(quote.amountIn).toBe(1_000_000n);
      expect(quote.amountOut).toBe(2_000_000n);
      expect(quote.amountOutMin).toBe(1_990_000n);
      expect(quote.pathSymbols).toEqual(['USDC', 'USDT']);
      expect(quote.slippageBps).toBe(50);
    });

    it('uses WETH as the first hop for ETH input', async () => {
      mockContract.getAmountsOut.mockResolvedValue([1_000_000_000_000_000_000n, 3_000_000_000n]);

      const quote = await getSwapQuote('ETH', 'USDC', '1');

      expect(mockContract.getAmountsOut).toHaveBeenCalledWith(1_000_000_000_000_000_000n, [
        TOKEN_INFO.WETH.contractAddress,
        TOKEN_INFO.USDC.contractAddress,
      ]);
      expect(quote.kind).toBe('ethToToken');
      expect(quote.pathSymbols).toEqual(['WETH', 'USDC']);
    });

    it('uses WETH as the last hop for ETH output', async () => {
      mockContract.getAmountsOut.mockResolvedValue([1_000_000n, 1_000_000_000_000_000_000n]);

      const quote = await getSwapQuote('USDC', 'ETH', '1');

      expect(mockContract.getAmountsOut).toHaveBeenCalledWith(1_000_000n, [
        TOKEN_INFO.USDC.contractAddress,
        TOKEN_INFO.WETH.contractAddress,
      ]);
      expect(quote.kind).toBe('tokenToEth');
      expect(quote.pathSymbols).toEqual(['USDC', 'WETH']);
    });

    it('falls back to a WETH hop when the direct pair has no route', async () => {
      mockContract.getAmountsOut
        .mockRejectedValueOnce(new Error('no pair'))
        .mockResolvedValueOnce([1_000_000n, 2_000_000_000_000_000_000n, 3_000_000n]);

      const quote = await getSwapQuote('USDC', 'USDT', '1');

      expect(mockContract.getAmountsOut).toHaveBeenLastCalledWith(1_000_000n, [
        TOKEN_INFO.USDC.contractAddress,
        TOKEN_INFO.WETH.contractAddress,
        TOKEN_INFO.USDT.contractAddress,
      ]);
      expect(quote.path).toEqual([
        TOKEN_INFO.USDC.contractAddress,
        TOKEN_INFO.WETH.contractAddress,
        TOKEN_INFO.USDT.contractAddress,
      ]);
      expect(quote.amountOut).toBe(3_000_000n);
      expect(quote.pathSymbols).toEqual(['USDC', 'WETH', 'USDT']);
    });

    it('builds an exact-output token quote with a buffered maximum input', async () => {
      mockContract.getAmountsIn.mockResolvedValue([999_000n, 2_000_000n]);

      const quote = await getSwapQuote('USDC', 'USDT', '2', 50, 'exactOut');

      expect(mockContract.getAmountsIn).toHaveBeenCalledWith(2_000_000n, [
        TOKEN_INFO.USDC.contractAddress,
        TOKEN_INFO.USDT.contractAddress,
      ]);
      expect(quote.mode).toBe('exactOut');
      expect(quote.amountIn).toBe(999_000n);
      expect(quote.amountOut).toBe(2_000_000n);
      expect(quote.amountInMax).toBe(1_003_995n);
      expect(quote.amountOutMin).toBe(2_000_000n);
    });

    it('builds an exact-output quote for ETH input', async () => {
      mockContract.getAmountsIn.mockResolvedValue([500_000_000_000_000_000n, 3_000_000_000n]);

      const quote = await getSwapQuote('ETH', 'USDC', '3000', 50, 'exactOut');

      expect(mockContract.getAmountsIn).toHaveBeenCalledWith(3_000_000_000n, [
        TOKEN_INFO.WETH.contractAddress,
        TOKEN_INFO.USDC.contractAddress,
      ]);
      expect(quote.mode).toBe('exactOut');
      expect(quote.amountIn).toBe(500_000_000_000_000_000n);
      expect(quote.amountInMax).toBe(502_500_000_000_000_000n);
      expect(quote.kind).toBe('ethToToken');
    });

    it('falls back to a WETH hop for exact-output quotes', async () => {
      mockContract.getAmountsIn
        .mockRejectedValueOnce(new Error('no pair'))
        .mockResolvedValueOnce([1_000_000n, 2_000_000_000_000_000_000n, 3_000_000n]);

      const quote = await getSwapQuote('USDC', 'USDT', '3', 50, 'exactOut');

      expect(mockContract.getAmountsIn).toHaveBeenLastCalledWith(3_000_000n, [
        TOKEN_INFO.USDC.contractAddress,
        TOKEN_INFO.WETH.contractAddress,
        TOKEN_INFO.USDT.contractAddress,
      ]);
      expect(quote.amountIn).toBe(1_000_000n);
      expect(quote.amountOut).toBe(3_000_000n);
      expect(quote.pathSymbols).toEqual(['USDC', 'WETH', 'USDT']);
    });

    it('validates exact-output amounts against the output token decimals', async () => {
      await expect(getSwapQuote('USDC', 'USDT', '1.1234567', 50, 'exactOut')).rejects.toThrow(
        'Invalid amount for USDT: maximum 6 decimal places'
      );
    });

    it('reports no route when both direct and WETH routes are unavailable', async () => {
      const routeError = Object.assign(new Error('execution reverted'), { code: 'CALL_EXCEPTION' });
      mockContract.getAmountsOut.mockRejectedValue(routeError);

      await expect(getSwapQuote('USDC', 'USDT', '1')).rejects.toThrow(
        'No swap route found for this pair'
      );
    });

    it('rejects identical tokens', async () => {
      await expect(getSwapQuote('USDC', 'USDC', '1')).rejects.toThrow('Select two different tokens');
    });

    it('rejects ETH and WETH as a pair', async () => {
      await expect(getSwapQuote('ETH', 'WETH', '1')).rejects.toThrow('Select two different tokens');
    });

    it('rejects malformed amounts', async () => {
      await expect(getSwapQuote('USDC', 'USDT', 'abc')).rejects.toThrow('Invalid amount: abc');
    });

    it('rejects amounts with too many decimals', async () => {
      await expect(getSwapQuote('USDC', 'USDT', '1.1234567')).rejects.toThrow(
        'Invalid amount for USDC: maximum 6 decimal places'
      );
    });

    it('rejects zero amounts', async () => {
      await expect(getSwapQuote('USDC', 'USDT', '0')).rejects.toThrow('Amount must be greater than 0');
    });

    it('rejects invalid slippage', async () => {
      await expect(getSwapQuote('USDC', 'USDT', '1', -1)).rejects.toThrow(
        'Slippage must be between 0% and 50%'
      );
    });
  });

  describe('executeSwap', () => {
    beforeEach(() => {
      mockContract.getAmountsOut.mockResolvedValue([1_000_000n, 2_000_000n]);
    });

    it('approves the exact amount before swapping tokens', async () => {
      mockContract.allowance.mockResolvedValue(0n);

      const result = await executeSwap(mockPrivateKey, 'USDC', 'USDT', '1', {
        slippageBps: 50,
      });

      expect(mockContract.allowance).toHaveBeenCalledWith(
        mockWalletAddress,
        UNISWAP_V2_ROUTER_ADDRESS
      );
      expect(mockContract.approve).toHaveBeenCalledTimes(1);
      expect(mockContract.approve).toHaveBeenCalledWith(
        UNISWAP_V2_ROUTER_ADDRESS,
        1_000_000n,
        expect.objectContaining({ type: 2 })
      );
      expect(mockContract.swapExactTokensForTokens).toHaveBeenCalledWith(
        1_000_000n,
        1_990_000n,
        [TOKEN_INFO.USDC.contractAddress, TOKEN_INFO.USDT.contractAddress],
        mockWalletAddress,
        expect.any(BigInt),
        expect.objectContaining({ gasLimit: 120_000n })
      );
      expect(result.txHash).toBe('0xswaphash');
      expect(result.approvalTxHash).toBe('0xapprovalhash');
      expect(result.txReceipt).not.toBeNull();
    });

    it('skips approval when the allowance is sufficient', async () => {
      mockContract.allowance.mockResolvedValue(1_000_000n);

      const result = await executeSwap(mockPrivateKey, 'USDC', 'USDT', '1', {
        waitForConfirmation: false,
      });

      expect(mockContract.approve).not.toHaveBeenCalled();
      expect(mockContract.swapExactTokensForTokens).toHaveBeenCalled();
      expect(result.approvalTxHash).toBeUndefined();
      expect(result.txReceipt).toBeNull();
    });

    it('resets a stale allowance to zero before approving', async () => {
      mockContract.allowance.mockResolvedValue(1n);

      await executeSwap(mockPrivateKey, 'USDC', 'USDT', '1');

      expect(mockContract.approve).toHaveBeenCalledTimes(2);
      expect(mockContract.approve).toHaveBeenNthCalledWith(
        1,
        UNISWAP_V2_ROUTER_ADDRESS,
        0n,
        expect.any(Object)
      );
      expect(mockContract.approve).toHaveBeenNthCalledWith(
        2,
        UNISWAP_V2_ROUTER_ADDRESS,
        1_000_000n,
        expect.any(Object)
      );
    });

    it('sends native ETH with swapExactETHForTokens', async () => {
      mockContract.getAmountsOut.mockResolvedValue([
        1_000_000_000_000_000_000n,
        3_000_000_000n,
      ]);

      const result = await executeSwap(mockPrivateKey, 'ETH', 'USDC', '1');

      expect(mockContract.allowance).not.toHaveBeenCalled();
      expect(mockContract.swapExactETHForTokens).toHaveBeenCalledWith(
        2_985_000_000n,
        [TOKEN_INFO.WETH.contractAddress, TOKEN_INFO.USDC.contractAddress],
        mockWalletAddress,
        expect.any(BigInt),
        expect.objectContaining({
          value: 1_000_000_000_000_000_000n,
          gasLimit: 120_000n,
        })
      );
      expect(result.txHash).toBe('0xethswaphash');
    });

    it('uses swapExactTokensForETH for ETH output', async () => {
      mockContract.getAmountsOut.mockResolvedValue([1_000_000n, 1_000_000_000_000_000_000n]);
      mockContract.allowance.mockResolvedValue(1_000_000n);

      const result = await executeSwap(mockPrivateKey, 'USDC', 'ETH', '1');

      expect(mockContract.swapExactTokensForETH).toHaveBeenCalledWith(
        1_000_000n,
        995_000_000_000_000_000n,
        [TOKEN_INFO.USDC.contractAddress, TOKEN_INFO.WETH.contractAddress],
        mockWalletAddress,
        expect.any(BigInt),
        expect.objectContaining({ gasLimit: 120_000n })
      );
      expect(result.txHash).toBe('0xethoutswaphash');
    });

    it('uses a supplied gas limit without estimating', async () => {
      mockContract.allowance.mockResolvedValue(1_000_000n);

      await executeSwap(mockPrivateKey, 'USDC', 'USDT', '1', { gasLimit: 250_000n });

      expect(mockContract.swapExactTokensForTokens.estimateGas).not.toHaveBeenCalled();
      expect(mockContract.swapExactTokensForTokens).toHaveBeenCalledWith(
        1_000_000n,
        1_990_000n,
        [TOKEN_INFO.USDC.contractAddress, TOKEN_INFO.USDT.contractAddress],
        mockWalletAddress,
        expect.any(BigInt),
        expect.objectContaining({ gasLimit: 250_000n })
      );
    });

    it('approves the buffered input and uses swapTokensForExactTokens', async () => {
      mockContract.getAmountsIn.mockResolvedValue([999_000n, 2_000_000n]);
      mockContract.allowance.mockResolvedValue(0n);

      const result = await executeSwap(mockPrivateKey, 'USDC', 'USDT', '2', {
        mode: 'exactOut',
        slippageBps: 50,
      });

      expect(mockContract.approve).toHaveBeenCalledWith(
        UNISWAP_V2_ROUTER_ADDRESS,
        1_003_995n,
        expect.any(Object)
      );
      expect(mockContract.swapTokensForExactTokens).toHaveBeenCalledWith(
        2_000_000n,
        1_003_995n,
        [TOKEN_INFO.USDC.contractAddress, TOKEN_INFO.USDT.contractAddress],
        mockWalletAddress,
        expect.any(BigInt),
        expect.objectContaining({ gasLimit: 120_000n })
      );
      expect(result.txHash).toBe('0xexactoutswaphash');
    });

    it('sends the buffered maximum input with swapETHForExactTokens', async () => {
      mockContract.getAmountsIn.mockResolvedValue([
        500_000_000_000_000_000n,
        3_000_000_000n,
      ]);

      const result = await executeSwap(mockPrivateKey, 'ETH', 'USDC', '3000', {
        mode: 'exactOut',
      });

      expect(mockContract.allowance).not.toHaveBeenCalled();
      expect(mockContract.swapETHForExactTokens).toHaveBeenCalledWith(
        3_000_000_000n,
        [TOKEN_INFO.WETH.contractAddress, TOKEN_INFO.USDC.contractAddress],
        mockWalletAddress,
        expect.any(BigInt),
        expect.objectContaining({
          value: 502_500_000_000_000_000n,
          gasLimit: 120_000n,
        })
      );
      expect(result.txHash).toBe('0xexactoutethswaphash');
    });

    it('uses swapTokensForExactETH for a requested ETH output', async () => {
      mockContract.getAmountsIn.mockResolvedValue([
        1_000_000n,
        1_000_000_000_000_000_000n,
      ]);
      mockContract.allowance.mockResolvedValue(1_005_000n);

      const result = await executeSwap(mockPrivateKey, 'USDC', 'ETH', '1', {
        mode: 'exactOut',
      });

      expect(mockContract.swapTokensForExactETH).toHaveBeenCalledWith(
        1_000_000_000_000_000_000n,
        1_005_000n,
        [TOKEN_INFO.USDC.contractAddress, TOKEN_INFO.WETH.contractAddress],
        mockWalletAddress,
        expect.any(BigInt),
        expect.objectContaining({ gasLimit: 120_000n })
      );
      expect(result.txHash).toBe('0xexactoutethoutswaphash');
    });

    it('throws when the swap transaction reverts on-chain', async () => {
      mockContract.allowance.mockResolvedValue(1_000_000n);
      mockContract.swapExactTokensForTokens.mockResolvedValue({
        hash: '0xfailedswap',
        wait: jest.fn().mockResolvedValue({
          blockNumber: 2,
          gasUsed: 100_000n,
          status: 0,
        }),
      });

      await expect(executeSwap(mockPrivateKey, 'USDC', 'USDT', '1')).rejects.toThrow(
        'Transaction failed! Status: 0, Hash: 0xfailedswap'
      );
    });
  });

  describe('describeSwapError', () => {
    it('maps insufficient output errors to a slippage message', () => {
      expect(
        describeSwapError(new Error('execution reverted: UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT'))
      ).toBe('Price moved beyond your slippage tolerance. Try again or increase slippage.');
    });

    it('maps expired deadlines', () => {
      expect(describeSwapError(new Error('UniswapV2Router: EXPIRED'))).toBe(
        'The transaction deadline expired. Please try again.'
      );
    });

    it('maps failed token transfers', () => {
      expect(describeSwapError(new Error('TRANSFER_FROM_FAILED'))).toBe(
        'Token transfer failed. Check your balance and token approval.'
      );
    });

    it('maps insufficient liquidity', () => {
      expect(describeSwapError(new Error('INSUFFICIENT_LIQUIDITY'))).toBe(
        'Not enough liquidity for this trade.'
      );
    });

    it('falls back to the original message', () => {
      expect(describeSwapError(new Error('something else'))).toBe('something else');
    });
  });
});
