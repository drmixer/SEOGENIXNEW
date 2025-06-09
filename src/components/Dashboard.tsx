import React, { useState } from 'react';
import DashboardHeader from './DashboardHeader';
import Sidebar from './Sidebar';
import VisibilityScore from './VisibilityScore';
import ToolsGrid from './ToolsGrid';
import HistoricalPerformance from './HistoricalPerformance';
import ReportGenerator from './ReportGenerator';
import ContentEditor from './ContentEditor';
import ChatbotPopup from './ChatbotPopup';
import DashboardWalkthrough from './DashboardWalkthrough';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';

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
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  // Extract first name from user data
  const getFirstName = () => {
    console.log('Getting first name for user:', user);
    
    // Check user_metadata first
    if (user?.user_metadata?.full_name) {
      const firstName = user.user_metadata.full_name.split(' ')[0];
      console.log('Using full_name from user_metadata:', firstName);
      return firstName;
    }
    
    // Check raw_user_meta_data as backup
    if (user?.raw_user_meta_data?.full_name) {
      const firstName = user.raw_user_meta_data.full_name.split(' ')[0];
      console.log('Using full_name from raw_user_meta_data:', firstName);
      return firstName;
    }
    
    // Check app_metadata
    if (user?.app_metadata?.full_name) {
      const firstName = user.app_metadata.full_name.split(' ')[0];
      console.log('Using full_name from app_metadata:', firstName);
      return firstName;
    }
    
    // Fall back to email
    if (user?.email) {
      const emailName = user.email.split('@')[0];
      console.log('Using email username:', emailName);
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    
    console.log('Fallback to User');
    return 'User';
  };

  // Track page visits
  React.useEffect(() => {
    const trackPageVisit = async () => {
      try {
        if (user) {
          await userDataService.trackActivity({
            user_id: user.id,
            activity_type: 'page_visited',
            activity_data: { section: activeSection }
          });
        }
      } catch (error) {
        console.error('Error tracking page visit:', error);
      }
    };

    trackPageVisit();
  }, [activeSection, user]);

  // Check for walkthrough trigger on dashboard load
  React.useEffect(() => {
    console.log('Dashboard useEffect - checking for walkthrough triggers');
    
    if (!user) {
      console.log('No user, skipping walkthrough check');
      return;
    }

    const initializeDashboard = async () => {
      // Set tools run state
      const toolsRun = localStorage.getItem('seogenix_tools_run');
      if (toolsRun) {
        console.log('Tools have been run before');
        setHasRunTools(true);
      }

      // Check for walkthrough trigger (from onboarding)
      const walkthroughTrigger = localStorage.getItem('seogenix_trigger_walkthrough');
      const walkthroughCompleted = localStorage.getItem('seogenix_walkthrough_completed');
      
      console.log('Dashboard initialization:', {
        walkthroughTrigger: !!walkthroughTrigger,
        walkthroughCompleted: !!walkthroughCompleted,
        userId: user.id,
        userEmail: user.email
      });

      // If walkthrough is triggered and hasn't been completed
      if (walkthroughTrigger && !walkthroughCompleted) {
        console.log('Triggering walkthrough from onboarding completion');
        localStorage.removeItem('seogenix_trigger_walkthrough');
        
        setTimeout(() => {
          console.log('Starting walkthrough...');
          setShowWalkthrough(true);
        }, 1000); // Give dashboard time to render
        return;
      }

      // Check database for onboarding completion
      try {
        const profile = await userDataService.getUserProfile(user.id);
        if (profile?.onboarding_completed_at && !walkthroughCompleted) {
          console.log('User has completed onboarding but not walkthrough - triggering walkthrough');
          setTimeout(() => {
            console.log('Starting walkthrough from database check...');
            setShowWalkthrough(true);
          }, 1500);
        }
      } catch (error) {
        console.error('Error checking user profile:', error);
      }
    };

    initializeDashboard();
  }, [user]);

  // Handle tool launch from Genie
  const handleToolLaunch = async (toolId: string) => {
    setSelectedTool(toolId);
    setActiveSection(toolId);
    
    // Track tool launch activity
    try {
      if (user) {
        await userDataService.trackActivity({
          user_id: user.id,
          activity_type: 'tool_launched_from_genie',
          activity_data: { toolId }
        });
      }
    } catch (error) {
      console.error('Error tracking tool launch:', error);
    }
  };

  // Manual walkthrough trigger function
  const triggerWalkthrough = () => {
    setShowWalkthrough(true);
  };

  // Enable chatbot for all users during development
  const isDevelopment = true; // Set to false for production
  const canAccessChatbot = isDevelopment || userPlan !== 'free';

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-8">
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Welcome back, {getFirstName()}!
                  </h1>
                  <p className="text-gray-600">Monitor your AI visibility performance and access optimization tools.</p>
                </div>
                <button
                  onClick={triggerWalkthrough}
                  className="text-sm text-purple-600 hover:text-purple-700 underline"
                >
                  Take Tour
                </button>
              </div>
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
        );
      
      case 'history':
        return <HistoricalPerformance userPlan={userPlan} />;
      
      case 'reports':
        return <ReportGenerator userPlan={userPlan} />;
      
      case 'editor':
        return <ContentEditor userPlan={userPlan} />;
      
      default:
        return (
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {activeSection.charAt(0).toUpperCase() + activeSection.slice(1).replace('-', ' ')}
            </h2>
            <p className="text-gray-600">
              This section is under development. Advanced {activeSection.replace('-', ' ')} features will be available soon.
            </p>
          </div>
        );
    }
  };

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
          {renderActiveSection()}
        </main>
      </div>
      
      {/* Dashboard Walkthrough */}
      {showWalkthrough && (
        <DashboardWalkthrough
          onComplete={() => {
            console.log('Walkthrough completed - setting completion flag');
            setShowWalkthrough(false);
            localStorage.setItem('seogenix_walkthrough_completed', 'true');
            // Clear any remaining trigger flags
            localStorage.removeItem('seogenix_trigger_walkthrough');
          }}
          onSkip={() => {
            console.log('Walkthrough skipped - setting completion flag');
            setShowWalkthrough(false);
            localStorage.setItem('seogenix_walkthrough_completed', 'true');
            // Clear any remaining trigger flags
            localStorage.removeItem('seogenix_trigger_walkthrough');
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
          onToolLaunch={handleToolLaunch}
        />
      )}
    </div>
  );
};

export default Dashboard;