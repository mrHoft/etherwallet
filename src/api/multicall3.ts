import { ethers } from 'ethers';
import {
  RPC_URLS,
  TOKEN_INFO,
  MAX_PRICE_AGE_SECONDS,
  MULTICALL3_ADDRESS,
  PRICE_CACHE_DURATION_MS
} from './const';

export type TFormattedBalance = {
  raw: string;
  formatted: string;
  decimals: number;
  usdValue?: number;
  tokenPriceUsd?: number;
  priceFeedDecimals?: number;
  isPriceStale?: boolean;
};

// ABIs
const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) public view returns (tuple(bool success, bytes returnData)[])',
  'function getEthBalance(address addr) public view returns (uint256 balance)'
];

const erc20Interface = new ethers.Interface(['function balanceOf(address) view returns (uint256)']);
const chainlinkInterface = new ethers.Interface([
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() view returns (uint8)'
]);

// Types for internal use
interface CallRequest {
  target: string;
  allowFailure: boolean;
  callData: string;
}

interface CallMetadata {
  type: 'balance' | 'decimals' | 'price';
  symbol?: string;
  feedAddress?: string;
  address?: string;
}

interface CachedPriceData {
  answer: bigint;
  decimals: number;
  updatedAt: bigint;
  timestamp: number;
}

interface PriceData {
  answer: bigint;
  updatedAt: bigint;
  answeredInRound: bigint;
  roundId: bigint;
  decimals: number;
}

// Cache for price feeds
const priceFeedCache = new Map<string, CachedPriceData>();

// Singleton provider instance
let cachedProvider: ethers.FallbackProvider | null = null;

// Pre-computed token info map for faster lookups
const tokenInfoMap = new Map(Object.entries(TOKEN_INFO));

// Pre-computed decimals as BigInt for common values
const DECIMALS_CACHE = new Map<number, bigint>();

function getDecimalsBigInt(decimals: number): bigint {
  if (!DECIMALS_CACHE.has(decimals)) {
    DECIMALS_CACHE.set(decimals, 10n ** BigInt(decimals));
  }
  return DECIMALS_CACHE.get(decimals)!;
}

/**
 * Get or create singleton provider instance
 */
function getProvider(): ethers.FallbackProvider {
  if (!cachedProvider) {
    const providers = RPC_URLS.map(url => new ethers.JsonRpcProvider(url, 1));
    cachedProvider = new ethers.FallbackProvider(providers, 1);
  }
  return cachedProvider;
}

/**
 * Reset provider (useful for error recovery)
 */
export function resetProvider(): void {
  cachedProvider = null;
}

/**
 * Check if provider is healthy
 */
async function ensureProviderHealthy(): Promise<void> {
  const provider = getProvider();
  try {
    await provider.getBlockNumber();
  } catch (error) {
    cachedProvider = null;
    throw new Error(`Provider is unhealthy: ${error}`);
  }
}

/**
 * Validate symbols and throw early if invalid
 */
function validateSymbols(symbols: Array<keyof typeof TOKEN_INFO>): void {
  const missingTokens = symbols.filter(s => !TOKEN_INFO[s]);
  if (missingTokens.length) {
    throw new Error(`Unknown token symbols: ${missingTokens.join(', ')}`);
  }

  const missingFeeds = symbols.filter(s => !TOKEN_INFO[s].chainlinkFeed);
  if (missingFeeds.length) {
    throw new Error(`No Chainlink price feed configured for: ${missingFeeds.join(', ')}`);
  }
}

/**
 * Separate ETH from ERC20 tokens
 */
function separateTokens(symbols: Array<keyof typeof TOKEN_INFO>): {
  ethSymbol: keyof typeof TOKEN_INFO | null;
  erc20Symbols: Array<keyof typeof TOKEN_INFO>;
} {
  const ethSymbol = symbols.find(s => TOKEN_INFO[s].contractAddress === '0x0000000000000000000000000000000000000000') || null;
  const erc20Symbols = symbols.filter(s => TOKEN_INFO[s].contractAddress !== '0x0000000000000000000000000000000000000000');
  return { ethSymbol, erc20Symbols };
}

