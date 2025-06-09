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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
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
  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    // Always show onboarding for new signups
    if (authModalMode === 'signup') {
      setUserPlan(selectedPlan);
      setShowOnboarding(true);
    } else {
      // For login, go directly to dashboard
      setCurrentView('dashboard');
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setCurrentView('dashboard');
    
    console.log('Onboarding completed in App.tsx, dispatching event');
    
    // Dispatch custom event to trigger walkthrough
    window.dispatchEvent(new CustomEvent('onboardingCompleted'));
    
    // Set flag for walkthrough trigger
    localStorage.setItem('seogenix_trigger_walkthrough', 'true');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
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