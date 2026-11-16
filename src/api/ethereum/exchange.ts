import { ethers } from 'ethers';
import { TOKEN_INFO, UNISWAP_V2_ROUTER_ADDRESS, type TokenInfo } from './config';
import { rpcProvider } from './provider';

const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';
const BPS_DENOMINATOR = 10_000n;
const GAS_BUFFER_PERCENT = 120n;
const FEE_BUFFER_PERCENT = 110n;

export const DEFAULT_SLIPPAGE_BPS = 50;
export const MAX_SLIPPAGE_BPS = 5_000;
export const SWAP_DEADLINE_SECONDS = 20 * 60;

export type SwapKind = 'tokenToToken' | 'ethToToken' | 'tokenToEth';

export type SwapMode = 'exactIn' | 'exactOut';

export type SwapStage = 'approving' | 'waitingApproval' | 'swapping' | 'waitingConfirmation';

export interface SwapQuote {
  mode: SwapMode;
  amountIn: bigint;
  amountOut: bigint;
  amountInMax: bigint;
  amountOutMin: bigint;
  path: string[];
  pathSymbols: string[];
  kind: SwapKind;
  deadline: bigint;
  slippageBps: number;
}

export interface ExecuteSwapOptions {
  mode?: SwapMode;
  slippageBps?: number;
  waitForConfirmation?: boolean;
  confirmations?: number;
  gasLimit?: bigint;
  onStage?: (stage: SwapStage) => void;
}

export interface SwapResult {
  txHash: string;
  approvalTxHash?: string;
  txReceipt: ethers.TransactionReceipt | null;
  quote: SwapQuote;
}

const ROUTER_ABI = [
  'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)',
  'function getAmountsIn(uint256 amountOut, address[] path) view returns (uint256[] amounts)',
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)',
  'function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[] amounts)',
  'function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)',
  'function swapTokensForExactTokens(uint256 amountOut, uint256 amountInMax, address[] path, address to, uint256 deadline) returns (uint256[] amounts)',
  'function swapETHForExactTokens(uint256 amountOut, address[] path, address to, uint256 deadline) payable returns (uint256[] amounts)',
  'function swapTokensForExactETH(uint256 amountOut, uint256 amountInMax, address[] path, address to, uint256 deadline) returns (uint256[] amounts)',
];

const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

export const resolveTokenInfo = (symbolOrAddress: string): TokenInfo => {
  const normalizedValue = symbolOrAddress.trim().toLowerCase();
  const tokenInfo =
    TOKEN_INFO[symbolOrAddress] ||
    Object.entries(TOKEN_INFO).find(([symbol]) => symbol.toLowerCase() === normalizedValue)?.[1] ||
    Object.values(TOKEN_INFO).find(info => info.contractAddress.toLowerCase() === normalizedValue);

  if (!tokenInfo) {
    throw new Error(`Token not found: ${symbolOrAddress}`);
  }

  return tokenInfo;
};

const isNativeToken = (tokenInfo: TokenInfo): boolean =>
  tokenInfo.contractAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS;

const getWethAddress = (): string => {
  const weth = TOKEN_INFO.WETH;
  if (!weth) {
    throw new Error('WETH token is not configured');
  }
  return weth.contractAddress;
};

const getPathAddress = (tokenInfo: TokenInfo): string =>
  isNativeToken(tokenInfo) ? getWethAddress() : tokenInfo.contractAddress;

const getSymbolForAddress = (address: string): string => {
  const normalizedAddress = address.toLowerCase();
  const entry = Object.entries(TOKEN_INFO).find(
    ([, info]) => info.contractAddress.toLowerCase() === normalizedAddress
  );
  return entry ? entry[0] : address;
};

const buildSwapPath = (from: string, to: string): { path: string[]; kind: SwapKind } => {
  const fromInfo = resolveTokenInfo(from);
  const toInfo = resolveTokenInfo(to);
  const fromNative = isNativeToken(fromInfo);
  const toNative = isNativeToken(toInfo);

  if (fromNative && toNative) {
    throw new Error('Cannot swap ETH to ETH');
  }

  const fromAddress = getPathAddress(fromInfo);
  const toAddress = getPathAddress(toInfo);

  if (fromAddress.toLowerCase() === toAddress.toLowerCase()) {
    throw new Error('Select two different tokens');
  }

  const kind: SwapKind = fromNative ? 'ethToToken' : toNative ? 'tokenToEth' : 'tokenToToken';

  return { path: [fromAddress, toAddress], kind };
};

