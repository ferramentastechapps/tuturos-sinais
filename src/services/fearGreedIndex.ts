// Fear & Greed Index Service
// Uses Alternative.me API for real crypto market sentiment

const FEAR_GREED_API = 'https://api.alternative.me/fng/';

export interface FearGreedData {
  value: number;
  valueClassification: 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed';
  timestamp: number;
  timeUntilUpdate: number;
}

export interface FearGreedResponse {
  name: string;
  data: Array<{
    value: string;
    value_classification: string;
    timestamp: string;
    time_until_update: string;
  }>;
}

export const fetchFearGreedIndex = async (): Promise<FearGreedData> => {
  try {
    const response = await fetch(`${FEAR_GREED_API}?limit=1`);
    
    if (!response.ok) {
      throw new Error(`Fear & Greed API error: ${response.status}`);
    }

    const data: FearGreedResponse = await response.json();
    const latest = data.data[0];

    return {
      value: parseInt(latest.value),
      valueClassification: latest.value_classification as FearGreedData['valueClassification'],
      timestamp: parseInt(latest.timestamp) * 1000,
      timeUntilUpdate: parseInt(latest.time_until_update || '0'),
    };
  } catch (error) {
    console.error('Error fetching Fear & Greed Index:', error);
    // Fallback to neutral value
    return {
      value: 50,
      valueClassification: 'Neutral',
      timestamp: Date.now(),
      timeUntilUpdate: 0,
    };
  }
};

export const getSentimentFromValue = (value: number): 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed' => {
  if (value <= 25) return 'extreme_fear';
  if (value <= 45) return 'fear';
  if (value <= 55) return 'neutral';
  if (value <= 75) return 'greed';
  return 'extreme_greed';
};

export const getTrendFromValue = (value: number): 'bullish' | 'bearish' | 'sideways' => {
  if (value >= 60) return 'bullish';
  if (value <= 40) return 'bearish';
  return 'sideways';
};
