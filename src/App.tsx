import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import AuthModal from './components/AuthModal';
import OnboardingModal from './components/OnboardingModal';
import { WhiteLabelProvider } from './components/WhiteLabelProvider';
import ToastContainer from './components/ToastContainer';
import Integrations from './components/pages/Integrations';
import HelpCenter from './components/pages/HelpCenter';
import Documentation from './components/pages/Documentation';
import ContactUs from './components/pages/ContactUs';
import Status from './components/pages/Status';
import PrivacyPolicy from './components/pages/PrivacyPolicy';
import TermsOfService from './components/pages/TermsOfService';
import CookiePolicy from './components/pages/CookiePolicy';
import { useToast } from './hooks/useToast';
import { lemonsqueezyService } from './services/lemonsqueezy';

// Router wrapper to access location and navigate
function AppWithRouter() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  // Check for checkout success or cancel in URL params
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const checkoutSuccess = searchParams.get('checkout_success');
    const checkoutCancelled = searchParams.get('checkout_cancelled');
    const plan = searchParams.get('plan');
    
    if (checkoutSuccess === 'true' && plan) {
      // Show success toast
      addToast({
        id: `checkout-success-${Date.now()}`,
        type: 'success',
        title: 'Subscription Activated',
        message: `Your ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan has been activated successfully.`,
        duration: 5000,
        onClose: () => {}
      });
      
      // Remove query params
      navigate('/dashboard', { replace: true });
    } else if (checkoutCancelled === 'true') {
      // Show cancelled toast
      addToast({
        id: `checkout-cancelled-${Date.now()}`,
        type: 'info',
        title: 'Checkout Cancelled',
        message: 'Your subscription checkout was cancelled. You can try again anytime.',
        duration: 5000,
        onClose: () => {}
      });
      
      // Remove query params
      navigate('/', { replace: true });
    }
  }, [location, navigate, addToast]);
  
  return <AppContent />;
}

function App() {
  return (
    <Router>
      <AppWithRouter />
    </Router>
  );
}

