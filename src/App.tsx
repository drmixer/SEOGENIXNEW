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
  const [authError, setAuthError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        console.log('Initializing authentication...');
        setLoading(true);
        setIsInitializing(true);
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting initial session:', error);
          setAuthError('Failed to initialize authentication: ' + error.message);
          setLoading(false);
          setIsInitializing(false);
          return;
        }
        
        console.log('Initial session:', session);
        
        if (session?.user) {
          console.log('Setting user from initial session:', session.user);
          setUser(session.user);
          
          // Fetch user profile to get plan
          try {
            const { data: profiles, error: profileError } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('user_id', session.user.id)
              .order('created_at', { ascending: false })
              .limit(1);
              
            if (profileError) {
              console.error('Error fetching user profile:', profileError);
              setLoading(false);
              setIsInitializing(false);
              return;
            }
                
            if (profiles && profiles.length > 0) {
              console.log('User profile found:', profiles[0]);
              setUserPlan(profiles[0].plan as any || 'free');
              
              // If onboarding is completed, go to dashboard
              if (profiles[0].onboarding_completed_at) {
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
          } catch (profileError) {
            console.error('Error in profile fetch:', profileError);
            // Still allow the user to continue even if profile fetch fails
            setShowOnboarding(true);
          }
        } else {
          console.log('No initial session found');
        }
      } catch (error) {
        console.error('Error in initializeAuth:', error);
        setAuthError('Authentication initialization failed: ' + (error as Error).message);
      } finally {
        console.log('Setting loading to false');
        setLoading(false);
        setIsInitializing(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, 'Session:', session?.user ? 'User present' : 'No user');
      
      if (isInitializing) {
        console.log('Still initializing, ignoring auth state change');
        return;
      }
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          console.log('Setting user from auth change:', session.user);
          setUser(session.user);
          
          // Fetch user profile to get plan
          try {
            const { data: profiles, error: profileError } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('user_id', session.user.id)
              .order('created_at', { ascending: false })
              .limit(1);
              
            if (profileError) {
              console.error('Error fetching user profile after auth change:', profileError);
              setLoading(false);
              return;
            }
              
            if (profiles && profiles.length > 0) {
              console.log('User profile found after auth change:', profiles[0]);
              setUserPlan(profiles[0].plan as any || 'free');
              
              // Check if onboarding is completed
              if (!profiles[0].onboarding_completed_at) {
                console.log('Onboarding not completed, showing onboarding modal');
                setShowOnboarding(true);
              } else {
                setCurrentView('dashboard');
              }
            } else {
              // No profile found, show onboarding
              console.log('No profile found after auth change, showing onboarding');
              setShowOnboarding(true);
            }
          } catch (profileError) {
            console.error('Error fetching user profile after auth change:', profileError);
            // Still allow the user to proceed with onboarding
            setShowOnboarding(true);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out, clearing user state');
        setUser(null);
        setUserPlan('free');
        setCurrentView('landing');
      }
      
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    }
  }, [isInitializing]);

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
    setAuthError(null);
    setLoading(true);
    
    try {
      // Get current session to ensure we have the latest user data
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session after auth success:', error);
        setAuthError('Failed to get session: ' + error.message);
        setLoading(false);
        return;
      }
      
      if (!session?.user) {
        console.error('No user in session after auth success');
        setAuthError('Authentication succeeded but no user was found');
        setLoading(false);
        return;
      }
      
      // Set user from session
      setUser(session.user);
      
      // Fetch user profile to get plan
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (profileError) {
        console.error('Error fetching user profile after auth success:', profileError);
        // Continue with the flow despite profile error
      }
      
      let profileExists = false;
      let onboardingCompleted = false;
      
      if (profiles && profiles.length > 0) {
        console.log('User profile found after auth success:', profiles[0]);
        setUserPlan(profiles[0].plan as any || selectedPlan);
        profileExists = true;
        onboardingCompleted = !!profiles[0].onboarding_completed_at;
      } else {
        console.log('No profile found after auth success');
        setUserPlan(selectedPlan);
      }
      
      // Now proceed with the flow based on whether profile exists and onboarding is completed
      if (profileExists && onboardingCompleted) {
        // Profile exists and onboarding is completed, go to dashboard
        console.log('Profile exists and onboarding completed, going to dashboard');
        setCurrentView('dashboard');
      } else {
        // Show onboarding if profile doesn't exist or onboarding not completed
        console.log('Showing onboarding');
        setShowOnboarding(true);
      }
    } catch (error) {
      console.error('Error in handleAuthSuccess:', error);
      setAuthError('Failed to complete authentication: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    
    console.log('Onboarding completed in App.tsx - setting walkthrough trigger and navigating to dashboard');
    
    // Update user profile with selected plan if needed
    if (user) {
      try {
        setLoading(true);
        
        const { data: existingProfiles, error: fetchError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (fetchError) {
          console.error('Error fetching user profiles for onboarding completion:', fetchError);
          throw fetchError;
        }
          
        if (existingProfiles && existingProfiles.length > 0) {
          // Update existing profile
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
            throw updateError;
          }
        } else {
          // Create new profile if none exists
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
            throw insertError;
          }
        }
      } catch (error) {
        console.error('Error updating user profile after onboarding:', error);
        // Continue to dashboard despite error
      } finally {
        setLoading(false);
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
      await supabase.auth.signOut();
      setUser(null);
      setCurrentView('landing');
      setSelectedPlan('free');
      setUserPlan('free');
    } catch (error) {
      console.error('Error signing out:', error);
      setAuthError('Failed to sign out: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

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