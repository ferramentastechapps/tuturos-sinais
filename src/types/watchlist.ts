export interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  addedAt: Date;
  notes?: string;
  targetPrice?: number;
  alertEnabled: boolean;
}

export interface WatchlistSummary {
  items: WatchlistItem[];
  totalItems: number;
}