function AppContent() {
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
  const { toasts, addToast, removeToast } = useToast();
  
  // Use refs to prevent race conditions and duplicate initializations
  const authInitializedRef = useRef(false);
  const initializationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const authListenerInitializedRef = useRef(false);

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      // Prevent multiple initialization attempts
      if (authInitializedRef.current) {
        console.log('Auth already initialized, skipping');
        return;
      }
      
      try {
        console.log('Initializing authentication...');
        setLoading(true);
        authInitializedRef.current = true;
        
        // Clear any existing timer
        if (initializationTimerRef.current) {
          clearTimeout(initializationTimerRef.current);
        }
        
        // Set a timeout to prevent hanging indefinitely
        initializationTimerRef.current = setTimeout(() => {
          console.log('Auth initialization timed out after 5 seconds');
          setLoading(false);
          setAuthInitialized(true);
          setAuthError('Authentication initialization timed out. Please refresh the page.');
        }, 5000);
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        // Clear the timeout since we got a response
        if (initializationTimerRef.current) {
          clearTimeout(initializationTimerRef.current);
          initializationTimerRef.current = null;
        }
        
        if (error) {
          console.error('Error getting initial session:', error);
          setAuthError('Failed to initialize authentication: ' + error.message);
          setLoading(false);
          setAuthInitialized(true);
          return;
        }
        
        console.log('Initial session:', session ? 'Valid session exists' : 'No session');
        
        if (session?.user) {
          console.log('Setting user from initial session');
          setUser(session.user);
          
          // Fetch user profile to get plan - use a separate function to avoid nesting
          await fetchUserProfile(session.user.id);
        } else {
          console.log('No user in session, staying on landing page');
          // Important: Set loading to false even when no user is found
          setLoading(false);
          setAuthInitialized(true);
        }
      } catch (error) {
        console.error('Error in initializeAuth:', error);
        setAuthError('Authentication initialization failed: ' + (error as Error).message);
        setLoading(false);
        setAuthInitialized(true);
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
        
        // Important: Set loading to false after profile is fetched
        setLoading(false);
        setAuthInitialized(true);
      } catch (profileError) {
        console.error('Error in profile fetch:', profileError);
        // Continue with default plan and show onboarding
        setShowOnboarding(true);
        setLoading(false);
        setAuthInitialized(true);
      }
    };

    // Only initialize auth once
    if (!authInitializedRef.current) {
      initializeAuth();
    }

    // Listen for auth changes - only set up once
    if (!authListenerInitializedRef.current) {
      authListenerInitializedRef.current = true;
      
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        // Clear any timeout immediately when any auth event occurs
        if (initializationTimerRef.current) {
          clearTimeout(initializationTimerRef.current);
          initializationTimerRef.current = null;
        }
        
        console.log('Auth state changed:', event, 'Session:', session?.user ? 'User present' : 'No user');
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            console.log('Setting user from auth change:', session.user.id);
            setUser(session.user);
            
            // Fetch user profile to get plan - use a separate function to avoid nesting
            await fetchUserProfile(session.user.id);
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out, clearing user state');
          setUser(null);
          setUserPlan('free');
          setCurrentView('landing');
          setShowOnboarding(false);
          setLoading(false); // Ensure loading is set to false on sign out
        } else if (event === 'INITIAL_SESSION') {
          // This event is fired when the initial session is loaded
          // We've already handled this in initializeAuth, but we'll ensure loading is false
          setLoading(false);
          setAuthInitialized(true);
        }
      });

      return () => {
        console.log('Cleaning up auth subscription');
        subscription.unsubscribe();
        
        // Clear any timeout on unmount
        if (initializationTimerRef.current) {
          clearTimeout(initializationTimerRef.current);
          initializationTimerRef.current = null;
        }
      };
    }
    
    // Empty dependency array to ensure this only runs once on mount
  }, []);

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

  const handlePlanSelect = async (plan: 'free' | 'core' | 'pro' | 'agency') => {
    setSelectedPlan(plan);
    if (user) {
      if (plan === 'free') {
        // User is logged in and selected free plan
        setUserPlan(plan);
        setShowOnboarding(true);
      } else {
        // For paid plans, check if LemonSqueezy is configured first
        if (!lemonsqueezyService.isConfigured()) {
          addToast({
            id: `payment-unavailable-${Date.now()}`,
            type: 'error',
            title: 'Payment Processing Unavailable',
            message: 'Payment processing is currently not available. Please contact support or try the free plan.',
            duration: 8000,
            onClose: () => {}
          });
          return;
        }

        // For paid plans, redirect to LemonSqueezy checkout
        try {
          const checkoutUrl = await lemonsqueezyService.getCheckoutUrl(plan, user);
          if (checkoutUrl) {
            window.location.href = checkoutUrl;
          } else {
            addToast({
              id: `checkout-error-${Date.now()}`,
              type: 'error',
              title: 'Checkout Error',
              message: 'Failed to create checkout. Please try again.',
              duration: 5000,
              onClose: () => {}
            });
          }
        } catch (err) {
          console.error('Error creating checkout:', err);
          const errorMessage = err instanceof Error ? err.message : 'An error occurred while setting up the checkout process.';
          addToast({
            id: `checkout-error-${Date.now()}`,
            type: 'error',
            title: 'Checkout Error',
            message: errorMessage,
            duration: 8000,
            onClose: () => {}
          });
        }
      }
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
      console.log('Signup successful, checking for selected plan');
      
      // If a paid plan was selected, check if LemonSqueezy is configured
      if (selectedPlan !== 'free') {
        if (!lemonsqueezyService.isConfigured()) {
          console.log('LemonSqueezy not configured, falling back to free plan');
          addToast({
            id: `payment-unavailable-${Date.now()}`,
            type: 'warning',
            title: 'Payment Processing Unavailable',
            message: 'Payment processing is currently not available. You\'ve been signed up for the free plan.',
            duration: 8000,
            onClose: () => {}
          });
          setUserPlan('free');
          setShowOnboarding(true);
          return;
        }

        try {
          console.log('Redirecting to checkout for plan:', selectedPlan);
          const checkoutUrl = await lemonsqueezyService.getCheckoutUrl(selectedPlan, session.user);
          if (checkoutUrl) {
            window.location.href = checkoutUrl;
            return; // Stop execution here as we're redirecting
          } else {
            console.error('Failed to create checkout URL');
            // Fall back to free plan if checkout creation fails
            setUserPlan('free');
            setShowOnboarding(true);
          }
        } catch (err) {
          console.error('Error creating checkout:', err);
          const errorMessage = err instanceof Error ? err.message : 'An error occurred while setting up the checkout process.';
          addToast({
            id: `checkout-error-${Date.now()}`,
            type: 'error',
            title: 'Checkout Error',
            message: errorMessage,
            duration: 8000,
            onClose: () => {}
          });
          // Fall back to free plan if checkout creation fails
          setUserPlan('free');
          setShowOnboarding(true);
        }
      } else {
        // For free plan, proceed to onboarding
        console.log('Showing onboarding for new signup with free plan');
        setUserPlan('free');
        setShowOnboarding(true);
      }
    } else {
      // For login, check if they need onboarding (determined above)
      console.log('Going to dashboard for login');
      setCurrentView('dashboard');
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
      
      // Reset auth initialization state
      authInitializedRef.current = false;
      
      // Force reload the page to clear any lingering state
      window.location.reload();
    } catch (error) {
      console.error('Error signing out:', error);
      alert('There was a problem signing out. Please try again or refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  // Don't render anything until auth is initialized to prevent flashing
  if (!authInitialized) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing application...</p>
          {authError && (
            <p className="text-red-500 mt-2 max-w-md mx-auto text-sm">{authError}</p>
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
        <Routes>
          <Route path="/" element={
            currentView === 'landing' || currentView === 'pricing' ? (
              <LandingPage 
                onNavigateToDashboard={handleNavigateToDashboard}
                onPlanSelect={handlePlanSelect}
                user={user}
                onShowSignup={handleShowSignup}
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
            )
          } />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/help-center" element={<HelpCenter />} />
          <Route path="/documentation" element={<Documentation />} />
          <Route path="/contact-us" element={<ContactUs />} />
          <Route path="/status" element={<Status />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/cookie-policy" element={<CookiePolicy />} />
        </Routes>

        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onSuccess={handleAuthSuccess}
            initialMode={authModalMode}
            selectedPlan={selectedPlan}
          />
        )}

        {showOnboarding && user && (
          <OnboardingModal
            userPlan={userPlan}
            onComplete={handleOnboardingComplete}
            onClose={() => setShowOnboarding(false)}
          />
        )}
        
        {/* Toast Notifications */}
        <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
      </div>
    </WhiteLabelProvider>
  );
}

export default App;