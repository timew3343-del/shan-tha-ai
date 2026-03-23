import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Supabase URL or Service Role Key is missing in environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false, // Service role key does not need session persistence
  },
});

async function enableAllTools() {
  try {
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
