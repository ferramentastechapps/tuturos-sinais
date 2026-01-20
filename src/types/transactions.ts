export type TransactionType = 'buy' | 'sell' | 'transfer_in' | 'transfer_out';

export interface Transaction {
  id: string;
  assetId: string;
  symbol: string;
  name: string;
  type: TransactionType;
  quantity: number;
  price: number;
  fee: number;
  feeAsset: string; // e.g., 'USDT', 'BNB'
  total: number; // quantity * price + fee
  notes?: string;
  exchange?: string;
  createdAt: Date;
}

export interface TransactionSummary {
  totalBought: number;
  totalSold: number;
  totalFees: number;
  netInvested: number;
  transactionCount: number;
}
