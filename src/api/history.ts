/*
>> Unused <<
Direct scan for transaction history.
Used indexed API instead.
 */
import { ethers } from 'ethers';
import { RPC_URLS, TOKEN_INFO } from './const';

const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
];

export interface TransferEvent {
  from: string;
  to: string;
  value: ethers.BigNumberish;
  valueFormatted: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: number;
  direction: 'incoming' | 'outgoing';
}

export interface TransactionHistoryOptions {
  /** Starting block number (default: 0, will try to find deployment block) */
  fromBlock?: number;
  /** Ending block number (default: 'latest') */
  toBlock?: number | 'latest';
  /** Maximum number of blocks to query per chunk (default: 10000) */
  chunkSize?: number;
}
/**
 * Get transaction history for a specific address for an ERC20 token
 * @param tokenAddress - The ERC20 token contract address
 * @param walletAddress - The address to query transactions for
 * @param provider - ethers Provider (JsonRpcProvider, Web3Provider, etc.)
 * @param options - Optional configuration for block ranges
 * @returns Array of transfer events involving the wallet address
 */
export async function getERC20TransactionHistory(tokenAddress: string, walletAddress: string, provider: ethers.Provider, options: TransactionHistoryOptions = {}): Promise<TransferEvent[]> {
  const { fromBlock = 25000000, toBlock = 'latest', chunkSize = 10000 } = options;
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  let decimals = 18;
  try { decimals = await contract.decimals(); } catch (error) { /* use default */ }

  const endBlock = toBlock === 'latest' ? await provider.getBlockNumber() : toBlock;
  const checksummedWallet = ethers.getAddress(walletAddress);

  if (fromBlock > endBlock) throw new Error(`Invalid block range: ${fromBlock} > ${endBlock}`);

  const transferFilter = contract.filters.Transfer(checksummedWallet, null);
  const receiveFilter = contract.filters.Transfer(null, checksummedWallet);
  const allEvents: (ethers.EventLog | ethers.Log)[] = [];

  // Query events in chunks
  for (let chunkStart = fromBlock; chunkStart <= endBlock; chunkStart += chunkSize) {
    const chunkEnd = Math.min(chunkStart + chunkSize - 1, endBlock);
    const [sent, received] = await Promise.all([
      contract.queryFilter(transferFilter, chunkStart, chunkEnd),
      contract.queryFilter(receiveFilter, chunkStart, chunkEnd)
    ]);
    allEvents.push(...sent, ...received);
  }

  // Remove duplicates
  const uniqueEvents = new Map<string, ethers.EventLog | ethers.Log>();
  for (const event of allEvents) {
    const key = event.transactionHash + event.index;
    if (!uniqueEvents.has(key)) {
      uniqueEvents.set(key, event);
    }
  }

  // Get block timestamps
  const blocksNeeded = new Set<number>();
  for (const event of uniqueEvents.values()) {
    blocksNeeded.add(event.blockNumber);
  }

  const blockTimestamps = new Map<number, number>();
  const blockNums = Array.from(blocksNeeded);

  // Parallelize timestamp fetching with batching to avoid RPC rate limits
  const BATCH_SIZE = 100;
  for (let i = 0; i < blockNums.length; i += BATCH_SIZE) {
    const batch = blockNums.slice(i, i + BATCH_SIZE);
    const blocks = await Promise.all(batch.map(num => provider.getBlock(num)));
    blocks.forEach(block => {
      if (block) blockTimestamps.set(block.number, block.timestamp);
    });
  }

  // Format and sort events
  const transactions: TransferEvent[] = Array.from(uniqueEvents.values())
    // Filter out raw logs that lack parsed args (strict Ethers v6 typing)
    .filter((event): event is ethers.EventLog => 'args' in event && event.args !== undefined)
    .map(event => {
      const from = event.args.from.toLowerCase();
      const to = event.args.to.toLowerCase();
      const value = event.args.value;
      const walletLower = checksummedWallet.toLowerCase();

      let direction: 'incoming' | 'outgoing';
      if (from === walletLower) {
        direction = 'outgoing';
      } else if (to === walletLower) {
        direction = 'incoming';
      } else {
        throw new Error('Event does not involve wallet address');
      }

      return {
        from,
        to,
        value,
        valueFormatted: ethers.formatUnits(value, decimals),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: blockTimestamps.get(event.blockNumber) || 0,
        direction
      };
    })
    .sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return b.blockNumber - a.blockNumber;
      }
      return a.transactionHash.localeCompare(b.transactionHash);
    });

  return transactions;
}

/**
 * Simplified version that gets only the last N transactions
 * @param tokenAddress - ERC20 token address
 * @param walletAddress - Wallet address to query
 * @param provider - ethers Provider
 * @param limit - Maximum number of transactions to return (default: 50)
 * @returns Array of recent transfer events
 */
export async function getRecentERC20Transactions(tokenAddress: string, walletAddress: string, provider: ethers.Provider, limit: number = 50): Promise<TransferEvent[]> {
  const latestBlock = await provider.getBlockNumber();
  const blocksToSearch = 10000; // Search back ~10000 blocks

  const fromBlock = Math.max(0, latestBlock - blocksToSearch);

  const transactions = await getERC20TransactionHistory(tokenAddress, walletAddress, provider, { fromBlock, toBlock: 'latest' });

  return transactions.slice(0, limit);
}

export async function example() {
  const provider = new ethers.JsonRpcProvider(RPC_URLS[0]);
  const tokenContractAddress = TOKEN_INFO.USDT.contractAddress
  const address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

  try {
    const history = await getERC20TransactionHistory(tokenContractAddress, address, provider,
      {
        fromBlock: 25000000,
        toBlock: 'latest',
        chunkSize: 10000 // Adjust based on your RPC provider limits
      }
    );

    console.log(`Found ${history.length} transactions`);

    // Display first 5 transactions
    history.slice(0, 5).forEach(tx => {
      console.log({
        direction: tx.direction,
        amount: tx.valueFormatted,
        from: tx.from,
        to: tx.to,
        txHash: tx.transactionHash,
        block: tx.blockNumber,
        date: new Date(tx.timestamp * 1000).toISOString()
      });
    });
    /*
    // Or just get recent transactions
    const recent = await getRecentERC20Transactions(tokenContractAddress, address, provider, 20);

    console.log(`\nLast ${recent.length} transactions:`);
    recent.forEach(tx => {
      console.log(`${tx.direction.toUpperCase()}: ${tx.valueFormatted} at block ${tx.blockNumber}`);
    });
 */
  } catch (error) {
    console.error('Error fetching transaction history:', error);
  }
}
