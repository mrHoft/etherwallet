import { ethers } from 'ethers';
import { RPC_URLS, TOKEN_INFO, MAX_PRICE_AGE_SECONDS } from './const';

export type TFormattedBalance = {
  raw: string;
  formatted: string;
  decimals: number;
  usdValue?: number;
  tokenPriceUsd?: number;
  priceFeedDecimals?: number;
};

const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) public view returns (tuple(bool success, bytes returnData)[])',
  'function getEthBalance(address addr) public view returns (uint256 balance)'
];

const erc20Interface = new ethers.Interface(['function balanceOf(address) view returns (uint256)']);
const chainlinkInterface = new ethers.Interface([
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() view returns (uint8)'
]);

function createFallbackProvider() {
  const providers = RPC_URLS.map(url => new ethers.JsonRpcProvider(url, 1));
  return new ethers.FallbackProvider(providers, 1);
}

/**
 * Get token balances and USD prices using Multicall3
 */
export async function getTokenBalancesWithUsd(address: string, symbols: Array<keyof typeof TOKEN_INFO>): Promise<Record<string, TFormattedBalance>> {
  for (const symbol of symbols) {
    if (!TOKEN_INFO[symbol]) {
      throw new Error(`Unknown token symbol: ${symbol}`);
    }
    if (!TOKEN_INFO[symbol].chainlinkFeed) {
      throw new Error(`No Chainlink price feed configured for symbol: ${symbol}`);
    }
  }

  const provider = createFallbackProvider();
  const multicallAddress = '0xcA11bde05977b3631167028862bE2a173976CA11'; // Multicall3 (same on all chains)
  const multicall = new ethers.Contract(multicallAddress, MULTICALL3_ABI, provider);

  // Separate ETH from ERC20 tokens
  const ethSymbol = symbols.find(s => TOKEN_INFO[s].contractAddress === '0x0000000000000000000000000000000000000000');
  const erc20Symbols = symbols.filter(s => TOKEN_INFO[s].contractAddress !== '0x0000000000000000000000000000000000000000');

  // Get unique Chainlink feed addresses
  const uniqueFeeds = [...new Set(symbols.map(s => TOKEN_INFO[s].chainlinkFeed))];

  // Prepare all multicall requests
  interface CallRequest {
    target: string;
    allowFailure: boolean;
    callData: string;
  }

  interface CallMetadata {
    type: 'balance' | 'decimals' | 'price';
    symbol?: string;
    feedAddress?: string;
  }

  const calls: CallRequest[] = [];
  const metadata: CallMetadata[] = [];

  // 1. Add ERC20 balance calls
  for (const symbol of erc20Symbols) {
    calls.push({
      target: TOKEN_INFO[symbol].contractAddress,
      allowFailure: true,
      callData: erc20Interface.encodeFunctionData('balanceOf', [address])
    });
    metadata.push({ type: 'balance', symbol });
  }

  // 2. Add decimals calls for each unique feed
  for (const feedAddress of uniqueFeeds) {
    calls.push({
      target: feedAddress,
      allowFailure: true,
      callData: chainlinkInterface.encodeFunctionData('decimals')
    });
    metadata.push({ type: 'decimals', feedAddress });
  }

  // 3. Add price calls for each unique feed
  for (const feedAddress of uniqueFeeds) {
    calls.push({
      target: feedAddress,
      allowFailure: true,
      callData: chainlinkInterface.encodeFunctionData('latestRoundData')
    });
    metadata.push({ type: 'price', feedAddress });
  }

  // Execute all calls in ONE multicall
  const results = await multicall.aggregate3(calls);

  // Parse results
  const balances = new Map<string, bigint>();
  const decimalsMap = new Map<string, number>();
  const priceDataMap = new Map<string, {
    answer: bigint;
    updatedAt: bigint;
    answeredInRound: bigint;
    roundId: bigint;
  }>();

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const meta = metadata[i];

    if (!result.success) {
      console.error(`Failed to fetch ${meta.type} for ${meta.symbol || meta.feedAddress}`);
      continue;
    }

    try {
      if (meta.type === 'balance' && meta.symbol) {
        const decoded = erc20Interface.decodeFunctionResult('balanceOf', result.returnData);
        balances.set(meta.symbol, decoded[0]);
      }
      else if (meta.type === 'decimals' && meta.feedAddress) {
        const decoded = chainlinkInterface.decodeFunctionResult('decimals', result.returnData);
        decimalsMap.set(meta.feedAddress, Number(decoded[0]));
      }
      else if (meta.type === 'price' && meta.feedAddress) {
        const decoded = chainlinkInterface.decodeFunctionResult('latestRoundData', result.returnData);
        priceDataMap.set(meta.feedAddress, {
          roundId: decoded[0],
          answer: decoded[1],
          // startedAt: decoded[2],
          updatedAt: decoded[3],
          answeredInRound: decoded[4]
        });
      }
    } catch (error) {
      console.error(`Error decoding ${meta.type} result:`, error);
    }
  }

  // Handle native ETH balance (using multicall's getEthBalance)
  let ethBalance = 0n;
  if (ethSymbol) {
    try {
      ethBalance = await multicall.getEthBalance(address);
      balances.set(ethSymbol, ethBalance);
    } catch (error) {
      console.error('Failed to fetch ETH balance:', error);
      balances.set(ethSymbol, 0n);
    }
  }

  // Build result with formatted outputs
  const result: Record<string, TFormattedBalance> = {};

  for (const symbol of symbols) {
    const tokenInfo = TOKEN_INFO[symbol];
    const balance = balances.get(symbol) || 0n;
    const formatted = ethers.formatUnits(balance, tokenInfo.decimals);

    const feedAddress = tokenInfo.chainlinkFeed;
    const priceData = priceDataMap.get(feedAddress);
    const feedDecimals = decimalsMap.get(feedAddress);

    let tokenPriceUsd: number | undefined;
    let usdValue: number | undefined;
    let priceFeedDecimals: number | undefined;

    // Calculate USD value if we have price data and balance
    if (priceData && feedDecimals !== undefined && balance > 0n && priceData.answer > 0n) {
      priceFeedDecimals = feedDecimals;

      // Convert price to number (safe for display)
      const priceStr = ethers.formatUnits(priceData.answer, feedDecimals);
      tokenPriceUsd = parseFloat(priceStr);

      // Calculate USD value using BigInt for precision
      // (balance * price) / (10^tokenDecimals)
      const usdValueRaw = (balance * priceData.answer) / (10n ** BigInt(tokenInfo.decimals));
      const usdValueFormatted = ethers.formatUnits(usdValueRaw, feedDecimals);
      usdValue = parseFloat(usdValueFormatted);

      // Check price staleness
      const currentBlockTime = Math.floor(Date.now() / 1000);
      const priceAge = currentBlockTime - Number(priceData.updatedAt);
      if (priceAge > MAX_PRICE_AGE_SECONDS) {
        console.warn(`Price feed for ${symbol} is stale. Age: ${priceAge}s`);
      }
    }

    result[symbol] = {
      raw: balance.toString(),
      formatted,
      decimals: tokenInfo.decimals,
      tokenPriceUsd,
      usdValue,
      priceFeedDecimals
    };
  }

  return result;
}

export async function getPortfolioValue(address: string, symbols: Array<keyof typeof TOKEN_INFO>): Promise<{ balances: Record<string, TFormattedBalance>; totalUsdValue: number }> {
  const balances = await getTokenBalancesWithUsd(address, symbols);

  let totalUsdValue = 0;
  for (const symbol of symbols) {
    const balance = balances[symbol];
    if (balance?.usdValue) {
      totalUsdValue += balance.usdValue;
    }
  }

  return { balances, totalUsdValue };
}

// Example usage
export async function example() {
  const address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

  const now = Date.now()
  try {
    const balances = await getTokenBalancesWithUsd(address, ['ETH', 'USDT', 'USDC']);

    console.log('=== Formatted Balances ===');
    for (const [symbol, data] of Object.entries(balances)) {
      console.log(`${symbol}: ${data.formatted} ($${data.tokenPriceUsd?.toFixed(2) || 'N/A'} each) → $${data.usdValue?.toFixed(2) || 'N/A'}`);
    }

  } catch (error) {
    console.error('Error fetching balances:', error);
  }
  console.log(`Request take ${now - Date.now()}ms`)
}
