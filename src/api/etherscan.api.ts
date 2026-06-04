const API_KEY = import.meta.env.VITE_ETHERSCAN_API_KEY;
const BASE_URL = import.meta.env.VITE_ETHERSCAN_BASE_URL;

interface RequestParams {
  chainid: number;
  module: string;
  action: string;
  [key: string]: string | number | undefined;
}

class EtherscanRequestQueue {
  private queue: Array<{
    params: RequestParams;
    timestamp: number;
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }> = [];

  private isProcessing = false;
  private lastRequestTime = 0;
  private readonly minDelayMs: number;

  constructor(minDelayMs: number = 350) {
    this.minDelayMs = minDelayMs;
  }

  async enqueue<T>(params: RequestParams): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        params,
        timestamp: Date.now(),
        resolve,
        reject,
      });

      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  private async processQueue<T>(): Promise<void> {
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const currentRequest = this.queue[0];
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      if (this.lastRequestTime > 0 && timeSinceLastRequest < this.minDelayMs) {
        const waitTime = this.minDelayMs - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      this.queue.shift();

      try {
        this.lastRequestTime = Date.now();
        const result = await etherscanRequest<T>(currentRequest.params);
        currentRequest.resolve(result);
      } catch (error) {
        currentRequest.reject(error);
      }
    }

    this.isProcessing = false;
  }
}

const requestQueue = new EtherscanRequestQueue(400);

async function etherscanRequest<T>(params: RequestParams): Promise<T> {
  const queryParams = new URLSearchParams({
    apikey: API_KEY,
    chainid: params.chainid.toString(),
    module: params.module,
    action: params.action,
    ...Object.fromEntries(
      Object.entries(params)
        .filter(([key]) => !['chainid', 'module', 'action'].includes(key))
        .map(([key, value]) => [key, String(value)])
    ),
  });

  const url = `${BASE_URL}?${queryParams.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== '1') {
      throw new Error(data.result || data.message || 'Etherscan API error');
    }

    return data as T;
  } catch (error) {
    console.error('Etherscan API request failed:', error);
    throw error;
  }
}

/**
 * Get native ETH balance for an address (V2)
 * @param address - Ethereum address
 * @param chainid - Chain ID (default: 1 for Ethereum mainnet)
 * @returns Balance in Wei as string
 */
export async function getETHBalance(
  address: string,
  chainid: number = 1
): Promise<string> {
  const response = await requestQueue.enqueue<{ result: string }>({
    chainid,
    module: 'account',
    action: 'balance',
    address: `0x${address}`,
    tag: 'latest',
  });

  return response.result;
}

/**
 * Get USDT balance for an address (V2)
 * @param address - Ethereum address
 * @param tokenAddress - contract address
 * @param chainid - Chain ID (default: 1 for Ethereum mainnet)
 * @returns Balance in USDT smallest unit (6 decimals) as string
 */
export async function getTokenBalance(
  address: string,
  tokenAddress: string = '0xdAC17F958D2ee523a2206206994597C13D831ec7'/* USDT */,
  chainid: number = 1
): Promise<string> {
  const response = await requestQueue.enqueue<{ result: string }>({
    chainid,
    module: 'account',
    action: 'tokenbalance',
    contractaddress: tokenAddress,
    address: `0x${address}`,
    tag: 'latest',
  });

  return response.result;
}

/**
 * Convert Wei to ETH
 * @param wei - Balance in Wei as string
 * @returns Balance in ETH as string
 */
export function weiToEth(wei: string): string {
  const ethValue = parseFloat(wei) / 1e18;
  return ethValue.toString();
}

/**
 * Convert token balance from smallest unit to human-readable format
 * @param balance - Balance in smallest unit as string
 * @param decimals - Token decimals (USDT = 6)
 * @returns Balance in token units as string
 */
export function tokenBalanceToHuman(balance: string, decimals: number = 6): string {
  const value = parseFloat(balance) / Math.pow(10, decimals);
  return value.toString();
}

/**
 * Format balance for display
 * @param balance - Balance as string
 * @param decimals - Number of decimal places to show
 * @returns Formatted balance string
 */
export function formatBalance(balance: string, decimals: number = 4): string {
  const numBalance = parseFloat(balance);
  return numBalance.toFixed(decimals);
}


export async function testBalances() {
  // Vitalik Buterin's address
  const testAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

  try {
    // Test ETH balance on Ethereum mainnet
    console.log(`Fetching ETH balance for: ${testAddress}`);
    const ethWei = await getETHBalance(testAddress, 1);
    const ethBalance = weiToEth(ethWei);
    console.log(`✅ ETH Balance: ${parseFloat(ethBalance).toFixed(4)} ETH\n`);

    // Test USDT balance on Ethereum mainnet
    console.log(`Fetching USDT balance for: ${testAddress}`);
    const usdtRaw = await getTokenBalance(testAddress, '0xdAC17F958D2ee523a2206206994597C13D831ec7', 1);
    const usdtBalance = tokenBalanceToHuman(usdtRaw, 6);
    console.log(`✅ USDT Balance: ${parseFloat(usdtBalance).toFixed(2)} USDT\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}