/**
 * Get unique Chainlink feed addresses
 */
function getUniqueFeeds(symbols: Array<keyof typeof TOKEN_INFO>): string[] {
  return [...new Set(symbols.map(s => TOKEN_INFO[s].chainlinkFeed))];
}

/**
 * Get cached price feeds
 */
function getCachedFeeds(feedAddresses: string[]): {
  cachedFeeds: Map<string, CachedPriceData>;
  feedsToFetch: string[];
} {
  const cachedFeeds = new Map<string, CachedPriceData>();
  const feedsToFetch: string[] = [];
  const now = Date.now();

  for (const feedAddress of feedAddresses) {
    const cached = priceFeedCache.get(feedAddress);
    if (cached && (now - cached.timestamp) < PRICE_CACHE_DURATION_MS) {
      cachedFeeds.set(feedAddress, cached);
    } else {
      feedsToFetch.push(feedAddress);
    }
  }

  return { cachedFeeds, feedsToFetch };
}

/**
 * Prepare multicall requests for balances and uncached price feeds
 */
function prepareMulticallCalls(
  address: string,
  erc20Symbols: Array<keyof typeof TOKEN_INFO>,
  feedsToFetch: string[]
): { calls: CallRequest[]; metadata: CallMetadata[] } {
  const calls: CallRequest[] = [];
  const metadata: CallMetadata[] = [];

  // Add ERC20 balance calls
  for (const symbol of erc20Symbols) {
    calls.push({
      target: TOKEN_INFO[symbol].contractAddress,
      allowFailure: true,
      callData: erc20Interface.encodeFunctionData('balanceOf', [address])
    });
    metadata.push({ type: 'balance', symbol });
  }

  // Add decimals calls for feeds to fetch
  for (const feedAddress of feedsToFetch) {
    calls.push({
      target: feedAddress,
      allowFailure: true,
      callData: chainlinkInterface.encodeFunctionData('decimals')
    });
    metadata.push({ type: 'decimals', feedAddress });
  }

  // Add price calls for feeds to fetch
  for (const feedAddress of feedsToFetch) {
    calls.push({
      target: feedAddress,
      allowFailure: true,
      callData: chainlinkInterface.encodeFunctionData('latestRoundData')
    });
    metadata.push({ type: 'price', feedAddress });
  }

  return { calls, metadata };
}

/**
 * Parse balance results from multicall
 */
function parseBalances(
  results: readonly { success: boolean; returnData: string }[],
  metadata: CallMetadata[],
  ethSymbol: keyof typeof TOKEN_INFO | null,
  ethBalance: bigint
): Map<string, bigint> {
  const balances = new Map<string, bigint>();

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const meta = metadata[i];

    if (!result.success || meta.type !== 'balance' || !meta.symbol) {
      continue;
    }

    try {
      const decoded = erc20Interface.decodeFunctionResult('balanceOf', result.returnData);
      balances.set(meta.symbol, decoded[0]);
    } catch (error) {
      console.error(`Error decoding balance for ${meta.symbol}:`, error);
      balances.set(meta.symbol, 0n);
    }
  }

  // Add ETH balance if applicable
  if (ethSymbol) {
    balances.set(ethSymbol, ethBalance);
  }

  return balances;
}

/**
 * Parse price data from multicall results and cache
 */
