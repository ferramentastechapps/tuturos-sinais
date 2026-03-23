import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis de ambiente do backend
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') }); // fallback
dotenv.config({ path: path.join(__dirname, '../.env.production') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function exportData() {
  console.log('Exporting historical data from Supabase (trade_signals)...');
  
  const { data, error } = await supabase
    .from('trade_signals')
    .select('*')
    .limit(10000);
    
  if (error) {
    console.error('Error fetching data from Supabase:', error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('No data found in trade_signals table.');
    return;
  }
  
  console.log(`Found ${data.length} historical records.`);
  
  const dataDir = path.join(__dirname, '../../ml_engine/data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const outFile = path.join(dataDir, 'historical_ml_data.jsonl');
  
  let content = '';
  for (const row of data) {
    content += JSON.stringify(row) + '\n';
  }
  
  fs.writeFileSync(outFile, content, 'utf-8');
  console.log(`Export completed! Saved to: ${outFile}`);
}

exportData().catch(console.error);
