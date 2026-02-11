const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://owchjtzucnhsvlkwdapn.supabase.co";

export const fetchFromProxy = async (endpoint: string, params: Record<string, string> = {}): Promise<unknown> => {
  const searchParams = new URLSearchParams({ endpoint, ...params });

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/coingecko-proxy?${searchParams.toString()}`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Proxy error: ${response.status}`);
  }

  return response.json();
};
