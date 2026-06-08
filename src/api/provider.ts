import { ethers } from 'ethers';
import { RPC_URLS } from './const';

class RPCProvider {
  private cachedProvider: ethers.FallbackProvider | null = null;

  public getProvider(): ethers.FallbackProvider {
    if (!this.cachedProvider) {
      const providers = RPC_URLS.map(url => new ethers.JsonRpcProvider(url, 1));
      this.cachedProvider = new ethers.FallbackProvider(providers, 1);
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
      throw new Error(`Provider is unhealthy: ${error instanceof Error ? error.message : error}`);
    }
  }
}

export const fallbackProvider = new RPCProvider()
