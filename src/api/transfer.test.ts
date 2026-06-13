import { ethers } from 'ethers';
import { transferToken } from './transfer'; // Adjust path as needed
import { rpcProvider } from './provider';
import { TOKEN_INFO } from './const';

// Mock external dependencies
jest.mock('./provider');
jest.mock('./const', () => ({
  TOKEN_INFO: {
    USDC: {
      symbol: 'USDC',
      contractAddress: '0xUSDCAddress',
      decimals: 6,
    },
  },
}));

// Robust mock for ethers v6
jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers') as any;
  // Safely capture the real ethers namespace regardless of how Jest resolves it
  const realEthersNamespace = actual.ethers || actual.default || actual;

  return {
    __esModule: true,
    ...actual,
    ethers: {
      ...realEthersNamespace,
      Wallet: jest.fn(),
      Contract: jest.fn(),
      isAddress: jest.fn(),
    }
  };
});

describe('transferToken', () => {
  let mockProvider: any;
  let mockWallet: any;
  let mockContract: any;

  const mockPrivateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
  const mockRecipient = '0x1234567890123456789012345678901234567890';
  const mockWalletAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

  beforeEach(() => {
    jest.clearAllMocks();
    const actualModule = jest.requireActual('ethers') as any;
    const realEthers = actualModule.ethers || actualModule.default || actualModule;

    // Suppress console logs during tests to keep output clean
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'warn').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });

    (ethers.isAddress as unknown as jest.Mock).mockImplementation(realEthers.isAddress);

    // 1. Mock Provider
    mockProvider = {
      getTransactionCount: jest.fn().mockResolvedValue(1),
      estimateGas: jest.fn().mockResolvedValue(21000n),
      getFeeData: jest.fn().mockResolvedValue({
        maxFeePerGas: 1000000000n,
        maxPriorityFeePerGas: 100000000n,
        gasPrice: 1000000000n,
      }),
    };
    (rpcProvider.getProvider as jest.Mock).mockReturnValue(mockProvider);

    // 2. Mock Wallet
    mockWallet = {
      address: mockWalletAddress,
      sendTransaction: jest.fn().mockResolvedValue({
        hash: '0xtxhash',
        wait: jest.fn().mockResolvedValue({
          blockNumber: 123,
          gasUsed: 21000n,
          status: 1,
        }),
      }),
    };
    (ethers.Wallet as unknown as jest.Mock).mockImplementation(() => mockWallet);

    // 3. Mock Contract
    mockContract = {
      decimals: jest.fn().mockResolvedValue(6),
      interface: {
        encodeFunctionData: jest.fn().mockReturnValue('0xencodeddata'),
      },
      getFunction: jest.fn().mockReturnValue({
        estimateGas: jest.fn().mockResolvedValue(60000n),
      }),
    };
    (ethers.Contract as unknown as jest.Mock).mockImplementation(() => mockContract);
  });

  // ==================== Native ETH Tests ====================

  it('should successfully transfer native ETH', async () => {
    const result = await transferToken(
      mockPrivateKey,
      mockRecipient,
      'ETH',
      '1.5',
      { waitForConfirmation: true, confirmations: 1 }
    );

    expect(ethers.isAddress).toHaveBeenCalledWith(mockRecipient);
    expect(mockProvider.getTransactionCount).toHaveBeenCalledWith(mockWalletAddress, 'pending');
    expect(mockProvider.estimateGas).toHaveBeenCalled();
    expect(mockProvider.getFeeData).toHaveBeenCalled();
    expect(mockWallet.sendTransaction).toHaveBeenCalled();

    const txOptions = mockWallet.sendTransaction.mock.calls[0][0];
    expect(txOptions.to).toBe(mockRecipient);
    expect(txOptions.value).toBe(ethers.parseEther('1.5'));
    expect(txOptions.data).toBe('0x');

    expect(result.txHash).toBe('0xtxhash');
    expect(result.txReceipt).not.toBeNull();
    expect(result.txResponse.wait).toHaveBeenCalledWith(1);
  });

  it('should use custom gasLimit if provided for ETH', async () => {
    await transferToken(
      mockPrivateKey,
      mockRecipient,
      'ETH',
      '1',
      { gasLimit: 50000, waitForConfirmation: false }
    );

    const txOptions = mockWallet.sendTransaction.mock.calls[0][0];
    expect(txOptions.gasLimit).toBe(50000n);
    expect(mockProvider.estimateGas).not.toHaveBeenCalled();
  });

  // ==================== ERC-20 Token Tests ====================

  it('should successfully transfer ERC-20 token by symbol', async () => {
    const result = await transferToken(
      mockPrivateKey,
      mockRecipient,
      'USDC',
      '100',
      { waitForConfirmation: false }
    );

    expect(ethers.Contract).toHaveBeenCalledWith(
      (TOKEN_INFO as any).USDC.contractAddress,
      expect.any(Array),
      mockWallet
    );

    expect(mockContract.decimals).toHaveBeenCalled();
    expect(mockContract.interface.encodeFunctionData).toHaveBeenCalledWith(
      'transfer',
      [mockRecipient, ethers.parseUnits('100', 6)]
    );

    const txOptions = mockWallet.sendTransaction.mock.calls[0][0];
    expect(txOptions.to).toBe((TOKEN_INFO as any).USDC.contractAddress);
    expect(txOptions.value).toBe(0n);
    expect(txOptions.data).toBe('0xencodeddata');

    expect(result.txHash).toBe('0xtxhash');
    expect(result.txReceipt).toBeNull(); // waitForConfirmation is false
  });

  it('should successfully transfer ERC-20 token by contract address', async () => {
    await transferToken(
      mockPrivateKey,
      mockRecipient,
      '0xUSDCAddress', // Passing contract address instead of symbol
      '50',
      { waitForConfirmation: false }
    );

    expect(ethers.Contract).toHaveBeenCalledWith(
      (TOKEN_INFO as any).USDC.contractAddress,
      expect.any(Array),
      mockWallet
    );
  });

  it('should fallback to default gas limit if ERC20 gas estimation fails', async () => {
    // Simulate estimation failure
    mockContract.getFunction().estimateGas.mockRejectedValue(new Error('Estimation failed'));

    await transferToken(
      mockPrivateKey,
      mockRecipient,
      'USDC',
      '100',
      { waitForConfirmation: false }
    );

    const txOptions = mockWallet.sendTransaction.mock.calls[0][0];
    // Default is 100,000n * 120n / 100n = 120,000n
    expect(txOptions.gasLimit).toBe(120000n);
  });

  // ==================== Gas Fee Setup Tests ====================

  it('should use legacy gas price if EIP-1559 fees are null', async () => {
    mockProvider.getFeeData.mockResolvedValue({
      maxFeePerGas: null,
      maxPriorityFeePerGas: null,
      gasPrice: 2000000000n,
    });

    await transferToken(mockPrivateKey, mockRecipient, 'ETH', '1', { waitForConfirmation: false });

    const txOptions = mockWallet.sendTransaction.mock.calls[0][0];
    expect(txOptions.gasPrice).toBe(2000000000n);
    expect(txOptions.type).toBeUndefined(); // Should not set type 2 for legacy
  });

  // ==================== Error Handling Tests ====================

  it('should throw error for invalid recipient address', async () => {
    (ethers.isAddress as unknown as jest.Mock).mockReturnValue(false);

    await expect(
      transferToken(mockPrivateKey, 'invalid-address', 'ETH', '1')
    ).rejects.toThrow('Invalid recipient address: invalid-address');
  });

  it('should throw error for invalid amount', async () => {
    await expect(
      transferToken(mockPrivateKey, mockRecipient, 'ETH', '-1')
    ).rejects.toThrow('Invalid amount: -1');

    await expect(
      transferToken(mockPrivateKey, mockRecipient, 'ETH', 'abc')
    ).rejects.toThrow('Invalid amount: abc');
  });

  it('should throw error if token is not found in config', async () => {
    await expect(
      transferToken(mockPrivateKey, mockRecipient, 'UNKNOWN_TOKEN', '1')
    ).rejects.toThrow('Token not found: UNKNOWN_TOKEN');
  });

  it('should throw error if transaction fails on-chain (status 0)', async () => {
    // Override sendTransaction to return a failed receipt
    mockWallet.sendTransaction.mockResolvedValue({
      hash: '0xfailedtxhash',
      wait: jest.fn().mockResolvedValue({
        blockNumber: 124,
        gasUsed: 21000n,
        status: 0, // 0 indicates failure
      }),
    });

    await expect(
      transferToken(mockPrivateKey, mockRecipient, 'ETH', '1', { waitForConfirmation: true })
    ).rejects.toThrow('Transaction failed! Status: 0, Hash: 0xfailedtxhash');
  });
});
