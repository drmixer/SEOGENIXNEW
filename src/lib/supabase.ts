import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.');
}

console.log('Initializing Supabase client with:', { 
  hasUrl: !!supabaseUrl, 
  hasKey: !!supabaseAnonKey,
  urlStart: supabaseUrl?.substring(0, 10) + '...' || 'missing'
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Helper function to reset auth state - useful for debugging
export const resetAuth = async () => {
  try {
    localStorage.removeItem('supabase.auth.token');
    sessionStorage.removeItem('supabase.auth.token');
    
    // Sign out current session if any
    await supabase.auth.signOut({
      scope: 'local'
    });
    
    console.log('Auth state has been reset');
    return true;
  } catch (e) {
    console.error('Error resetting auth state:', e);
    return false;
  }
};

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