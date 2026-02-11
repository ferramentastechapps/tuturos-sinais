import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TELEGRAM_API = 'https://api.telegram.org';

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // Only accept POST requests
        if (req.method !== 'POST') {
            return new Response(
                JSON.stringify({ error: 'Method not allowed' }),
                { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get bot token from Supabase secrets (never exposed to frontend)
        const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
        if (!botToken) {
            console.error('TELEGRAM_BOT_TOKEN not configured');
            return new Response(
                JSON.stringify({ error: 'Bot token not configured on server' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const body = await req.json();
        const { action, chat_id, text, parse_mode } = body;

        // Validate required fields
        if (!action) {
            return new Response(
                JSON.stringify({ error: 'Missing action parameter' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        let telegramUrl: string;
        let telegramBody: Record<string, unknown>;

        switch (action) {
            case 'sendMessage': {
                if (!chat_id || !text) {
                    return new Response(
                        JSON.stringify({ error: 'Missing chat_id or text' }),
                        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }
                telegramUrl = `${TELEGRAM_API}/bot${botToken}/sendMessage`;
                telegramBody = {
                    chat_id,
                    text,
                    parse_mode: parse_mode || 'HTML',
                    disable_web_page_preview: true,
                };
                break;
            }

            case 'getMe': {
                telegramUrl = `${TELEGRAM_API}/bot${botToken}/getMe`;
                telegramBody = {};
                break;
            }

            case 'getChat': {
                if (!chat_id) {
                    return new Response(
                        JSON.stringify({ error: 'Missing chat_id' }),
                        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }
                telegramUrl = `${TELEGRAM_API}/bot${botToken}/getChat`;
                telegramBody = { chat_id };
                break;
            }

            default: {
                return new Response(
                    JSON.stringify({ error: `Unknown action: ${action}` }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
        }

        // Call Telegram API with retry
        let response: Response | null = null;
        const maxRetries = 3;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const fetchOptions: RequestInit = {
                method: action === 'getMe' ? 'GET' : 'POST',
                headers: { 'Content-Type': 'application/json' },
            };

            if (action !== 'getMe') {
                fetchOptions.body = JSON.stringify(telegramBody);
            }

            response = await fetch(telegramUrl, fetchOptions);

            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                const waitMs = retryAfter
                    ? parseInt(retryAfter) * 1000
                    : Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                console.log(`Rate limited (429), waiting ${Math.round(waitMs)}ms before retry ${attempt + 1}`);
                await response.text();
                await new Promise(resolve => setTimeout(resolve, waitMs));
                continue;
            }
            break;
        }

        if (!response) {
            return new Response(
                JSON.stringify({ error: 'Failed to reach Telegram API after retries' }),
                { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const data = await response.json();

        return new Response(
            JSON.stringify(data),
            {
                status: response.ok ? 200 : response.status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    } catch (error) {
        console.error('Telegram proxy error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
