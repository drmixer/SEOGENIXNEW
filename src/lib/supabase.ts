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
    detectSessionInUrl: true,
    storageKey: 'seogenix-auth-token'
  },
  global: {
    headers: {
      'x-application-name': 'seogenix'
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Test the connection
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('Error testing Supabase connection:', error);
  } else {
    console.log('Supabase connection test successful, session exists:', !!data.session);
  }
}).catch(err => {
  console.error('Exception testing Supabase connection:', err);
});

// Helper function to reset auth state - useful for debugging
export const resetAuth = async () => {
  try {
    console.log('Resetting auth state...');
    
    // Clean local storage
    localStorage.removeItem('seogenix-auth-token');
    sessionStorage.removeItem('seogenix-auth-token');
    
    // Clear all other related storage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('supabase.') || key.startsWith('seogenix_')) {
        localStorage.removeItem(key);
      }
    });
    
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('supabase.') || key.startsWith('seogenix_')) {
        sessionStorage.removeItem(key);
      }
    });
    
    // Sign out current session
    await supabase.auth.signOut({
      scope: 'global'
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
    
    if (data.session?.user) {
      console.log('DEBUG - User ID:', data.session.user.id);
      console.log('DEBUG - User email:', data.session.user.email);
      console.log('DEBUG - User metadata:', data.session.user.user_metadata);
      console.log('DEBUG - Session expires at:', new Date(data.session.expires_at * 1000).toLocaleString());
    }
    
    return { data, error };
  } catch (e) {
    console.error('DEBUG - Exception getting session:', e);
    return { data: { session: null }, error: e };
  }
};