import { FallbackProvider, JsonRpcProvider } from 'ethers';
import { NETWORK_ID } from './config';
import { getRpcUrls } from './rpcUrls';

const REQUEST_TIMEOUT_MS = 2500

class RPCProvider {
  private cachedProvider: FallbackProvider | null = null;
  private cachedUrlsKey = '';

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT_MS)
    })

    try {
      return await Promise.race([promise, timeoutPromise])
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }

  private createProvider(url: string): JsonRpcProvider {
    return new JsonRpcProvider(url, NETWORK_ID, { cacheTimeout: -1, polling: false, staticNetwork: true })
  }

  public getProvider(): FallbackProvider {
    const urls = getRpcUrls()
    if (urls.length === 0) {
      throw new Error('No RPC providers configured')
    }

    const urlsKey = urls.join('\n')
    if (!this.cachedProvider || this.cachedUrlsKey !== urlsKey) {
      this.cachedProvider?.destroy?.()
      const providers = urls.map(url => this.createProvider(url))
      this.cachedProvider = new FallbackProvider(providers, NETWORK_ID)
      this.cachedUrlsKey = urlsKey
    }

    return this.cachedProvider
  }

  public resetProvider(): void {
    if (this.cachedProvider) {
      this.cachedProvider.destroy?.();
    }
    this.cachedProvider = null
    this.cachedUrlsKey = ''
  }

  public async ensureProviderHealthy(): Promise<void> {
    try {
      const provider = this.getProvider()
      await this.withTimeout(provider.getBlockNumber())
    } catch (error) {
      this.resetProvider()
      throw new Error(`Provider is unhealthy: ${error instanceof Error ? error.message : error}`);
    }
  }

  public async checkProviderHealthy(url: string): Promise<boolean> {
    let provider: JsonRpcProvider | null = null

    try {
      provider = this.createProvider(url)
      await this.withTimeout(provider.getBlockNumber())
      return true
    } catch {
      return false
    } finally {
      provider?.destroy?.()
    }
  }

  public async checkAndGetProvider(): Promise<FallbackProvider | null> {
    const urls = getRpcUrls()
    if (urls.length === 0) {
      console.error('No RPC providers configured')
      return null
    }

    const providers = urls.map(url => this.createProvider(url))

    try {
      await Promise.all(providers.map(provider => this.withTimeout(provider.getBlockNumber())))
      return new FallbackProvider(providers, NETWORK_ID);
    } catch (error) {
      providers.forEach(provider => provider.destroy?.())
      console.error('Failed to create provider:', error);
      return null;
    }
  }
}

export const rpcProvider = new RPCProvider()