const parseAmount = (amount: string | number, decimals: number, symbol: string): bigint => {
  const value = amount.toString().trim();

  if (!/^\d*\.?\d+$/.test(value)) {
    throw new Error(`Invalid amount: ${amount}`);
  }

  let parsedAmount: bigint;
  try {
    parsedAmount = ethers.parseUnits(value, decimals);
  } catch {
    throw new Error(`Invalid amount for ${symbol}: maximum ${decimals} decimal places`);
  }

  if (parsedAmount <= 0n) {
    throw new Error('Amount must be greater than 0');
  }

  return parsedAmount;
};

const validateSlippage = (slippageBps: number): void => {
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > MAX_SLIPPAGE_BPS) {
    throw new Error(`Slippage must be between 0% and ${MAX_SLIPPAGE_BPS / 100}%`);
  }
};

const isCallException = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === 'CALL_EXCEPTION';

const readAmounts = async (
  router: ethers.Contract,
  amount: bigint,
  path: string[],
  mode: SwapMode
): Promise<bigint[]> => {
  const amounts =
    mode === 'exactIn'
      ? await router.getAmountsOut(amount, path)
      : await router.getAmountsIn(amount, path);

  return Array.from(amounts as ArrayLike<bigint>, value => BigInt(value));
};

const getAmountsWithFallback = async (
  router: ethers.Contract,
  amount: bigint,
  path: string[],
  kind: SwapKind,
  mode: SwapMode
): Promise<{ amounts: bigint[]; path: string[] }> => {
  try {
    return { amounts: await readAmounts(router, amount, path, mode), path };
  } catch (error) {
    if (kind === 'tokenToToken') {
      const wethAddress = getWethAddress();
      const [fromAddress, toAddress] = path;
      const usesWeth =
        fromAddress.toLowerCase() === wethAddress.toLowerCase() ||
        toAddress.toLowerCase() === wethAddress.toLowerCase();

      if (!usesWeth) {
        const fallbackPath = [fromAddress, wethAddress, toAddress];
        try {
          return {
            amounts: await readAmounts(router, amount, fallbackPath, mode),
            path: fallbackPath,
          };
        } catch {
          // Preserve the original direct-route error below.
        }
      }
    }

    if (isCallException(error)) {
      throw new Error('No swap route found for this pair');
    }

    throw error;
  }
};

export async function getSwapQuote(
  from: string,
  to: string,
  amount: string | number,
  slippageBps: number = DEFAULT_SLIPPAGE_BPS,
  mode: SwapMode = 'exactIn'
): Promise<SwapQuote> {
  validateSlippage(slippageBps);

  const fromInfo = resolveTokenInfo(from);
  const toInfo = resolveTokenInfo(to);
  const { path, kind } = buildSwapPath(from, to);
  const quotedToken = mode === 'exactIn' ? fromInfo : toInfo;
  const requestedAmount = parseAmount(amount, quotedToken.decimals, quotedToken.symbol);

  const provider = rpcProvider.getProvider();
  const router = new ethers.Contract(UNISWAP_V2_ROUTER_ADDRESS, ROUTER_ABI, provider);
  const { amounts, path: resolvedPath } = await getAmountsWithFallback(
    router,
    requestedAmount,
    path,
    kind,
    mode
  );

  const amountIn = mode === 'exactIn' ? requestedAmount : amounts[0];
  const amountOut = mode === 'exactIn' ? amounts[amounts.length - 1] : requestedAmount;

  if (amountIn === undefined || amountIn <= 0n || amountOut === undefined || amountOut <= 0n) {
    throw new Error('No swap route found for this pair');
  }

  const slippage = BigInt(slippageBps);
  const amountOutMin =
    mode === 'exactIn'
      ? (amountOut * (BPS_DENOMINATOR - slippage)) / BPS_DENOMINATOR
      : amountOut;
  const amountInMax =
    mode === 'exactIn'
      ? amountIn
      : (amountIn * (BPS_DENOMINATOR + slippage) + BPS_DENOMINATOR - 1n) / BPS_DENOMINATOR;

  const deadline = BigInt(Math.floor(Date.now() / 1000) + SWAP_DEADLINE_SECONDS);

  return {
    mode,
    amountIn,
    amountOut,
    amountInMax,
    amountOutMin,
    path: resolvedPath,
    pathSymbols: resolvedPath.map(getSymbolForAddress),
    kind,
    deadline,
    slippageBps,
  };
}

