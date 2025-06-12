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

// Test URL accessibility before creating client
const testSupabaseConnection = async (url: string): Promise<boolean> => {
  try {
    // Simple fetch test to check if the URL is reachable
    const response = await fetch(`${url}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });
    return response.ok || response.status === 401; // 401 is expected without proper auth
  } catch (error) {
    console.error('Supabase connection test failed:', error);
    return false;
  }
};

// CRITICAL FIX: Configure Supabase client with better error handling and connection validation
export const supabase = hasValidCredentials 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // CRITICAL: Disable URL detection to prevent navigation errors in web containers
        detectSessionInUrl: false,
        storageKey: 'seogenix-auth-token',
        flowType: 'pkce',
        // Add retry configuration
        retryAttempts: 3,
        retryDelay: 1000
      },
      global: {
        headers: {
          'x-application-name': 'seogenix'
        },
        // Add fetch configuration with timeout
        fetch: (url, options = {}) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          return fetch(url, {
            ...options,
            signal: controller.signal
          }).finally(() => {
            clearTimeout(timeoutId);
          }).catch(error => {
            if (error.name === 'AbortError') {
              throw new Error('Request timeout - please check your network connection');
            }
            throw error;
          });
        }
      },
      // Disable realtime subscriptions in web containers to prevent WebSocket issues
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    })
  : createMockClient();

// Test the connection only if we have valid credentials - with better error handling
if (hasValidCredentials) {
  console.log('Initializing Supabase client with valid credentials');
  
  // Test connection first
  testSupabaseConnection(supabaseUrl).then(isConnectable => {
    if (!isConnectable) {
      console.error('Supabase URL is not accessible. Please check your network connection and URL configuration.');
      return;
    }
    
    // Only test session if connection is working
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Error testing Supabase connection:', error);
        // Don't throw here, just log the error
      } else {
        console.log('Supabase connection test successful, session exists:', !!data.session);
      }
    }).catch(err => {
      console.error('Exception testing Supabase connection:', err);
      // Don't throw here, just log the error
    });
  }).catch(err => {
    console.error('Failed to test Supabase connection:', err);
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
    
    // Sign out current session with error handling
    try {
      await supabase.auth.signOut({
        scope: 'global'
      });
    } catch (signOutError) {
      console.warn('Error during sign out (this may be expected):', signOutError);
    }
    
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

// Helper function to check connection health
export const checkSupabaseHealth = async () => {
  if (!hasValidCredentials) {
    return { healthy: false, error: 'Supabase not configured' };
  }

  try {
    const isConnectable = await testSupabaseConnection(supabaseUrl);
    if (!isConnectable) {
      return { healthy: false, error: 'Cannot reach Supabase URL' };
    }

    const { error } = await supabase.auth.getSession();
    return { 
      healthy: !error, 
      error: error?.message || null 
    };
  } catch (e) {
    return { 
      healthy: false, 
      error: e instanceof Error ? e.message : 'Unknown error' 
    };
  }
};