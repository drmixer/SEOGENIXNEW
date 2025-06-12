import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import AuthModal from './components/AuthModal';
import OnboardingModal from './components/OnboardingModal';
import { WhiteLabelProvider } from './components/WhiteLabelProvider';

function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard' | 'pricing'>('landing');
  const [userPlan, setUserPlan] = useState<'free' | 'core' | 'pro' | 'agency'>('free');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'core' | 'pro' | 'agency'>('free');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  
  // Use refs to track initialization state and prevent race conditions
  const authTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authInitializedRef = useRef(false);
  const authInProgressRef = useRef(false);

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      // Prevent multiple simultaneous initialization attempts
      if (authInProgressRef.current) {
        console.log('Auth initialization already in progress, skipping');
        return;
      }
      
      authInProgressRef.current = true;
      
      try {
        console.log('Initializing authentication...');
        setLoading(true);
        setAuthError(null);
        
        // Check if Supabase is properly configured first
        if (!isSupabaseConfigured()) {
          console.warn('Supabase is not properly configured, running in demo mode');
          setAuthError('Application is running in demo mode. Please configure Supabase credentials.');
          setLoading(false);
          setAuthInitialized(true);
          authInitializedRef.current = true;
          authInProgressRef.current = false;
          return;
        }
        
        // Clear any existing timeout
        if (authTimeoutRef.current) {
          clearTimeout(authTimeoutRef.current);
          authTimeoutRef.current = null;
        }
        
        // Set a new timeout
        authTimeoutRef.current = setTimeout(() => {
          // Only set error if we're still initializing
          if (!authInitializedRef.current) {
            console.log('Auth initialization timed out after 10 seconds');
            setAuthError('Authentication initialization timed out. This may be due to network connectivity issues or incorrect Supabase configuration. Please check your internet connection and verify your Supabase credentials.');
            setLoading(false);
            setAuthInitialized(true);
            authInitializedRef.current = true;
          }
        }, 10000);
        
        // Get session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        // Clear the timeout since we got a response
        if (authTimeoutRef.current) {
          clearTimeout(authTimeoutRef.current);
          authTimeoutRef.current = null;
        }
        
        if (error) {
          console.error('Error getting initial session:', error);
          setAuthError('Failed to initialize authentication: ' + error.message);
          setLoading(false);
          setAuthInitialized(true);
          authInitializedRef.current = true;
          authInProgressRef.current = false;
          return;
        }
        
        console.log('Initial session:', session ? 'Valid session exists' : 'No session');
        
        if (session?.user) {
          console.log('Setting user from initial session');
          setUser(session.user);
          
          // Mark as initialized before profile fetch to prevent timeout
          setAuthInitialized(true);
          authInitializedRef.current = true;
          
          // Fetch user profile to get plan - use a separate function to avoid nesting
          await fetchUserProfile(session.user.id);
        } else {
          console.log('No user in session, staying on landing page');
          setLoading(false);
          setAuthInitialized(true);
          authInitializedRef.current = true;
        }
      } catch (error) {
        console.error('Error in initializeAuth:', error);
        
        // Provide more specific error messages based on the error type
        let errorMessage = 'Authentication initialization failed.';
        
        if (error instanceof Error) {
          if (error.message.includes('timeout') || error.message.includes('timed out')) {
            errorMessage = 'Connection to authentication service timed out. Please check your internet connection and try refreshing the page.';
          } else if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage = 'Network error connecting to authentication service. Please check your internet connection.';
          } else if (error.message.includes('Invalid API key') || error.message.includes('unauthorized')) {
            errorMessage = 'Authentication service configuration error. Please contact support.';
          } else {
            errorMessage = `Authentication error: ${error.message}`;
          }
        }
        
        setAuthError(errorMessage);
        setLoading(false);
        setAuthInitialized(true);
        authInitializedRef.current = true;
      } finally {
        authInProgressRef.current = false;
      }
    };

    // Separate function to fetch user profile to reduce nesting
    const fetchUserProfile = async (userId: string) => {
      try {
        const { data: profiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (profileError) {
          console.error('Error fetching user profile:', profileError);
          // Continue with default values
        }
          
        if (profiles && profiles.length > 0) {
          console.log('User profile found:', profiles[0].id);
          setUserPlan(profiles[0].plan as any || 'free');
          
          // If onboarding is completed, go to dashboard
          if (profiles[0].onboarding_completed_at) {
            console.log('Onboarding completed, going to dashboard');
            setCurrentView('dashboard');
          } else {
            // If onboarding is not completed, show onboarding modal
            console.log('Onboarding not completed, showing onboarding modal');
            setShowOnboarding(true);
          }
        } else {
          // No profile found, show onboarding
          console.log('No profile found, showing onboarding');
          setShowOnboarding(true);
        }
        
        // Important: Set loading and authInitialized here to ensure they're set after profile fetch
        setLoading(false);
      } catch (profileError) {
        console.error('Error in profile fetch:', profileError);
        // Continue with default plan and show onboarding
        setShowOnboarding(true);
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes with better error handling
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, 'Session:', session?.user ? 'User present' : 'No user');
      
      try {
        // Clear any existing timeout when auth state changes
        if (authTimeoutRef.current) {
          clearTimeout(authTimeoutRef.current);
          authTimeoutRef.current = null;
        }
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            console.log('Setting user from auth change:', session.user.id);
            setUser(session.user);
            setAuthError(null); // Clear any previous errors
            
            // Set authInitialized to true here as well to prevent timeout
            setAuthInitialized(true);
            authInitializedRef.current = true;
            
            // Fetch user profile to get plan - use a separate function to avoid nesting
            await fetchUserProfile(session.user.id);
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out, clearing user state');
          setUser(null);
          setUserPlan('free');
          setCurrentView('landing');
          setShowOnboarding(false);
          setLoading(false);
          setAuthInitialized(true);
          authInitializedRef.current = true;
          setAuthError(null);
        }
      } catch (error) {
        console.error('Error in auth state change handler:', error);
        // Don't set authError here as it might interfere with normal operation
      }
    });

    return () => {
      console.log('Cleaning up auth subscription');
      // Clear any timeout on unmount
      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current);
        authTimeoutRef.current = null;
      }
      subscription.unsubscribe();
    };
  }, []); // CRITICAL: Empty dependency array to ensure this runs only once

  const handleNavigateToDashboard = () => {
    if (user) {
      setDashboardLoading(true);
      console.log('Navigating to dashboard for user:', user.id);
      setCurrentView('dashboard');
      setTimeout(() => setDashboardLoading(false), 300); // Reduced timeout for faster rendering
    } else {
      setAuthModalMode('login');
      setShowAuthModal(true);
    }
  };

  const handleShowSignup = () => {
    setAuthModalMode('signup');
    setShowAuthModal(true);
  };

  const handleShowLogin = () => {
    setAuthModalMode('login');
    setShowAuthModal(true);
  };

  const handleShowPricing = () => {
    setCurrentView('pricing');
  };

  const handlePlanSelect = (plan: 'free' | 'core' | 'pro' | 'agency') => {
    setSelectedPlan(plan);
    if (user) {
      // User is logged in, start onboarding
      setUserPlan(plan);
      setShowOnboarding(true);
    } else {
      // User not logged in, show signup first
      setAuthModalMode('signup');
      setShowAuthModal(true);
    }
  };
  
  const handleAuthSuccess = async () => {
    console.log('Auth success handler called');
    setShowAuthModal(false);
    setAuthError(null);
    
    try {
      // Get current session to ensure we have the latest user data
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session after auth success:', error);
        setAuthError('Failed to get session: ' + error.message);
        return;
      }
      
      if (!session?.user) {
        console.error('No user in session after auth success');
        setAuthError('Authentication succeeded but no user was found');
        return;
      }
      
      // Set user from session
      console.log('Setting user after auth success:', session.user.id);
      setUser(session.user);
      
      // Fetch user profile to get plan - use a separate function to avoid nesting
      try {
        const { data: profiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (profileError) {
          console.error('Error fetching profile after auth success:', profileError);
          // Continue with the flow using defaults
        }
          
        if (profiles && profiles.length > 0) {
          console.log('User profile found after auth success:', profiles[0].id);
          setUserPlan(profiles[0].plan as any || 'free');
          
          // If onboarding is already completed, go directly to dashboard
          if (profiles[0].onboarding_completed_at) {
            console.log('Onboarding already completed, going to dashboard');
            setCurrentView('dashboard');
            return;
          }
        }
      } catch (profileError) {
        console.error('Error in profile fetch after auth success:', profileError);
        // Continue with the flow using defaults
      }
      
      // Now proceed with the flow
      if (authModalMode === 'signup') {
        console.log('Showing onboarding for new signup');
        setUserPlan(selectedPlan);
        setShowOnboarding(true);
      } else {
        // For login, check if they need onboarding (determined above)
        console.log('Going to dashboard for login');
        setCurrentView('dashboard');
      }
    } catch (error) {
      console.error('Error in handleAuthSuccess:', error);
      setAuthError('Authentication succeeded but there was an error loading your profile. Please try refreshing the page.');
    }
  };

  const handleOnboardingComplete = async () => {
    console.log('Onboarding completed in App.tsx');
    setShowOnboarding(false);
    
    // Update user profile with selected plan if needed
    if (user) {
      try {
        const { data: existingProfiles, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (error) {
          console.error('Error checking for existing profiles:', error);
        }
          
        if (existingProfiles && existingProfiles.length > 0) {
          // Update existing profile
          console.log('Updating existing profile:', existingProfiles[0].id);
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({ 
              plan: userPlan,
              onboarding_completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', existingProfiles[0].id);
            
          if (updateError) {
            console.error('Error updating profile after onboarding:', updateError);
          }
        } else {
          // Create new profile if none exists
          console.log('Creating new profile for user:', user.id);
          const { error: insertError } = await supabase
            .from('user_profiles')
            .insert({
              user_id: user.id,
              plan: userPlan,
              onboarding_completed_at: new Date().toISOString(),
              websites: [],
              competitors: []
            });
            
          if (insertError) {
            console.error('Error creating profile after onboarding:', insertError);
          }
        }
      } catch (error) {
        console.error('Error updating user profile after onboarding:', error);
      }
    }
    
    // Set the walkthrough trigger flag BEFORE navigating to dashboard
    localStorage.setItem('seogenix_immediate_walkthrough', 'true');
    
    // Navigate to dashboard
    setCurrentView('dashboard');
  };

  const handleSignOut = async () => {
    console.log('Signing out user');
    try {
      setLoading(true);
      
      // First, clean up local storage
      localStorage.removeItem('seogenix_walkthrough_completed');
      localStorage.removeItem('seogenix_immediate_walkthrough');
      localStorage.removeItem('seogenix_tools_run');
      localStorage.removeItem('seogenix_onboarding');
      localStorage.removeItem('seogenix-auth-token');
      
      // Perform the sign out
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        console.error('Error during sign out:', error);
        throw error;
      }
      
      console.log('Sign out successful');
      
      // Ensure state is reset
      setUser(null);
      setCurrentView('landing');
      setSelectedPlan('free');
      setUserPlan('free');
      setShowOnboarding(false);
      setShowAuthModal(false);
      setAuthError(null);
      
      // Force reload the page to clear any lingering state
      window.location.reload();
    } catch (error) {
      console.error('Error signing out:', error);
      alert('There was a problem signing out. Please try again or refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryAuth = () => {
    console.log('Retrying authentication initialization...');
    setAuthError(null);
    setAuthInitialized(false);
    authInitializedRef.current = false;
    setLoading(true);
    
    // Clear any existing timeout
    if (authTimeoutRef.current) {
      clearTimeout(authTimeoutRef.current);
      authTimeoutRef.current = null;
    }
    
    // Use a safer approach than full page reload
    // This will trigger the useEffect to run again
    setTimeout(() => {
      initializeAuth();
    }, 100);
  };
  
  // Separate function to re-initialize auth (called by handleRetryAuth)
  const initializeAuth = async () => {
    if (authInProgressRef.current) {
      console.log('Auth initialization already in progress, skipping');
      return;
    }
    
    authInProgressRef.current = true;
    
    try {
      console.log('Re-initializing authentication...');
      setLoading(true);
      setAuthError(null);
      
      // Clear any existing timeout
      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current);
      }
      
      // Set a new timeout
      authTimeoutRef.current = setTimeout(() => {
        if (!authInitializedRef.current) {
          console.log('Auth re-initialization timed out after 10 seconds');
          setAuthError('Authentication initialization timed out. Please try again or refresh the page.');
          setLoading(false);
          setAuthInitialized(true);
          authInitializedRef.current = true;
        }
      }, 10000);
      
      const { data: { session }, error } = await supabase.auth.getSession();
      
      // Clear the timeout
      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current);
        authTimeoutRef.current = null;
      }
      
      if (error) {
        throw error;
      }
      
      if (session?.user) {
        setUser(session.user);
        setAuthInitialized(true);
        authInitializedRef.current = true;
        
        await fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
        setAuthInitialized(true);
        authInitializedRef.current = true;
      }
    } catch (error) {
      console.error('Error in re-initialization:', error);
      setAuthError(`Authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLoading(false);
      setAuthInitialized(true);
      authInitializedRef.current = true;
    } finally {
      authInProgressRef.current = false;
    }
  };

  // Don't render anything until auth is initialized to prevent flashing
  if (!authInitialized) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 mb-4">Initializing application...</p>
          {authError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-700 text-sm mb-3">{authError}</p>
              <button
                onClick={handleRetryAuth}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors"
              >
                Retry Connection
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
          {authError && (
            <p className="text-red-500 mt-2 max-w-md mx-auto text-sm">{authError}</p>
          )}
        </div>
      </div>
    );
  }

  if (dashboardLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <WhiteLabelProvider user={user}>
      <div className="min-h-screen bg-white">
        {currentView === 'landing' || currentView === 'pricing' ? (
          <LandingPage 
            onNavigateToDashboard={handleNavigateToDashboard}
            onPlanSelect={handlePlanSelect}
            user={user}
            onShowSignup={handleShowPricing}
            onShowLogin={handleShowLogin}
            onSignOut={handleSignOut}
            initialView={currentView}
            onNavigateToLanding={() => setCurrentView('landing')}
          />
        ) : (
          <Dashboard 
            userPlan={userPlan}
            onNavigateToLanding={() => setCurrentView('landing')}
            user={user}
            onSignOut={handleSignOut}
          />
        )}

        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onSuccess={handleAuthSuccess}
            initialMode={authModalMode}
          />
        )}

        {showOnboarding && user && (
          <OnboardingModal
            userPlan={userPlan}
            onComplete={handleOnboardingComplete}
            onClose={() => setShowOnboarding(false)}
          />
        )}
      </div>
    </WhiteLabelProvider>
  );
}

export default App;