import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route /*, useNavigate */ } from 'react-router-dom';
import { supabase } from './lib/supabase';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import AuthModal from './components/AuthModal';
import OnboardingModal from './components/OnboardingModal';
import BillingModal from './components/BillingModal';
import { WhiteLabelProvider } from './components/WhiteLabelProvider';
import Integrations from './components/pages/Integrations';
import HelpCenter from './components/pages/HelpCenter';
import Documentation from './components/pages/Documentation';
import ContactUs from './components/pages/ContactUs';
import Status from './components/pages/Status';
import PrivacyPolicy from './components/pages/PrivacyPolicy';
import TermsOfService from './components/pages/TermsOfService';
import CookiePolicy from './components/pages/CookiePolicy';

function App() {
  // If you decide to use `useNavigate` for routing (recommended for cleaner transitions):
  // const navigate = useNavigate();

  const [currentView, setCurrentView] = useState<'landing' | 'dashboard' | 'pricing'>('landing');
  const [userPlan, setUserPlan] = useState<'free' | 'core' | 'pro' | 'agency'>('free');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'core' | 'pro' | 'agency'>('free'); // Plan selected on landing
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // --- NEW STATES FOR BILLING MODAL ---
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [billingModalPurpose, setBillingModalPurpose] = useState<'signup_upsell' | 'upgrade' | 'manage'>('upgrade');
  // ------------------------------------

  // Use refs to prevent race conditions and duplicate initializations
  const authInitializedRef = useRef(false);
  const initializationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const authListenerInitializedRef = useRef(false);

  // Function to fetch user profile (extracted for reusability and clarity)
  const fetchUserProfile = async (userId: string): Promise<{ plan: 'free' | 'core' | 'pro' | 'agency', onboardingCompleted: boolean }> => {
    try {
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        return { plan: 'free', onboardingCompleted: false }; // Default if error
      }

      if (profiles && profiles.length > 0) {
        console.log('User profile found:', profiles[0].id);
        const plan = profiles[0].plan as typeof userPlan || 'free';
        const onboardingCompleted = !!profiles[0].onboarding_completed_at;
        setUserPlan(plan); // Update the state in App.tsx
        return { plan, onboardingCompleted };
      } else {
        console.log('No profile found for user:', userId);
        return { plan: 'free', onboardingCompleted: false };
      }
    } catch (profileError) {
      console.error('Error in profile fetch:', profileError);
      return { plan: 'free', onboardingCompleted: false };
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      if (authInitializedRef.current) {
        console.log('Auth already initialized, skipping');
        return;
      }

      try {
        console.log('Initializing authentication...');
        setLoading(true);
        authInitializedRef.current = true;

        if (initializationTimerRef.current) {
          clearTimeout(initializationTimerRef.current);
        }

        initializationTimerRef.current = setTimeout(() => {
          console.log('Auth initialization timed out after 5 seconds');
          setLoading(false);
          setAuthInitialized(true);
          setAuthError('Authentication initialization timed out. Please refresh the page.');
        }, 5000);

        const { data: { session }, error } = await supabase.auth.getSession();

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
          const { plan: currentPlanFromProfile, onboardingCompleted } = await fetchUserProfile(session.user.id);

          if (onboardingCompleted) {
            console.log('Onboarding completed, going to dashboard');
            setCurrentView('dashboard');
            // Ensure billing modal is not shown if user is on free plan and already onboarded
            if (currentPlanFromProfile === 'free') {
                setShowBillingModal(false); // [!code ++]
            }
          } else {
            console.log('Onboarding not completed, showing onboarding modal');
            setShowOnboarding(true);
            setShowBillingModal(false); // [!code ++] // Ensure billing modal is not shown if showing onboarding
          }
        } else {
          console.log('No user in session, staying on landing page');
        }
      } catch (error) {
        console.error('Error in initializeAuth:', error);
        setAuthError('Authentication initialization failed: ' + (error as Error).message);
      } finally {
        setLoading(false);
        setAuthInitialized(true);
      }
    };

    if (!authInitializedRef.current) {
      initializeAuth();
    }

    if (!authListenerInitializedRef.current) {
      authListenerInitializedRef.current = true;

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (initializationTimerRef.current) {
          clearTimeout(initializationTimerRef.current);
          initializationTimerRef.current = null;
        }

        console.log('Auth state changed:', event, 'Session:', session?.user ? 'User present' : 'No user');

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            console.log('Setting user from auth change:', session.user.id);
            setUser(session.user);
            const { plan: currentPlanFromProfile, onboardingCompleted } = await fetchUserProfile(session.user.id);

            if (onboardingCompleted) {
              setCurrentView('dashboard');
              if (currentPlanFromProfile === 'free') {
                  setShowBillingModal(false); // [!code ++]
              }
            } else {
              setShowOnboarding(true);
              setShowBillingModal(false); // [!code ++] // Ensure billing modal is not shown if showing onboarding
            }
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out, clearing user state');
          setUser(null);
          setUserPlan('free');
          setCurrentView('landing');
          setShowOnboarding(false);
          setShowBillingModal(false); // Clear billing modal state on sign out
          setLoading(false);
          // navigate('/'); // If using navigate hook
        } else if (event === 'INITIAL_SESSION') {
          setLoading(false);
          setAuthInitialized(true);
        }
      });

      return () => {
        console.log('Cleaning up auth subscription');
        subscription.unsubscribe();
        if (initializationTimerRef.current) {
          clearTimeout(initializationTimerRef.current);
          initializationTimerRef.current = null;
        }
      };
    }
  }, []); // Empty dependency array to ensure this only runs once on mount

  const handleNavigateToDashboard = () => {
    if (user) {
      setDashboardLoading(true);
      console.log('Navigating to dashboard for user:', user.id);
      setCurrentView('dashboard');
      // navigate('/dashboard'); // If using navigate hook
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

  // --- MODIFIED: handlePlanSelect ---
  const handlePlanSelect = (plan: 'free' | 'core' | 'pro' | 'agency') => {
    setSelectedPlan(plan); // Store the selected plan for potential future use (e.g., in BillingModal)

    if (user) {
      // User is logged in
      if (plan !== 'free' && userPlan === 'free') {
        // Logged in free user wants to upgrade
        console.log(`Logged in user wants to upgrade to ${plan}, showing billing modal.`);
        setBillingModalPurpose('upgrade');
        setShowBillingModal(true);
      } else if (plan === 'free' && userPlan !== 'free') {
        // Logged in paid user clicked 'free' plan. This case might imply a downgrade intent,
        // or just clicking around. For now, assume if they are already paid and onboarding is done, go to dashboard.
        // Downgrade logic should ideally be initiated from a 'manage subscription' flow.
        if (user) { // Re-check if user exists, for type safety
          fetchUserProfile(user.id).then(({ onboardingCompleted }) => {
            if (onboardingCompleted) {
              setCurrentView('dashboard');
              // navigate('/dashboard'); // If using navigate hook
            } else {
              setShowOnboarding(true);
            }
          });
        }
      } else {
        // User logged in, selected free plan (and is free), or already on selected paid plan.
        // Proceed to onboarding/dashboard based on onboarding status.
        console.log(`User already has ${plan} or selected free plan, checking onboarding status.`);
        if (user) { // Re-check if user exists
            fetchUserProfile(user.id).then(({ onboardingCompleted }) => {
              if (onboardingCompleted) {
                  setCurrentView('dashboard');
                  // navigate('/dashboard'); // If using navigate hook
              } else {
                  setShowOnboarding(true);
              }
            });
        }
      }
    } else {
      // User not logged in, show signup first
      console.log(`User not logged in, selected ${plan}, showing signup modal.`);
      setAuthModalMode('signup');
      setShowAuthModal(true);
      // BillingModal will be shown after successful signup in handleAuthSuccess if a paid plan was selected
    }
  };
  // ------------------------------------

  // --- MODIFIED: handleAuthSuccess ---
  const handleAuthSuccess = async () => {
    console.log('Auth success handler called');
    setShowAuthModal(false); // Close the AuthModal
    setAuthError(null); // Clear any auth error

    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session?.user) {
      console.error('Error or no user in session after auth success:', error);
      setAuthError('Authentication succeeded but no user was found: ' + (error?.message || ''));
      return;
    }

    console.log('Setting user after auth success:', session.user.id);
    setUser(session.user);

    // Fetch the user's profile to get their *current* plan and onboarding status from the DB
    const { plan: currentProfilePlan, onboardingCompleted } = await fetchUserProfile(session.user.id);

    // NEW LOGIC FOR PAID PLAN CHECKOUT AFTER SIGNUP
    // This condition is true if:
    // 1. The user just completed a 'signup' via AuthModal.
    // 2. They had previously selected a paid plan on the landing page (`selectedPlan` is not 'free').
    // 3. Their current plan in the database is still 'free' (meaning they haven't paid yet).
    if (authModalMode === 'signup' && selectedPlan !== 'free' && currentProfilePlan === 'free') {
      console.log(`New signup for paid plan (${selectedPlan}), showing billing modal for payment.`);
      setBillingModalPurpose('signup_upsell'); // Indicate this is for new signup upsell
      setShowBillingModal(true);
      return; // IMPORTANT: Stop the function here. BillingModal takes precedence over onboarding for paid signups.
    }

    // Existing logic for onboarding or dashboard (for free signups or existing logins)
    if (onboardingCompleted) {
      console.log('Onboarding already completed, going to dashboard');
      setCurrentView('dashboard');
      // navigate('/dashboard'); // If using navigate hook
    } else {
      console.log('Showing onboarding for new signup (if free plan) or existing login (if onboarding incomplete)');
      setShowOnboarding(true);
    }
  };
  // ------------------------------------

  const handleOnboardingComplete = async () => {
    console.log('Onboarding completed in App.tsx');
    setShowOnboarding(false);
    setShowBillingModal(false); // [!code ++] // Crucial: Ensure billing modal is hidden after onboarding

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
          console.log('Updating existing profile with onboarding_completed_at:', existingProfiles[0].id);
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({
              onboarding_completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', existingProfiles[0].id);

          if (updateError) {
            console.error('Error updating profile after onboarding:', updateError);
          }
        } else {
          // This case should ideally not happen if user profile is created on signup, but as fallback
          console.log('Creating new profile with onboarding_completed_at for user:', user.id);
          const { error: insertError } = await supabase
            .from('user_profiles')
            .insert({
              user_id: user.id,
              plan: userPlan, // Use the current userPlan state (could be free or paid if they just paid)
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

    localStorage.setItem('seogenix_immediate_walkthrough', 'true'); // Trigger dashboard walkthrough
    setCurrentView('dashboard');
    // navigate('/dashboard'); // If using navigate hook
  };

  // --- NEW: handleBillingModalComplete ---
  // This function is called when the BillingModal is closed, or after a presumed successful payment.
  // It ensures the app's state reflects the latest user plan and directs the user to the next appropriate step.
  const handleBillingModalComplete = async (paymentSuccessful: boolean = false) => {
    setShowBillingModal(false); // Close the billing modal
    console.log('Billing modal closed, paymentSuccessful:', paymentSuccessful);

    if (user) {
      // Always re-fetch the user's profile to get the latest plan status from the database.
      // This is crucial because Lemon Squeezy payment confirmation usually updates your DB via webhooks.
      const { plan: updatedPlan, onboardingCompleted } = await fetchUserProfile(user.id);

      // Determine the next step based on the updated plan and onboarding status
      if (updatedPlan !== 'free' && !onboardingCompleted) {
        // If the user is now on a paid plan (payment successful) AND hasn't completed onboarding, show onboarding.
        console.log('Paid plan activated, showing onboarding after payment.');
        setShowOnboarding(true);
      } else if (updatedPlan === 'free' && !onboardingCompleted) { // [!code ++]
        // If the user is still on a free plan (payment cancelled/failed) AND hasn't completed onboarding, show onboarding. // [!code ++]
        console.log('Still on free plan, showing onboarding.'); // [!code ++]
        setShowOnboarding(true); // [!code ++]
      } else {
        // In all other cases:
        // - If the user is on a free plan AND already onboarded.
        // - If the user is on a paid plan AND already onboarded.
        // In these cases, they should now go to the dashboard.
        console.log('Navigating to dashboard after billing modal interaction.');
        setCurrentView('dashboard');
        // You might want a small timeout here to ensure dashboard loads before potential walkthrough/etc.
      }
    } else {
      // If user somehow gets here without a session (e.g., session expired), revert to landing page.
      setCurrentView('landing');
      // navigate('/'); // If using navigate hook
    }
  };
  // ------------------------------------

  const handleSignOut = async () => {
    console.log('Signing out user');
    try {
      setLoading(true);

      // Clear relevant localStorage items for a clean sign-out
      localStorage.removeItem('seogenix_walkthrough_completed');
      localStorage.removeItem('seogenix_immediate_walkthrough');
      localStorage.removeItem('seogenix_tools_run');
      localStorage.removeItem('seogenix_onboarding');
      localStorage.removeItem('seogenix-auth-token');

      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        console.error('Error during sign out:', error);
        throw error;
      }

      console.log('Sign out successful');
      // Reset all relevant states
      setUser(null);
      setCurrentView('landing');
      setSelectedPlan('free');
      setUserPlan('free');
      setShowOnboarding(false);
      setShowAuthModal(false);
      setShowBillingModal(false); // Clear billing modal state on sign out
      setAuthError(null);

      authInitializedRef.current = false; // Reset auth initialization to re-run on next load
      window.location.reload(); // Force reload to ensure all state is cleared and re-initialized cleanly
    } catch (error) {
      console.error('Error signing out:', error);
      alert('There was a problem signing out. Please try again or refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  // Render initial loading/authentication state to prevent flashing content
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

  // Render general loading state after authentication initialization
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

  // Render dashboard specific loading state
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
    <Router>
      <WhiteLabelProvider user={user}>
        <div className="min-h-screen bg-white">
          <Routes>
            <Route path="/" element={
              // Conditionally render LandingPage or Dashboard on the root route
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
                  // Allow Dashboard to trigger BillingModal for subscription management
                  onShowBillingModal={() => { setBillingModalPurpose('manage'); setShowBillingModal(true); }}
                />
              )
            } />
            {/* Define other static routes */}
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/help-center" element={<HelpCenter />} />
            <Route path="/documentation" element={<Documentation />} />
            <Route path="/contact-us" element={<ContactUs />} />
            <Route path="/status" element={<Status />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/cookie-policy" element={<CookiePolicy />} />
          </Routes>

          {/* Conditional rendering for AuthModal */}
          {showAuthModal && (
            <AuthModal
              onClose={() => setShowAuthModal(false)}
              onSuccess={handleAuthSuccess}
              initialMode={authModalMode}
              selectedPlan={selectedPlan} // <-- IMPORTANT: Pass selectedPlan to AuthModal
            />
          )}

          {/* Conditional rendering for OnboardingModal */}
          {showOnboarding && user && ( // Only show if user is logged in
            <OnboardingModal
              userPlan={userPlan}
              onComplete={handleOnboardingComplete}
              onClose={() => setShowOnboarding(false)}
            />
          )}

          {/* --- NEW: Conditional rendering for BillingModal --- */}
          {showBillingModal && user && ( // Only show if user is logged in
            <BillingModal
              user={user}
              userPlan={userPlan} // Current plan from App state (from DB)
              initialSelectedPlan={selectedPlan} // The plan the user just selected or wants
              purpose={billingModalPurpose} // 'signup_upsell', 'upgrade', or 'manage'
              onClose={() => handleBillingModalComplete(false)} // Call handler on close (payment not confirmed)
              onSuccess={() => handleBillingModalComplete(true)} // Call handler on presumed successful payment
            />
          )}
          {/* ------------------------------------------------ */}
        </div>
      </WhiteLabelProvider>
    </Router>
  );
}

export default App;
