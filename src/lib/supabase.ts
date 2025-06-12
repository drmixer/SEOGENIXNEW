import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to log session info for debugging
export const logSessionDebug = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    console.log('DEBUG - Current session:', data.session ? 'Valid session' : 'No session');
    if (error) console.error('DEBUG - Session error:', error);
    return { data, error };
  } catch (e) {
    console.error('DEBUG - Exception getting session:', e);
    return { data: { session: null }, error: e };
  }
};