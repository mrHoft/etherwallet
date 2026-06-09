import { ethers } from 'ethers';
import { TOKEN_INFO, MAX_PRICE_AGE_SECONDS, MULTICALL3_ADDRESS } from './const';
import { rpcProvider } from './provider';
import { tokenValue, type CachedPriceData } from './tokenPrice';

interface FormattedBalance {
  raw: string;
  formatted: string;
  decimals: number;
  usdValue?: number;
  tokenPriceUsd?: number;
  priceFeedDecimals?: number;
  isPriceStale?: boolean;
};

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

interface PriceData {
  value: bigint;
  decimals: number;
  updatedAt: bigint;
  valueInRound: bigint;
  roundId: bigint;
}

const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) public view returns (tuple(bool success, bytes returnData)[])',
  'function getEthBalance(address addr) public view returns (uint256 balance)'
];
const erc20Interface = new ethers.Interface(['function balanceOf(address) view returns (uint256)']);
const chainlinkInterface = new ethers.Interface([
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() view returns (uint8)'
]);
const tokenInfoMap = new Map(Object.entries(TOKEN_INFO));
const DECIMALS_CACHE = new Map<number, bigint>();

function getDecimalsBigInt(decimals: number): bigint {
  if (!DECIMALS_CACHE.has(decimals)) {
    DECIMALS_CACHE.set(decimals, 10n ** BigInt(decimals));
  }
  return DECIMALS_CACHE.get(decimals)!;
}

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

function separateTokens(symbols: Array<keyof typeof TOKEN_INFO>): { ethSymbol: keyof typeof TOKEN_INFO | null; erc20Symbols: Array<keyof typeof TOKEN_INFO> } {
  const ethSymbol = symbols.find(s => TOKEN_INFO[s].contractAddress === '0x0000000000000000000000000000000000000000') || null;
  const erc20Symbols = symbols.filter(s => TOKEN_INFO[s].contractAddress !== '0x0000000000000000000000000000000000000000');
  return { ethSymbol, erc20Symbols };
}

function getUniqueFeeds(symbols: Array<keyof typeof TOKEN_INFO>): string[] {
  return [...new Set(symbols.map(s => TOKEN_INFO[s].chainlinkFeed))];
}

function prepareMulticallCalls(address: string, erc20Symbols: Array<keyof typeof TOKEN_INFO>, feedsToFetch: string[]): { calls: CallRequest[]; metadata: CallMetadata[] } {
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

function parseBalances(results: readonly { success: boolean; returnData: string }[], metadata: CallMetadata[], ethSymbol: keyof typeof TOKEN_INFO | null, ethBalance: bigint): Map<string, bigint> {
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

  if (ethSymbol) {
    balances.set(ethSymbol, ethBalance);
  }

  return balances;
}

function parsePriceData(results: readonly { success: boolean; returnData: string }[], metadata: CallMetadata[], cachedFeeds: Map<string, CachedPriceData>): Map<string, PriceData> {
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
        value: decoded[1],
        updatedAt: decoded[3],
        valueInRound: decoded[4],
        decimals
      };

      priceDataMap.set(meta.feedAddress, priceData);

      tokenValue.setPriceFeed(meta.feedAddress, {
        value: priceData.value,
        decimals: priceData.decimals,
        updatedAt: priceData.updatedAt,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`Error decoding price for feed ${meta.feedAddress}:`, error);
    }
  }

  for (const [feedAddress, cached] of cachedFeeds) {
    priceDataMap.set(feedAddress, {
      value: cached.value,
      updatedAt: cached.updatedAt,
      decimals: cached.decimals,
      roundId: 0n,
      valueInRound: 0n
    });
  }

  return priceDataMap;
}

function buildResult(symbols: Array<keyof typeof TOKEN_INFO>, balances: Map<string, bigint>, priceDataMap: Map<string, PriceData>): Record<string, FormattedBalance> {
  const result: Record<string, FormattedBalance> = {};
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
    if (priceData && balance > 0n && priceData.value > 0n) {
      priceFeedDecimals = priceData.decimals;

      // Convert price to number (safe for display)
      const priceStr = ethers.formatUnits(priceData.value, priceData.decimals);
      tokenPriceUsd = parseFloat(priceStr);

      // Calculate USD value using BigInt for precision
      const decimalsBigInt = getDecimalsBigInt(tokenInfo.decimals);
      const usdValueRaw = (balance * priceData.value) / decimalsBigInt;
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

export async function getTokenBalances(address: string, symbols: Array<keyof typeof TOKEN_INFO>): Promise<Record<string, FormattedBalance>> {
  const uniqueSymbols = [...new Set(symbols)];
  validateSymbols(uniqueSymbols);

  await rpcProvider.ensureProviderHealthy();
  const provider = rpcProvider.getProvider();
  const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);

  const { ethSymbol, erc20Symbols } = separateTokens(uniqueSymbols);
  const uniqueFeeds = getUniqueFeeds(uniqueSymbols);

  const { cachedFeeds, feedsToFetch } = tokenValue.getCachedFeeds(uniqueFeeds);

  const { calls, metadata } = prepareMulticallCalls(address, erc20Symbols, feedsToFetch);

  const [multicallResults, ethBalance] = await Promise.all([
    calls.length > 0 ? multicall.aggregate3(calls) : Promise.resolve([]),
    ethSymbol ? multicall.getEthBalance(address).catch(() => 0n) : Promise.resolve(0n)
  ]);

  const balances = parseBalances(multicallResults, metadata, ethSymbol, ethBalance);
  const priceData = parsePriceData(multicallResults, metadata, cachedFeeds);

  return buildResult(uniqueSymbols, balances, priceData);
}

export async function getPortfolioValue(address: string, symbols: Array<keyof typeof TOKEN_INFO>): Promise<{ balances: Record<string, FormattedBalance>; totalUsdValue: number }> {
  const balances = await getTokenBalances(address, symbols);

  let totalUsdValue = 0;
  for (const balance of Object.values(balances)) {
    if (balance?.usdValue) {
      totalUsdValue += balance.usdValue;
    }
  }

  return { balances, totalUsdValue };
}

export async function getMultipleAddressesBalances(addresses: string[], symbols: Array<keyof typeof TOKEN_INFO>): Promise<Map<string, Record<string, FormattedBalance>>> {
  const uniqueSymbols = [...new Set(symbols)];
  validateSymbols(uniqueSymbols);
  await rpcProvider.ensureProviderHealthy();

  const provider = rpcProvider.getProvider();
  const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);

  const { ethSymbol, erc20Symbols } = separateTokens(uniqueSymbols);
  const uniqueFeeds = getUniqueFeeds(uniqueSymbols);
  const { cachedFeeds, feedsToFetch } = tokenValue.getCachedFeeds(uniqueFeeds);

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

  const allResults = allCalls.length > 0 ? await multicall.aggregate3(allCalls) : [];

  const ethBalances = await Promise.all(
    addresses.map(addr => ethSymbol ? multicall.getEthBalance(addr).catch(() => 0n) : Promise.resolve(0n))
  );

  const results = new Map<string, Record<string, FormattedBalance>>();

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

export async function example() {
  const address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

  const now = Date.now()
  try {
    const balances = await getTokenBalances(address, ['ETH', 'USDT', 'USDC']);

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
