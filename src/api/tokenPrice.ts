import { TOKEN_INFO, PRICE_CACHE_DURATION_MS } from './const';

export interface CachedPriceData {
  value: bigint;
  decimals: number;
  updatedAt: bigint;
  timestamp: number;
}

class TokenPrice {
  private priceFeedCache = new Map<string, CachedPriceData>();

  public getTokenPrice(tokenSymbol: string) {
    const feedAddress = TOKEN_INFO[tokenSymbol]?.contractAddress
    if (!feedAddress) throw new Error(`Token info not found for ${tokenSymbol}`)

    const data = this.priceFeedCache.get(feedAddress);
    return data ? parseFloat(data.value.toString()) / 10 ** data.decimals : 0;
  }

  public setPriceFeed(feedAddress: string, data: CachedPriceData) {
    this.priceFeedCache.set(feedAddress, data);
  }

  public getCachedFeeds(feedAddresses: string[]): { cachedFeeds: Map<string, CachedPriceData>; feedsToFetch: string[] } {
    const cachedFeeds = new Map<string, CachedPriceData>();
    const feedsToFetch: string[] = [];
    const now = Date.now();

    for (const feedAddress of feedAddresses) {
      const cached = this.priceFeedCache.get(feedAddress);
      if (cached && (now - cached.timestamp) < PRICE_CACHE_DURATION_MS) {
        cachedFeeds.set(feedAddress, cached);
      } else {
        feedsToFetch.push(feedAddress);
      }
    }

    return { cachedFeeds, feedsToFetch };
  }

  public clearPriceCache(): void {
    this.priceFeedCache.clear();
  }

  public getPriceCache(): { size: number; feeds: string[] } {
    return { size: this.priceFeedCache.size, feeds: Array.from(this.priceFeedCache.keys()) };
  }
}

export const tokenValue = new TokenPrice()
