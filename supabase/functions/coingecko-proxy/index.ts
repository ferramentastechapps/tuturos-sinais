import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Simple in-memory cache
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute cache

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

    // Fetch from CoinGecko
    const coinGeckoUrl = `${COINGECKO_API}${endpoint}${params.toString() ? '?' + params.toString() : ''}`;
    console.log(`Fetching from CoinGecko: ${coinGeckoUrl}`);

    const response = await fetch(coinGeckoUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`CoinGecko error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: `CoinGecko API error: ${response.status}` }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
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