function parsePriceData(
  results: readonly { success: boolean; returnData: string }[],
  metadata: CallMetadata[],
  cachedFeeds: Map<string, CachedPriceData>
): Map<string, PriceData> {
  const priceDataMap = new Map<string, PriceData>();
  const decimalsMap = new Map<string, number>();

  // First pass: get decimals
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const meta = metadata[i];

    if (!result.success || meta.type !== 'decimals' || !meta.feedAddress) {
      continue;
    }

    try {
      const decoded = chainlinkInterface.decodeFunctionResult('decimals', result.returnData);
      decimalsMap.set(meta.feedAddress, Number(decoded[0]));
    } catch (error) {
      console.error(`Error decoding decimals for feed ${meta.feedAddress}:`, error);
    }
  }

  // Second pass: get price data
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const meta = metadata[i];

    if (!result.success || meta.type !== 'price' || !meta.feedAddress) {
      continue;
    }

    const decimals = decimalsMap.get(meta.feedAddress);
    if (decimals === undefined) {
      continue;
    }

    try {
      const decoded = chainlinkInterface.decodeFunctionResult('latestRoundData', result.returnData);
      const priceData: PriceData = {
        roundId: decoded[0],
        answer: decoded[1],
        updatedAt: decoded[3],
        answeredInRound: decoded[4],
        decimals
      };

      priceDataMap.set(meta.feedAddress, priceData);

      // Cache the price data
      priceFeedCache.set(meta.feedAddress, {
        answer: priceData.answer,
        decimals: priceData.decimals,
        updatedAt: priceData.updatedAt,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`Error decoding price for feed ${meta.feedAddress}:`, error);
    }
  }

  // Add cached feeds to the map
  for (const [feedAddress, cached] of cachedFeeds) {
    priceDataMap.set(feedAddress, {
      answer: cached.answer,
      updatedAt: cached.updatedAt,
      decimals: cached.decimals,
      roundId: 0n,
      answeredInRound: 0n
    });
  }

  return priceDataMap;
}

/**
 * Build final result with formatted balances and USD values
 */
function buildResult(
  symbols: Array<keyof typeof TOKEN_INFO>,
  balances: Map<string, bigint>,
  priceDataMap: Map<string, PriceData>
): Record<string, TFormattedBalance> {
  const result: Record<string, TFormattedBalance> = {};
  const currentBlockTime = Math.floor(Date.now() / 1000);

  for (const symbol of symbols) {
    const tokenInfo = tokenInfoMap.get(symbol);
    if (!tokenInfo) {
      throw new Error(`Token info not found for ${symbol}`);
    }

    const balance = balances.get(symbol) || 0n;
    const formatted = ethers.formatUnits(balance, tokenInfo.decimals);

    const feedAddress = tokenInfo.chainlinkFeed;
    const priceData = priceDataMap.get(feedAddress);

    let tokenPriceUsd: number | undefined;
    let usdValue: number | undefined;
    let priceFeedDecimals: number | undefined;
    let isPriceStale: boolean | undefined;

    // Calculate USD value if we have price data and balance
    if (priceData && balance > 0n && priceData.answer > 0n) {
      priceFeedDecimals = priceData.decimals;

      // Convert price to number (safe for display)
      const priceStr = ethers.formatUnits(priceData.answer, priceData.decimals);
      tokenPriceUsd = parseFloat(priceStr);

      // Calculate USD value using BigInt for precision
      const decimalsBigInt = getDecimalsBigInt(tokenInfo.decimals);
      const usdValueRaw = (balance * priceData.answer) / decimalsBigInt;
      const usdValueFormatted = ethers.formatUnits(usdValueRaw, priceData.decimals);
      usdValue = parseFloat(usdValueFormatted);

      // Check price staleness
      const priceAge = currentBlockTime - Number(priceData.updatedAt);
      isPriceStale = priceAge > MAX_PRICE_AGE_SECONDS;

      if (isPriceStale) {
        console.warn(`Price feed for ${symbol} is stale. Age: ${priceAge}s`);
      }
    }

    result[symbol] = {
      raw: balance.toString(),
      formatted,
      decimals: tokenInfo.decimals,
      tokenPriceUsd,
      usdValue,
      priceFeedDecimals,
      isPriceStale
    };
  }

  return result;
}

/**
 * Get token balances and USD prices using Multicall3 with optimizations
 */
