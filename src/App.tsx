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

// Simplified App component structure
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

// Main content component with simplified state and effects
function AppContent() {
  const [user, setUser] = useState<any>(null);
  const [userPlan, setUserPlan] = useState<'free' | 'core' | 'pro' | 'agency'>('free');
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'core' | 'pro' | 'agency'>('free');
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const { toasts, addToast, removeToast } = useToast();
  
  const location = useLocation();
  const navigate = useNavigate();

  // Effect for handling auth state changes
  useEffect(() => {
    setLoading(true);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      const currentUser = session?.user || null;
      setUser(currentUser);

      if (currentUser) {
        // Fetch user profile
        try {
          const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();
          
          if (error) {
            console.error('Error fetching profile:', error);
          }
          
          if (profile) {
            setUserPlan(profile.plan || 'free');
            if (!profile.onboarding_completed_at) {
              setShowOnboarding(true);
            }
          } else {
            setShowOnboarding(true); // New user, show onboarding
          }
        } catch (e) {
          console.error('Exception fetching profile:', e);
          setShowOnboarding(true);
        }
      } else {
        // Reset user state if not logged in
        setUserPlan('free');
        setShowOnboarding(false);
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Effect for handling checkout success/cancel messages
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const checkoutSuccess = searchParams.get('checkout_success');
    const checkoutCancelled = searchParams.get('checkout_cancelled');
    const plan = searchParams.get('plan');

    if (checkoutSuccess === 'true' && plan) {
      addToast({
        id: `checkout-success-${Date.now()}`,
        type: 'success',
        title: 'Subscription Activated',
        message: `Your ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan has been activated.`,
        duration: 5000,
        onClose: () => {}
      });
      navigate(location.pathname, { replace: true });
    } else if (checkoutCancelled === 'true') {
      addToast({
        id: `checkout-cancelled-${Date.now()}`,
        type: 'info',
        title: 'Checkout Cancelled',
        message: 'Your checkout was cancelled. You can try again anytime.',
        duration: 5000,
        onClose: () => {}
      });
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate, addToast]);

  const handleNavigateToDashboard = () => {
    if (user) {
      setDashboardLoading(true);
      // Use React Router's navigate function for SPA navigation
      navigate('/dashboard');
      setTimeout(() => setDashboardLoading(false), 300);
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
        // Debug LemonSqueezy configuration
        console.log('--- LemonSqueezy Configuration Debug (App.tsx) ---');
        console.log('isConfigured() result:', lemonsqueezyService.isConfigured());
        console.log('API Key (first 10 chars):', import.meta.env.VITE_LEMONSQUEEZY_API_KEY ? import.meta.env.VITE_LEMONSQUEEZY_API_KEY.substring(0, 10) + '...' : 'Not set');
        console.log('Store ID:', import.meta.env.VITE_LEMONSQUEEZY_STORE_ID || 'Not set');
        console.log('------------------------------------');
        
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
    setLoading(true);
    // Clean up local storage thoroughly
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('seogenix_') || key.startsWith('sb-')) {
        localStorage.removeItem(key);
      }
    });

    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      addToast({
        id: `signout-error-${Date.now()}`,
        type: 'error',
        title: 'Sign Out Failed',
        message: 'Could not sign out. Please try again.',
        duration: 5000,
        onClose: () => {}
      });
    }

    // Reload the page to ensure a clean state
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing...</p>
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