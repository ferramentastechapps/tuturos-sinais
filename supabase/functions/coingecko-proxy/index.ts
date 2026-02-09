import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Simple in-memory cache
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minute cache

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint');
    
    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: 'Missing endpoint parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build CoinGecko URL with remaining params
    const params = new URLSearchParams();
    url.searchParams.forEach((value, key) => {
      if (key !== 'endpoint') {
        params.append(key, value);
      }
    });

    const cacheKey = `${endpoint}?${params.toString()}`;
    
    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`Cache hit for: ${cacheKey}`);
      return new Response(
        JSON.stringify(cached.data),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Cache': 'HIT'
          } 
        }
      );
    }

    // Fetch from CoinGecko with retry on 429
    const coinGeckoUrl = `${COINGECKO_API}${endpoint}${params.toString() ? '?' + params.toString() : ''}`;
    console.log(`Fetching from CoinGecko: ${coinGeckoUrl}`);

    let response: Response | null = null;
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      response = await fetch(coinGeckoUrl, {
        headers: { 'Accept': 'application/json' },
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitMs = retryAfter
          ? parseInt(retryAfter) * 1000
          : Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.log(`Rate limited (429), waiting ${Math.round(waitMs)}ms before retry ${attempt + 1}`);
        await response.text(); // consume body
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }
      break;
    }

    if (!response || !response.ok) {
      const status = response?.status || 500;
      const errorText = response ? await response.text() : 'No response';
      console.error(`CoinGecko error: ${status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: `CoinGecko API error: ${status}` }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    // Store in cache
    cache.set(cacheKey, { data, timestamp: Date.now() });
    console.log(`Cached response for: ${cacheKey}`);

    return new Response(
      JSON.stringify(data),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Cache': 'MISS'
        } 
      }
    );
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
