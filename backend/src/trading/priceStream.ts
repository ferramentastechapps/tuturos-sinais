import { WebsocketClient, RestClientV5 } from 'bybit-api';
import { EventEmitter } from 'events';

export interface PriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
}

export class PriceStream extends EventEmitter {
  private wsClient: WebsocketClient;
  private restClient: RestClientV5;
  private activeSymbols: Set<string> = new Set();
  private isConnected: boolean = false;
  private fallbackInterval: NodeJS.Timeout | null = null;
  private pricesCache: Map<string, number> = new Map();

  constructor() {
    super();
    this.wsClient = new WebsocketClient({
      market: 'v5',
    });

    this.restClient = new RestClientV5();

    this.setupWsEvents();
  }

  private setupWsEvents() {
    this.wsClient.on('update', (data: any) => {
      // Bybit v5 ticker update
      if (data.topic && data.topic.startsWith('tickers.')) {
        const symbol = data.data.symbol;
        const lastPrice = parseFloat(data.data.lastPrice);
        if (!isNaN(lastPrice)) {
          this.pricesCache.set(symbol, lastPrice);
          this.emit('priceUpdate', {
            symbol,
            price: lastPrice,
            timestamp: Date.now()
          } as PriceUpdate);
        }
      }
    });

    this.wsClient.on('open', () => {
      this.isConnected = true;
      this.stopFallback();
      this.resubscribeAll();
      console.log('[PriceStream] WebSocket Connected');
    });

    this.wsClient.on('error', (err: any) => {
      console.error('[PriceStream] WebSocket Error', err);
    });

    this.wsClient.on('close', () => {
      this.isConnected = false;
      this.startFallback();
      console.log('[PriceStream] WebSocket Closed, falling back to REST');
    });
  }

  public subscribe(symbol: string) {
    if (!this.activeSymbols.has(symbol)) {
      this.activeSymbols.add(symbol);
      if (this.isConnected) {
        this.wsClient.subscribeV5(`tickers.${symbol}`, 'linear'); 
      } else {
        // Force fallback check if disconnected
        this.startFallback();
      }
    }
  }

  public unsubscribe(symbol: string) {
    if (this.activeSymbols.has(symbol)) {
      this.activeSymbols.delete(symbol);
      if (this.isConnected) {
        this.wsClient.unsubscribeV5(`tickers.${symbol}`, 'linear');
      }
    }
  }

  private resubscribeAll() {
    for (const symbol of this.activeSymbols) {
      this.wsClient.subscribeV5(`tickers.${symbol}`, 'linear');
    }
  }

  private startFallback() {
    if (this.fallbackInterval) return;
    if (this.activeSymbols.size === 0) return;
    
    console.log('[PriceStream] Starting REST fallback polling (5s)');
    
    this.fallbackInterval = setInterval(async () => {
      if (this.activeSymbols.size === 0) return;
      
      try {
        for (const symbol of this.activeSymbols) {
            const response = await this.restClient.getTickers({
                 category: 'linear',
                 symbol: symbol
            });
            if (response.retCode === 0 && response.result.list.length > 0) {
              const lastPrice = parseFloat(response.result.list[0].lastPrice);
              if (!isNaN(lastPrice)) {
                  this.pricesCache.set(symbol, lastPrice);
                  this.emit('priceUpdate', {
                      symbol,
                      price: lastPrice,
                      timestamp: Date.now()
                  } as PriceUpdate);
              }
            }
        }
      } catch (error) {
        console.error('[PriceStream] REST Fallback error', error);
      }
    }, 5000);
  }

  private stopFallback() {
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
      console.log('[PriceStream] Stopped REST fallback polling');
    }
  }

  public getCachedPrice(symbol: string): number | undefined {
    return this.pricesCache.get(symbol);
  }
}

export const priceStream = new PriceStream();
