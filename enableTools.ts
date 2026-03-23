import { createClient } from '@supabase/supabase-js';
import 'dotenv/config'; // For loading environment variables

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('Supabase URL or Publishable Key is missing in environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function enableAllTools() {
  try {
    // Setting tool_visibility to an empty object effectively enables all tools
    // as the frontend logic treats missing or empty tool_visibility as all enabled.
    const { data, error } = await supabase
      .from('app_settings')
      .upsert({ key: 'tool_visibility', value: JSON.stringify({}) }, { onConflict: 'key' });

    if (error) {
      console.error('Error enabling all tools:', error);
      process.exit(1);
    }

    console.log('All tools enabled successfully in Supabase app_settings.');
    process.exit(0);
  } catch (e) {
    console.error('An unexpected error occurred:', e);
    process.exit(1);
  }
}

enableAllTools();