const getFeeOverrides = async (provider: ethers.Provider): Promise<ethers.Overrides> => {
  const feeData = await provider.getFeeData();

  if (feeData.maxFeePerGas !== null && feeData.maxPriorityFeePerGas !== null) {
    return {
      maxFeePerGas: (feeData.maxFeePerGas * FEE_BUFFER_PERCENT) / 100n,
      maxPriorityFeePerGas: (feeData.maxPriorityFeePerGas * FEE_BUFFER_PERCENT) / 100n,
      type: 2,
    };
  }

  if (feeData.gasPrice !== null) {
    return { gasPrice: feeData.gasPrice };
  }

  return {};
};

const addGasBuffer = (estimatedGas: bigint): bigint =>
  (estimatedGas * GAS_BUFFER_PERCENT) / 100n;

const waitForTransaction = async (
  tx: ethers.ContractTransactionResponse,
  confirmations: number
): Promise<ethers.TransactionReceipt> => {
  const receipt = await tx.wait(confirmations);

  if (!receipt) {
    throw new Error('Transaction receipt not found');
  }

  if (receipt.status === 0) {
    throw new Error(`Transaction failed! Status: ${receipt.status}, Hash: ${tx.hash}`);
  }

  return receipt;
};

const getApprovalReceipt = async (
  token: ethers.Contract,
  spender: string,
  amount: bigint,
  overrides: ethers.Overrides
): Promise<ethers.ContractTransactionResponse> => {
  return token.approve(spender, amount, overrides);
};