export async function getTokenBalancesWithUsd(
  address: string,
  symbols: Array<keyof typeof TOKEN_INFO>
): Promise<Record<string, TFormattedBalance>> {
  // Deduplicate symbols
  const uniqueSymbols = [...new Set(symbols)];

  // Early validation
  validateSymbols(uniqueSymbols);

  // Ensure provider is healthy
  await ensureProviderHealthy();

  const provider = getProvider();
  const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);

  // Separate tokens and get unique feeds
  const { ethSymbol, erc20Symbols } = separateTokens(uniqueSymbols);
  const uniqueFeeds = getUniqueFeeds(uniqueSymbols);

  // Get cached price data
  const { cachedFeeds, feedsToFetch } = getCachedFeeds(uniqueFeeds);

  // Prepare multicall requests for uncached data
  const { calls, metadata } = prepareMulticallCalls(address, erc20Symbols, feedsToFetch);

  // Execute in parallel - multicall and ETH balance
  const [multicallResults, ethBalance] = await Promise.all([
    calls.length > 0 ? multicall.aggregate3(calls) : Promise.resolve([]),
    ethSymbol ? multicall.getEthBalance(address).catch(() => 0n) : Promise.resolve(0n)
  ]);

  // Parse results
  const balances = parseBalances(multicallResults, metadata, ethSymbol, ethBalance);
  const priceData = parsePriceData(multicallResults, metadata, cachedFeeds);

  // Build final result
  return buildResult(uniqueSymbols, balances, priceData);
}

/**
 * Get portfolio value with total USD sum
 */
export async function getPortfolioValue(
  address: string,
  symbols: Array<keyof typeof TOKEN_INFO>
): Promise<{ balances: Record<string, TFormattedBalance>; totalUsdValue: number }> {
  const balances = await getTokenBalancesWithUsd(address, symbols);

  let totalUsdValue = 0;
  for (const balance of Object.values(balances)) {
    if (balance?.usdValue) {
      totalUsdValue += balance.usdValue;
    }
  }

  return { balances, totalUsdValue };
}

/**
 * Batch multiple addresses in a single multicall
 */
export async function getMultipleAddressesBalances(
  addresses: string[],
  symbols: Array<keyof typeof TOKEN_INFO>
): Promise<Map<string, Record<string, TFormattedBalance>>> {
  const uniqueSymbols = [...new Set(symbols)];
  validateSymbols(uniqueSymbols);
  await ensureProviderHealthy();

  const provider = getProvider();
  const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);

  const { ethSymbol, erc20Symbols } = separateTokens(uniqueSymbols);
  const uniqueFeeds = getUniqueFeeds(uniqueSymbols);
  const { cachedFeeds, feedsToFetch } = getCachedFeeds(uniqueFeeds);

  // Prepare calls for all addresses
  const allCalls: CallRequest[] = [];
  const addressMetadata: Array<{ address: string; startIndex: number; endIndex: number; ethSymbol: typeof ethSymbol }> = [];

  for (const address of addresses) {
    const { calls/* , metadata */ } = prepareMulticallCalls(address, erc20Symbols, feedsToFetch);
    addressMetadata.push({
      address,
      startIndex: allCalls.length,
      endIndex: allCalls.length + calls.length,
      ethSymbol
    });
    allCalls.push(...calls);
  }

  // Execute single multicall for all addresses
  const allResults = allCalls.length > 0 ? await multicall.aggregate3(allCalls) : [];

  // Get ETH balances in parallel
  const ethBalances = await Promise.all(
    addresses.map(addr => ethSymbol ? multicall.getEthBalance(addr).catch(() => 0n) : Promise.resolve(0n))
  );

  // Parse results per address
  const results = new Map<string, Record<string, TFormattedBalance>>();

  for (let i = 0; i < addresses.length; i++) {
    const { address, startIndex, endIndex } = addressMetadata[i];
    const addressResults = allResults.slice(startIndex, endIndex);
    const ethBalance = ethBalances[i];

    const balances = parseBalances(addressResults, [], ethSymbol, ethBalance);
    const priceData = parsePriceData(addressResults, [], cachedFeeds);
    const formattedBalances = buildResult(uniqueSymbols, balances, priceData);

    results.set(address, formattedBalances);
  }

  return results;
}

export function clearPriceCache(): void {
  priceFeedCache.clear();
}

export function getPriceCache(): { size: number; feeds: string[] } {
  return {
    size: priceFeedCache.size,
    feeds: Array.from(priceFeedCache.keys())
  };
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
  console.log(`Request take ${Date.now() - now}ms`)

  // Multiple addresses
  // const multiBalances = await getMultipleAddressesBalances(['0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0', '0x...'], ['ETH', 'USDT']);
}
