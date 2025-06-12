import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if we have valid Supabase credentials
const hasValidCredentials = supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'your_actual_supabase_url_here' && 
  supabaseAnonKey !== 'your_actual_supabase_anon_key_here' &&
  supabaseUrl.startsWith('https://') &&
  supabaseAnonKey.length > 20;

if (!hasValidCredentials) {
  console.warn('Supabase credentials not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

// Create a mock client for when credentials are not available
const createMockClient = () => ({
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    signOut: () => Promise.resolve({ error: null }),
    signUp: () => Promise.resolve({ data: { user: null, session: null }, error: { message: 'Supabase not configured' } }),
    signInWithPassword: () => Promise.resolve({ data: { user: null, session: null }, error: { message: 'Supabase not configured' } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    updateUser: () => Promise.resolve({ data: { user: null }, error: null })
  },
  from: () => ({
    select: () => ({
      eq: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: [], error: null })
        })
      }),
      single: () => Promise.resolve({ data: null, error: null })
    }),
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => ({
      eq: () => Promise.resolve({ data: null, error: null })
    }),
    delete: () => ({
      eq: () => Promise.resolve({ data: null, error: null })
    })
  }),
  storage: {
    from: () => ({
      upload: () => Promise.resolve({ data: null, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: '' } })
    })
  }
});

export const supabase = hasValidCredentials 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // CRITICAL: Set to false to prevent navigation errors in web containers
        storageKey: 'seogenix-auth-token',
        flowType: 'pkce'
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
    })
  : createMockClient();

// Test the connection only if we have valid credentials
if (hasValidCredentials) {
  console.log('Initializing Supabase client with valid credentials');
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error('Error testing Supabase connection:', error);
    } else {
      console.log('Supabase connection test successful, session exists:', !!data.session);
    }
  }).catch(err => {
    console.error('Exception testing Supabase connection:', err);
  });
} else {
  console.log('Supabase client initialized in mock mode - please configure your credentials');
}

// Helper function to reset auth state - useful for debugging
export const resetAuth = async () => {
  if (!hasValidCredentials) {
    console.warn('Cannot reset auth - Supabase not configured');
    return false;
  }

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
  if (!hasValidCredentials) {
    console.warn('Cannot debug session - Supabase not configured');
    return { data: { session: null }, error: { message: 'Supabase not configured' } };
  }

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

// Helper function to check if Supabase is properly configured
export const isSupabaseConfigured = () => hasValidCredentials;