export async function executeSwap(
  privateKey: string,
  from: string,
  to: string,
  amount: string | number,
  options: ExecuteSwapOptions = {}
): Promise<SwapResult> {
  const provider = rpcProvider.getProvider();
  const wallet = new ethers.Wallet(privateKey, provider);
  const mode = options.mode ?? 'exactIn';
  const slippageBps = options.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
  const confirmations = options.confirmations ?? 1;
  const quote = await getSwapQuote(from, to, amount, slippageBps, mode);

  const router = new ethers.Contract(UNISWAP_V2_ROUTER_ADDRESS, ROUTER_ABI, wallet);
  const feeOverrides = await getFeeOverrides(provider);
  const feeWithGas = (gasLimit: bigint): ethers.Overrides => ({ ...feeOverrides, gasLimit });

  let approvalTxHash: string | undefined;

  if (quote.kind !== 'ethToToken') {
    const fromInfo = resolveTokenInfo(from);
    const token = new ethers.Contract(fromInfo.contractAddress, ERC20_ABI, wallet);
    const allowance: bigint = await token.allowance(wallet.address, UNISWAP_V2_ROUTER_ADDRESS);

    if (allowance < quote.amountInMax) {
      options.onStage?.('approving');

      if (allowance > 0n) {
        const resetTx = await getApprovalReceipt(token, UNISWAP_V2_ROUTER_ADDRESS, 0n, feeOverrides);
        await waitForTransaction(resetTx, confirmations);
      }

      const approvalTx = await getApprovalReceipt(
        token,
        UNISWAP_V2_ROUTER_ADDRESS,
        quote.amountInMax,
        feeOverrides
      );
      approvalTxHash = approvalTx.hash;

      options.onStage?.('waitingApproval');
      await waitForTransaction(approvalTx, confirmations);
    }
  }

  options.onStage?.('swapping');

  let txResponse: ethers.ContractTransactionResponse;

  if (quote.mode === 'exactIn') {
    if (quote.kind === 'tokenToToken') {
      let gasLimit = options.gasLimit;
      if (!gasLimit) {
        const estimatedGas = await router.swapExactTokensForTokens.estimateGas(
          quote.amountIn,
          quote.amountOutMin,
          quote.path,
          wallet.address,
          quote.deadline
        );
        gasLimit = addGasBuffer(estimatedGas);
      }

      txResponse = await router.swapExactTokensForTokens(
        quote.amountIn,
        quote.amountOutMin,
        quote.path,
        wallet.address,
        quote.deadline,
        feeWithGas(gasLimit)
      );
    } else if (quote.kind === 'ethToToken') {
      let gasLimit = options.gasLimit;
      if (!gasLimit) {
        const estimatedGas = await router.swapExactETHForTokens.estimateGas(
          quote.amountOutMin,
          quote.path,
          wallet.address,
          quote.deadline,
          { value: quote.amountIn }
        );
        gasLimit = addGasBuffer(estimatedGas);
      }

      txResponse = await router.swapExactETHForTokens(
        quote.amountOutMin,
        quote.path,
        wallet.address,
        quote.deadline,
        { ...feeWithGas(gasLimit), value: quote.amountIn }
      );
    } else {
      let gasLimit = options.gasLimit;
      if (!gasLimit) {
        const estimatedGas = await router.swapExactTokensForETH.estimateGas(
          quote.amountIn,
          quote.amountOutMin,
          quote.path,
          wallet.address,
          quote.deadline
        );
        gasLimit = addGasBuffer(estimatedGas);
      }

      txResponse = await router.swapExactTokensForETH(
        quote.amountIn,
        quote.amountOutMin,
        quote.path,
        wallet.address,
        quote.deadline,
        feeWithGas(gasLimit)
      );
    }
  } else if (quote.kind === 'tokenToToken') {
    let gasLimit = options.gasLimit;
    if (!gasLimit) {
      const estimatedGas = await router.swapTokensForExactTokens.estimateGas(
        quote.amountOut,
        quote.amountInMax,
        quote.path,
        wallet.address,
        quote.deadline
      );
      gasLimit = addGasBuffer(estimatedGas);
    }

    txResponse = await router.swapTokensForExactTokens(
      quote.amountOut,
      quote.amountInMax,
      quote.path,
      wallet.address,
      quote.deadline,
      feeWithGas(gasLimit)
    );
  } else if (quote.kind === 'ethToToken') {
    let gasLimit = options.gasLimit;
    if (!gasLimit) {
      const estimatedGas = await router.swapETHForExactTokens.estimateGas(
        quote.amountOut,
        quote.path,
        wallet.address,
        quote.deadline,
        { value: quote.amountInMax }
      );
      gasLimit = addGasBuffer(estimatedGas);
    }

    txResponse = await router.swapETHForExactTokens(
      quote.amountOut,
      quote.path,
      wallet.address,
      quote.deadline,
      { ...feeWithGas(gasLimit), value: quote.amountInMax }
    );
  } else {
    let gasLimit = options.gasLimit;
    if (!gasLimit) {
      const estimatedGas = await router.swapTokensForExactETH.estimateGas(
        quote.amountOut,
        quote.amountInMax,
        quote.path,
        wallet.address,
        quote.deadline
      );
      gasLimit = addGasBuffer(estimatedGas);
    }

    txResponse = await router.swapTokensForExactETH(
      quote.amountOut,
      quote.amountInMax,
      quote.path,
      wallet.address,
      quote.deadline,
      feeWithGas(gasLimit)
    );
  }

  let txReceipt: ethers.TransactionReceipt | null = null;

  if (options.waitForConfirmation !== false) {
    options.onStage?.('waitingConfirmation');
    txReceipt = await waitForTransaction(txResponse, confirmations);
  }

  return {
    txHash: txResponse.hash,
    approvalTxHash,
    txReceipt,
    quote,
  };
}

const SWAP_ERROR_MESSAGES: Array<[string, string]> = [
  ['INSUFFICIENT_OUTPUT_AMOUNT', 'Price moved beyond your slippage tolerance. Try again or increase slippage.'],
  ['EXPIRED', 'The transaction deadline expired. Please try again.'],
  ['TRANSFER_FROM_FAILED', 'Token transfer failed. Check your balance and token approval.'],
  ['INSUFFICIENT_LIQUIDITY', 'Not enough liquidity for this trade.'],
  ['INSUFFICIENT_INPUT_AMOUNT', 'The input amount is too small for this trade.'],
];

export const describeSwapError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);

  for (const [reason, friendlyMessage] of SWAP_ERROR_MESSAGES) {
    if (message.includes(reason)) {
      return friendlyMessage;
    }
  }

  return message || 'Swap failed';
};
