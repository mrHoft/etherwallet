import { FallbackProvider, JsonRpcProvider } from 'ethers';
import { RPC_URLS, NETWORK_ID } from './const';

class RPCProvider {
  private cachedProvider: FallbackProvider | null = null;

  public getProvider(): FallbackProvider {
    if (!this.cachedProvider) {
      const providers = RPC_URLS.map(url => new JsonRpcProvider(url, NETWORK_ID));
      this.cachedProvider = new FallbackProvider(providers, NETWORK_ID);
    }
    return this.cachedProvider;
  }

  public resetProvider(): void {
    this.cachedProvider = null;
  }

  public async ensureProviderHealthy(): Promise<void> {
    const provider = this.getProvider();
    try {
      await provider.getBlockNumber();
    } catch (error) {
      this.cachedProvider = null;
      // throw new Error(`Provider is unhealthy: ${error instanceof Error ? error.message : error}`);
      console.log(error)
    }
  }
}

export const rpcProvider = new RPCProvider()
