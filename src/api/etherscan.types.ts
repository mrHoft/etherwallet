export interface EtherscanResponse<T> {
  status: string;
  message: string;
  result: T;
}

export interface ETHBalanceResponse {
  status: string;
  message: string;
  result: string; // Balance in Wei as string
}

export interface TokenBalanceResponse {
  status: string;
  message: string;
  result: string; // Balance in token's smallest unit
}
