import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import AuthModal from './components/AuthModal';
import OnboardingModal from './components/OnboardingModal';

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
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Initial session:', session);
        
        if (session?.user) {
          console.log('Setting user from initial session:', session.user);
          setUser(session.user);
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user);
      
      if (session?.user) {
        console.log('Setting user from auth change:', session.user);
        setUser(session.user);
      } else {
        console.log('Clearing user from auth change');
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
    setShowAuthModal(false);
    
    // Wait a moment for the auth state to update
    setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          console.log('Auth success - user available:', session.user);
          setUser(session.user);
          
          // Always show onboarding for new signups
          if (authModalMode === 'signup') {
            setUserPlan(selectedPlan);
            setShowOnboarding(true);
          } else {
            // For login, go directly to dashboard
            setCurrentView('dashboard');
          }
        }
      } catch (error) {
        console.error('Error getting session after auth:', error);
      }
    }, 500);
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
  );
}

export default App;