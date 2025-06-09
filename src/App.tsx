import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';

function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard'>('landing');
  const [userPlan, setUserPlan] = useState<'free' | 'core' | 'pro' | 'agency'>('free');

  return (
    <div className="min-h-screen bg-white">
      {currentView === 'landing' ? (
        <LandingPage 
          onNavigateToDashboard={() => setCurrentView('dashboard')}
          onPlanSelect={(plan) => {
            setUserPlan(plan);
            setCurrentView('dashboard');
          }}
        />
      ) : (
        <Dashboard 
          userPlan={userPlan}
          onNavigateToLanding={() => setCurrentView('landing')}
        />
      )}
    </div>
  );
}

export default App;