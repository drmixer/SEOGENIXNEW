import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
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
  const [user, setUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userPlan, setUserPlan] = useState<'free' | 'core' | 'pro' | 'agency'>('free');
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'core' | 'pro' | 'agency'>('free');
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const { toasts, addToast, removeToast } = useToast();
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard' | 'pricing'>('landing');
  
  const location = useLocation();
  const navigate = useNavigate();

  // This is the temporary diagnostic test.
  // After the fix, you can remove this useEffect block.
  useEffect(() => {
    const runTestQuery = async () => {
      setTimeout(async () => {
        console.log("%c--- STARTING DEFINITIVE TEST ---", "color: blue; font-size: 1.2em;");
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error("%cTEST FAILED: Could not get a logged-in user.", "color: red; font-size: 1.1em;");
          console.log("%c--- END OF DEFINITIVE TEST ---", "color: blue; font-size: 1.2em;");
          return;
        }
        const userId = user.id;
        console.log("TEST: Checking for user ID:", userId);
        console.log("TEST: Attempting to fetch directly from 'projects' table using 'owner_id'...");
        const { data: projects, error: projectsError } = await supabase
          .from('projects')
          .select('id, name, url')
          .eq('owner_id', userId); // FIX: Using owner_id

        if (projectsError) {
          console.error("%c--- TEST FAILED: The query failed with an error. ---", "color: red; font-size: 1.2em;", projectsError);
        } else {
          console.log("%c--- TEST SUCCEEDED: The query returned data. ---", "color: green; font-size: 1.2em;", projects);
        }
        console.log("%c--- END OF DEFINITIVE TEST ---", "color: blue; font-size: 1.2em;");
      }, 2000);
    };
    runTestQuery();
  }, []);

  const handleAuthStateChange = async (session: Session | null) => {
    const currentUser = session?.user || null;
    setUser(currentUser);

    if (currentUser) {
      console.log('User found, fetching profile...');
      try {
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', currentUser.id)
          .single();

        if (profileError) throw profileError;

        if (profile) {
          const { data: websites, error: websitesError } = await supabase
            .from('projects')
            .select('id, name, url')
            .eq('owner_id', currentUser.id); // FIX: Changed user_id to owner_id

          if (websitesError) throw websitesError;
          
          const completeProfile = {
            ...profile,
            websites: websites || []
          };
          
          setUserProfile(completeProfile);
          console.log('Profile and websites fetched:', completeProfile);

          setUserPlan(profile.plan || 'free');
          if (!profile.onboarding_completed_at) {
            console.log('Onboarding not complete, showing onboarding modal.');
            setShowOnboarding(true);
          } else {
            console.log('Onboarding complete, navigating to dashboard.');
            setCurrentView('dashboard');
            navigate('/dashboard');
          }
        } else {
          console.log('No profile found, showing onboarding modal.');
          setShowOnboarding(true);
        }
      } catch (e) {
        console.error('Exception fetching profile and websites:', e);
        setShowOnboarding(true);
      }
    } else {
      console.log('No user found, resetting state.');
      setUserPlan('free');
      setShowOnboarding(false);
      setCurrentView('landing');
      navigate('/');
    }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      handleAuthStateChange(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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

  const handlePlanSelect = async (plan: 'free' | 'core' | 'pro' | 'agency') => {
    setSelectedPlan(plan);
    if (user) {
      if (plan === 'free') {
        setUserPlan(plan);
        setShowOnboarding(true);
      } else {
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
      setAuthModalMode('signup');
      setShowAuthModal(true);
    }
  };
  
  const handleAuthSuccess = async () => {
    setShowAuthModal(false);
    
    const { data: { session } } = await supabase.auth.getSession();
    const currentUser = session?.user;
    
    if (currentUser) {
      setUser(currentUser);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*') // This doesn't need the websites join anymore
        .eq('user_id', currentUser.id)
        .single();
      
      if (profile && profile.onboarding_completed_at) {
        navigate('/dashboard');
      } else {
        setShowOnboarding(true);
      }
    }
  };

  const handleOnboardingComplete = async (startWalkthrough: boolean) => {
    setShowOnboarding(false);
    if (startWalkthrough) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        handleAuthStateChange(session);
      }
      setShowWalkthrough(true);
      navigate('/dashboard');
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
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
            (currentView === 'landing' || currentView === 'pricing') ? (
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
            ) : (user && userProfile) ? (
              <Dashboard
                userPlan={userPlan}
                onNavigateToLanding={() => {
                  setCurrentView('landing');
                  navigate('/');
                }}
                user={user}
                onSignOut={handleSignOut}
                userProfile={userProfile}
                onProfileUpdate={setUserProfile}
                showWalkthrough={showWalkthrough}
                onWalkthroughComplete={() => setShowWalkthrough(false)}
              />
            ) : (
              <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading dashboard...</p>
                </div>
              </div>
            )
          } />
          <Route path="/dashboard" element={
            (user && userProfile) ? (
              <Dashboard 
                userPlan={userPlan}
                onNavigateToLanding={() => {
                  setCurrentView('landing');
                  navigate('/');
                }}
                user={user}
                onSignOut={handleSignOut}
                userProfile={userProfile}
                onProfileUpdate={setUserProfile}
                showWalkthrough={showWalkthrough}
                onWalkthroughComplete={() => setShowWalkthrough(false)}
              />
            ) : (
              <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading user data...</p>
                </div>
              </div>
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
            onComplete={(startWalkthrough) => handleOnboardingComplete(startWalkthrough)}
            onClose={() => setShowOnboarding(false)}
            navigate={navigate}
          />
        )}
        
        {/* Toast Notifications */}
        <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
      </div>
    </WhiteLabelProvider>
  );
}

export default App;

