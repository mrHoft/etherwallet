import { FallbackProvider, JsonRpcProvider } from 'ethers'

const REQUEST_TIMEOUT_MS = 2500

export class RpcProviderManager {
  private readonly networkId: number
  private readonly getRpcUrls: () => string[]
  private cachedProvider: FallbackProvider | null = null
  private cachedUrlsKey = ''

  constructor(networkId: number, getRpcUrls: () => string[]) {
    this.networkId = networkId
    this.getRpcUrls = getRpcUrls
  }

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
    return new JsonRpcProvider(url, this.networkId, { cacheTimeout: -1, polling: false, staticNetwork: true })
  }

  public getProvider(): FallbackProvider {
    const urls = this.getRpcUrls()
    if (urls.length === 0) {
      throw new Error('No RPC providers configured')
    }

    const urlsKey = urls.join('\n')
    if (!this.cachedProvider || this.cachedUrlsKey !== urlsKey) {
      this.cachedProvider?.destroy?.()
      const providers = urls.map(url => this.createProvider(url))
      this.cachedProvider = new FallbackProvider(providers, this.networkId)
      this.cachedUrlsKey = urlsKey
    }

    return this.cachedProvider
  }

  public resetProvider(): void {
    if (this.cachedProvider) {
      this.cachedProvider.destroy?.()
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
      throw new Error(`Provider is unhealthy: ${error instanceof Error ? error.message : error}`)
    }
  }

  public async checkProviderHealthy(url: string): Promise<{ healthy: boolean; latencyMs: number }> {
    let provider: JsonRpcProvider | null = null
    const startedAt = performance.now()

    try {
      provider = this.createProvider(url)
      await this.withTimeout(provider.getBlockNumber())
      return { healthy: true, latencyMs: Math.round(performance.now() - startedAt) }
    } catch {
      return { healthy: false, latencyMs: Math.round(performance.now() - startedAt) }
    } finally {
      provider?.destroy?.()
    }
  }

  public async checkAndGetProvider(): Promise<FallbackProvider | null> {
    const urls = this.getRpcUrls()
    if (urls.length === 0) {
      console.error('No RPC providers configured')
      return null
    }

    const providers = urls.map(url => this.createProvider(url))

    try {
      await Promise.all(providers.map(provider => this.withTimeout(provider.getBlockNumber())))
      return new FallbackProvider(providers, this.networkId)
    } catch (error) {
      providers.forEach(provider => provider.destroy?.())
      console.error('Failed to create provider:', error)
      return null
    }
  }
}
