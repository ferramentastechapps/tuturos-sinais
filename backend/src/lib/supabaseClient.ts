// Supabase Client — Server-side (no localStorage)

import { createClient } from '@supabase/supabase-js';
import { logger } from './logger.js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    logger.warn('Supabase credentials not configured. Database features will be unavailable.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
