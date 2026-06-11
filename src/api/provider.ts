import { FallbackProvider, JsonRpcProvider } from 'ethers';
import { RPC_URLS, NETWORK_ID } from './const';

class RPCProvider {
  private cachedProvider: FallbackProvider | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  private timeoutPromise = () => new Promise((_, reject) => {
    this.timeoutId = setTimeout(() => reject(new Error('Request timeout')), 2500);
  });

  public getProvider(): FallbackProvider {
    if (!this.cachedProvider) {
      const providers = RPC_URLS.map(url => new JsonRpcProvider(url, NETWORK_ID, { cacheTimeout: -1, polling: false, staticNetwork: true }));
      this.cachedProvider = new FallbackProvider(providers, NETWORK_ID);
    }
    return this.cachedProvider;
  }

  public resetProvider(): void {
    if (this.cachedProvider) {
      this.cachedProvider.destroy?.();
    }
    this.cachedProvider = null;
  }

  public async ensureProviderHealthy(): Promise<void> {
    const provider = this.getProvider();
    try {
      const blockNumberPromise = provider.getBlockNumber();
      await Promise.race([blockNumberPromise, this.timeoutPromise()]);
      if (this.timeoutId) {
        clearTimeout(this.timeoutId)
        this.timeoutId = null
      }
    } catch (error) {
      this.resetProvider();
      throw new Error(`Provider is unhealthy: ${error instanceof Error ? error.message : error}`);
    }
  }

  public async checkAndGetProvider(): Promise<FallbackProvider | null> {
    try {
      const providers = await Promise.all(
        RPC_URLS.map(async (url) => {
          const provider = new JsonRpcProvider(url, NETWORK_ID, { staticNetwork: true, polling: false });

          await Promise.race([provider.getBlockNumber(), this.timeoutPromise()]);
          if (this.timeoutId) {
            clearTimeout(this.timeoutId)
            this.timeoutId = null
          }
          return provider;
        })
      );

      return new FallbackProvider(providers, NETWORK_ID);
    } catch (error) {
      console.error('Failed to create provider:', error);
      return null;
    }
  }
}

export const rpcProvider = new RPCProvider()
