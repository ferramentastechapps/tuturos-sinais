export type AlertCondition = 'above' | 'below';

export interface PriceAlert {
  id: string;
  symbol: string;
  name: string;
  targetPrice: number;
  condition: AlertCondition;
  createdAt: Date;
  triggered: boolean;
  triggeredAt?: Date;
}

export interface PriceAlertFormData {
  symbol: string;
  name: string;
  targetPrice: number;
  condition: AlertCondition;
}
