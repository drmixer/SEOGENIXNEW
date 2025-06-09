import React, { useState } from 'react';
import DashboardHeader from './DashboardHeader';
import Sidebar from './Sidebar';
import VisibilityScore from './VisibilityScore';
import ToolsGrid from './ToolsGrid';
import ChatbotPopup from './ChatbotPopup';
import DashboardWalkthrough from './DashboardWalkthrough';

interface DashboardProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  onNavigateToLanding: () => void;
  user: any;
  onSignOut: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ userPlan, onNavigateToLanding, user, onSignOut }) => {
  const [showChatbot, setShowChatbot] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [hasRunTools, setHasRunTools] = useState(false);

  // Extract first name from user data
  const getFirstName = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name.split(' ')[0];
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'User';
  };

  // Single effect to handle all initialization
  React.useEffect(() => {
    const onboardingData = localStorage.getItem('seogenix_onboarding');
    const walkthroughCompleted = localStorage.getItem('seogenix_walkthrough_completed');
    const toolsRun = localStorage.getItem('seogenix_tools_run');
    
    // Set tools run state
    if (toolsRun) {
      setHasRunTools(true);
    }
    
    // Show walkthrough if onboarding was completed and walkthrough hasn't been shown
    if (onboardingData && !walkthroughCompleted) {
      console.log('Triggering walkthrough - onboarding completed, walkthrough not shown');
      setTimeout(() => {
        setShowWalkthrough(true);
      }, 1000);
    }
  }, []);

  // Listen for onboarding completion event (for immediate trigger after onboarding)
  React.useEffect(() => {
    const handleOnboardingComplete = () => {
      console.log('Onboarding completed event received');
      const walkthroughCompleted = localStorage.getItem('seogenix_walkthrough_completed');
      if (!walkthroughCompleted) {
        console.log('Starting walkthrough immediately');
        setTimeout(() => {
          setShowWalkthrough(true);
        }, 500);
      }
    };

    window.addEventListener('onboardingCompleted', handleOnboardingComplete);
    return () => window.removeEventListener('onboardingCompleted', handleOnboardingComplete);
  }, []);

  // Enable chatbot for all users during development
  const isDevelopment = true; // Set to false for production
  const canAccessChatbot = isDevelopment || userPlan !== 'free';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-hidden">
      <DashboardHeader 
        userPlan={userPlan}
        onNavigateToLanding={onNavigateToLanding}
        user={user}
        onSignOut={onSignOut}
      />
      
      <div className="flex flex-1 min-h-0">
        <Sidebar 
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          userPlan={userPlan}
        />
        
        <main className="flex-1 p-8 overflow-y-auto">
          {activeSection === 'overview' && (
            <div className="space-y-8">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Welcome back, {getFirstName()}!
                </h1>
                <p className="text-gray-600">Monitor your AI visibility performance and access optimization tools.</p>
              </div>
              
              {hasRunTools ? (
                <>
                  <VisibilityScore userPlan={userPlan} />
                  <ToolsGrid userPlan={userPlan} onToolRun={() => setHasRunTools(true)} />
                </>
              ) : (
                <div className="space-y-8">
                  {/* Getting Started Section */}
                  <div className="bg-gradient-to-r from-teal-50 to-purple-50 rounded-xl p-8 border border-teal-200">
                    <div className="text-center">
                      <div className="bg-gradient-to-r from-teal-500 to-purple-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready to Get Started?</h2>
                      <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                        Run your first AI Visibility Audit to see how well your content is optimized for AI systems like ChatGPT, Claude, and voice assistants.
                      </p>
                      <button
                        onClick={() => setActiveSection('audit')}
                        className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-300 inline-flex items-center space-x-2"
                      >
                        <span>Run Your First Audit</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {/* Tools Preview */}
                  <ToolsGrid userPlan={userPlan} onToolRun={() => setHasRunTools(true)} showPreview={true} />
                </div>
              )}
            </div>
          )}
          
          {activeSection !== 'overview' && (
            <div className="bg-white rounded-xl shadow-sm p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {activeSection.charAt(0).toUpperCase() + activeSection.slice(1).replace('-', ' ')}
              </h2>
              <p className="text-gray-600">
                This section is under development. Advanced {activeSection.replace('-', ' ')} features will be available soon.
              </p>
            </div>
          )}
        </main>
      </div>
      
      {/* Dashboard Walkthrough */}
      {showWalkthrough && (
        <DashboardWalkthrough
          onComplete={() => {
            setShowWalkthrough(false);
            localStorage.setItem('seogenix_walkthrough_completed', 'true');
          }}
          onSkip={() => {
            setShowWalkthrough(false);
            localStorage.setItem('seogenix_walkthrough_completed', 'true');
          }}
        />
      )}
      
      {/* Floating chatbot button */}
      {canAccessChatbot && (
        <button
          data-walkthrough="chatbot"
          onClick={() => setShowChatbot(true)}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 z-40"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}

      {showChatbot && canAccessChatbot && (
        <ChatbotPopup 
          onClose={() => setShowChatbot(false)}
          type="dashboard"
          userPlan={userPlan}
        />
      )}
    </div>
  );
};

export default Dashboard;