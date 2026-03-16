export const fetchFromProxy = async (endpoint: string, params: Record<string, string> = {}): Promise<unknown> => {
  const searchParams = new URLSearchParams(params);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3${endpoint}?${searchParams.toString()}`,
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`CoinGecko error: ${response.status}`);
    }

    return response.json();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 3 seconds');
    }
    throw error;
  }
};
