import { ethers } from 'ethers';
import { TOKEN_INFO, MAX_PRICE_AGE_SECONDS } from './const';
import { rpcProvider } from './provider';

export const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)'
];

export const CHAINLINK_AGGREGATOR_ABI = [
  'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() external view returns (uint8)'
];

export type TFormattedBalance = {
  raw: string;
  formatted: string;
  decimals: number;
  usdValue?: number;
  tokenPriceUsd?: number;
  priceFeedDecimals?: number;
};

async function getTokenBalance(provider: ethers.FallbackProvider, address: string, tokenAddress: string): Promise<bigint> {
  if (tokenAddress === '0x0000000000000000000000000000000000000000') {
    return await provider.getBalance(address);
  } else {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    return await contract.balanceOf(address);
  }
}

/**
 * Get USD price from Chainlink price feed with staleness and round validity checks
 * @param feedAddress - Chainlink price feed contract address
 * @param provider - Ethers provider
 * @returns Price data including raw bigint answer for exact calculations
 */
async function getChainlinkPrice(feedAddress: string, provider: ethers.FallbackProvider): Promise<{
  rawAnswer: bigint;
  price: number;
  decimals: number;
  timestamp: number
}> {
  const feed = new ethers.Contract(feedAddress, CHAINLINK_AGGREGATOR_ABI, provider);
  const roundData = await feed.latestRoundData();

  if (roundData.answeredInRound < roundData.roundId) {
    throw new Error(`Chainlink feed ${feedAddress} returned stale round data.`);
  }

  const feedDecimals = await feed.decimals();

  const priceStr = ethers.formatUnits(roundData.answer, feedDecimals);
  const price = parseFloat(priceStr);

  const currentBlockTime = Math.floor(Date.now() / 1000);
  const priceAge = currentBlockTime - Number(roundData.updatedAt);

  if (priceAge > MAX_PRICE_AGE_SECONDS) {
    console.warn(`Chainlink price feed ${feedAddress} is stale. Last updated ${priceAge} seconds ago.`);
  }

  if (roundData.answer <= 0n) {
    throw new Error(`Chainlink price feed ${feedAddress} returned invalid price: ${roundData.answer}`);
  }

  return {
    rawAnswer: roundData.answer,
    price,
    decimals: Number(feedDecimals),
    timestamp: Number(roundData.updatedAt)
  };
}

/**
 * Get token balances with USD values using Chainlink price feeds
 * Uses BigInt for exact USD calculations to avoid floating-point precision loss
 * @param address - Ethereum address
 * @param symbols - Array of token symbols (e.g., ['ETH', 'USDT', 'USDC'])
 * @returns Object with token symbols as keys and formatted balances including USD values
 */
export async function getTokenBalances(address: string, symbols: Array<keyof typeof TOKEN_INFO>): Promise<Record<string, TFormattedBalance>> {
  for (const symbol of symbols) {
    if (!TOKEN_INFO[symbol]) {
      throw new Error(`Unknown token symbol: ${symbol}`);
    }
    if (!TOKEN_INFO[symbol].chainlinkFeed) {
      throw new Error(`No Chainlink price feed configured for symbol: ${symbol}`);
    }
  }

  const provider = rpcProvider.getProvider();
  const result: Record<string, TFormattedBalance> = {};

  const balancePromises = symbols.map(async (symbol) => {
    const tokenInfo = TOKEN_INFO[symbol];
    const balance = await getTokenBalance(provider, address, tokenInfo.contractAddress);
    return { symbol, balance, tokenInfo };
  });

  const balanceResults = await Promise.allSettled(balancePromises);

  const balances = balanceResults
    .filter((r): r is PromiseFulfilledResult<{ symbol: keyof typeof TOKEN_INFO; balance: bigint; tokenInfo: typeof TOKEN_INFO[keyof typeof TOKEN_INFO] }> =>
      r.status === 'fulfilled'
    )
    .map(r => r.value);

  balanceResults.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`Failed to fetch balance for ${symbols[i]}:`, r.reason);
    }
  });

  const uniqueFeeds = new Set<string>();
  for (const { tokenInfo } of balances) {
    uniqueFeeds.add(tokenInfo.chainlinkFeed);
  }

  const pricePromises = Array.from(uniqueFeeds).map(async (feedAddress) => {
    try {
      const priceData = await getChainlinkPrice(feedAddress, provider);
      return { feedAddress, priceData, success: true };
    } catch (error) {
      console.error(`Failed to fetch price for feed ${feedAddress}:`, error);
      return { feedAddress, priceData: null, success: false };
    }
  });

  const priceResults = await Promise.all(pricePromises);

  const priceMap = new Map<string, { rawAnswer: bigint; price: number; decimals: number; timestamp: number }>();
  for (const result of priceResults) {
    if (result.success && result.priceData) {
      priceMap.set(result.feedAddress, result.priceData);
    }
  }

  for (const { symbol, balance, tokenInfo } of balances) {
    const feedAddress = tokenInfo.chainlinkFeed;
    const priceInfo = priceMap.get(feedAddress);

    const formatted = ethers.formatUnits(balance, tokenInfo.decimals);

    let usdValue: number | undefined;
    let tokenPriceUsd: number | undefined;
    let priceFeedDecimals: number | undefined;

    if (priceInfo && balance > 0n) {
      tokenPriceUsd = priceInfo.price;
      priceFeedDecimals = priceInfo.decimals;

      const usdValueRaw = (balance * priceInfo.rawAnswer) / (10n ** BigInt(tokenInfo.decimals));
      const usdValueFormatted = ethers.formatUnits(usdValueRaw, priceInfo.decimals);
      usdValue = parseFloat(usdValueFormatted);
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
  const balances = await getTokenBalances(address, symbols);

  let totalUsdValue = 0;
  for (const symbol of symbols) {
    const balance = balances[symbol];
    if (balance?.usdValue) {
      totalUsdValue += balance.usdValue;
    }
  }

  return {
    balances,
    totalUsdValue
  };
}

// Usage example
export async function example(address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045') {
  try {
    // Get balances with USD values
    const balances = await getTokenBalances(address, Object.keys(TOKEN_INFO));

    console.log('Balances with USD values:');
    for (const [symbol, data] of Object.entries(balances)) {
      console.log(`${symbol}: ${data.formatted} (${data.tokenPriceUsd ? `$${data.tokenPriceUsd.toFixed(2)} each` : 'price unavailable'}) → USD Value: ${data.usdValue ? `$${data.usdValue.toFixed(2)}` : 'N/A'}`);
    }

    // Get total portfolio value
    const portfolio = await getPortfolioValue(address, Object.keys(TOKEN_INFO));
    console.log(`\nTotal Portfolio Value: $${portfolio.totalUsdValue.toFixed(2)}`);
  } catch (error) {
    console.error('Error fetching balances:', error);
  }
}
