import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
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

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        console.log('Initializing authentication...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting initial session:', error);
        } else {
          console.log('Initial session:', session);
          
          if (session?.user) {
            console.log('Setting user from initial session:', session.user);
            console.log('User metadata:', session.user.user_metadata);
            console.log('User raw metadata:', session.user.raw_user_meta_data);
            setUser(session.user);
            
            // Get user plan from metadata
            const userMetadataPlan = session.user.user_metadata?.plan || 
                                    session.user.raw_user_meta_data?.plan;
            
            if (userMetadataPlan && ['free', 'core', 'pro', 'agency'].includes(userMetadataPlan)) {
              console.log('Setting user plan from metadata:', userMetadataPlan);
              setUserPlan(userMetadataPlan as 'free' | 'core' | 'pro' | 'agency');
            } else {
              // Try to get plan from user profile
              try {
                const { data: userProfile } = await supabase
                  .from('user_profiles')
                  .select('plan')
                  .eq('user_id', session.user.id)
                  .single();
                
                if (userProfile?.plan && ['free', 'core', 'pro', 'agency'].includes(userProfile.plan)) {
                  console.log('Setting user plan from profile:', userProfile.plan);
                  setUserPlan(userProfile.plan as 'free' | 'core' | 'pro' | 'agency');
                  
                  // Update user metadata if plan is in profile but not in metadata
                  if (!userMetadataPlan) {
                    await supabase.auth.updateUser({
                      data: { plan: userProfile.plan }
                    });
                  }
                }
              } catch (error) {
                console.error('Error getting user profile:', error);
              }
            }
          } else {
            console.log('No initial session found');
          }
        }
      } catch (error) {
        console.error('Error in initializeAuth:', error);
      } finally {
        console.log('Setting loading to false');
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, 'Session:', session?.user ? 'User present' : 'No user');
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          console.log('Setting user from auth change:', session.user);
          console.log('User metadata from auth change:', session.user.user_metadata);
          console.log('User raw metadata from auth change:', session.user.raw_user_meta_data);
          setUser(session.user);
          
          // Get user plan from metadata
          const userMetadataPlan = session.user.user_metadata?.plan || 
                                  session.user.raw_user_meta_data?.plan;
          
          if (userMetadataPlan && ['free', 'core', 'pro', 'agency'].includes(userMetadataPlan)) {
            console.log('Setting user plan from metadata on auth change:', userMetadataPlan);
            setUserPlan(userMetadataPlan as 'free' | 'core' | 'pro' | 'agency');
          } else {
            // Try to get plan from user profile
            try {
              const { data: userProfile } = await supabase
                .from('user_profiles')
                .select('plan')
                .eq('user_id', session.user.id)
                .single();
              
              if (userProfile?.plan && ['free', 'core', 'pro', 'agency'].includes(userProfile.plan)) {
                console.log('Setting user plan from profile on auth change:', userProfile.plan);
                setUserPlan(userProfile.plan as 'free' | 'core' | 'pro' | 'agency');
              }
            } catch (error) {
              console.error('Error getting user profile on auth change:', error);
            }
          }
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out, clearing user state');
        setUser(null);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleNavigateToDashboard = () => {
    if (user) {
      setCurrentView('dashboard');
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
    
    // Wait for the auth state to update and user to be available
    let attempts = 0;
    const maxAttempts = 10;
    
    const waitForUser = async (): Promise<void> => {
      return new Promise((resolve) => {
        const checkUser = async () => {
          attempts++;
          console.log(`Checking for user (attempt ${attempts}/${maxAttempts})`);
          
          try {
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (error) {
              console.error('Error getting session:', error);
            } else if (session?.user) {
              console.log('User found in session:', session.user);
              console.log('User metadata:', session.user.user_metadata);
              setUser(session.user);
              
              // Get user plan from metadata
              const userMetadataPlan = session.user.user_metadata?.plan || 
                                      session.user.raw_user_meta_data?.plan;
              
              if (userMetadataPlan && ['free', 'core', 'pro', 'agency'].includes(userMetadataPlan)) {
                console.log('Setting user plan from metadata after auth success:', userMetadataPlan);
                setUserPlan(userMetadataPlan as 'free' | 'core' | 'pro' | 'agency');
              }
              
              resolve();
              return;
            }
          } catch (error) {
            console.error('Error checking session:', error);
          }
          
          if (attempts < maxAttempts) {
            setTimeout(checkUser, 500);
          } else {
            console.log('Max attempts reached, proceeding anyway');
            resolve();
          }
        };
        
        checkUser();
      });
    };
    
    await waitForUser();
    
    // Now proceed with the flow
    if (authModalMode === 'signup') {
      console.log('Showing onboarding for new signup');
      setUserPlan(selectedPlan);
      setShowOnboarding(true);
    } else {
      // For login, go directly to dashboard
      console.log('Going to dashboard for login');
      setCurrentView('dashboard');
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    
    console.log('Onboarding completed in App.tsx - setting walkthrough trigger and navigating to dashboard');
    
    // Set the walkthrough trigger flag BEFORE navigating to dashboard
    localStorage.setItem('seogenix_immediate_walkthrough', 'true');
    
    // Navigate to dashboard
    setCurrentView('dashboard');
  };

  const handleSignOut = async () => {
    console.log('Signing out user');
    await supabase.auth.signOut();
    setUser(null);
    setCurrentView('landing');
    setSelectedPlan('free');
    setUserPlan('free');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
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

        {showOnboarding && (
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