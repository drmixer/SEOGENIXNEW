import React, { useState, useEffect } from 'react';
import DashboardHeader from './DashboardHeader';
import Sidebar from './Sidebar';
import VisibilityScore from './VisibilityScore';
import ToolsGrid from './ToolsGrid';
import HistoricalPerformance from './HistoricalPerformance';
import ReportGenerator from './ReportGenerator';
import ContentEditor from './ContentEditor';
import RealTimeContentEditor from './RealTimeContentEditor';
import CompetitiveVisualization from './CompetitiveVisualization';
import CMSIntegrations from './CMSIntegrations';
import ChatbotPopup from './ChatbotPopup';
import DashboardWalkthrough from './DashboardWalkthrough';
import SiteSelector from './SiteSelector';
import SettingsModal from './SettingsModal';
import BillingModal from './BillingModal';
import ToastContainer from './ToastContainer';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';

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
  const [userProfile, setUserProfile] = useState<any>(null);
  const [selectedWebsite, setSelectedWebsite] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  // Extract first name from user data
  const getFirstName = () => {
    console.log('Getting first name for user:', user);
    console.log('Full user object:', JSON.stringify(user, null, 2));
    
    if (!user) {
      console.log('No user object available');
      return 'User';
    }
    
    // Try multiple possible locations for the name
    if (user?.user_metadata?.full_name) {
      const firstName = user.user_metadata.full_name.split(' ')[0];
      console.log('Using full_name from user_metadata:', firstName);
      return firstName;
    }
    
    if (user?.user_metadata?.name) {
      const firstName = user.user_metadata.name.split(' ')[0];
      console.log('Using name from user_metadata:', firstName);
      return firstName;
    }
    
    if (user?.raw_user_meta_data?.full_name) {
      const firstName = user.raw_user_meta_data.full_name.split(' ')[0];
      console.log('Using full_name from raw_user_meta_data:', firstName);
      return firstName;
    }
    
    if (user?.raw_user_meta_data?.name) {
      const firstName = user.raw_user_meta_data.name.split(' ')[0];
      console.log('Using name from raw_user_meta_data:', firstName);
      return firstName;
    }
    
    // Check app_metadata
    if (user?.app_metadata?.full_name) {
      const firstName = user.app_metadata.full_name.split(' ')[0];
      console.log('Using full_name from app_metadata:', firstName);
      return firstName;
    }
    
    if (user?.identities?.[0]?.identity_data?.full_name) {
      const firstName = user.identities[0].identity_data.full_name.split(' ')[0];
      console.log('Using full_name from identities:', firstName);
      return firstName;
    }
    
    if (user?.identities?.[0]?.identity_data?.name) {
      const firstName = user.identities[0].identity_data.name.split(' ')[0];
      console.log('Using name from identities:', firstName);
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

  // Load user profile and set up dashboard
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user) {
        console.log('No user available, skipping profile load');
        setLoading(false);
        return;
      }

      try {
        console.log('Loading user profile for:', user.id);
        const profile = await userDataService.getUserProfile(user.id);
        console.log('Loaded profile:', profile);
        
        if (profile) {
          setUserProfile(profile);
          
          // Set default selected website if user has websites
          if (profile.websites && profile.websites.length > 0) {
            setSelectedWebsite(profile.websites[0].url);
            console.log('Set selected website to:', profile.websites[0].url);
          }
          
          // Check if onboarding was completed and walkthrough should trigger
          if (profile.onboarding_completed_at) {
            const walkthroughCompleted = localStorage.getItem('seogenix_walkthrough_completed');
            const immediateWalkthrough = localStorage.getItem('seogenix_immediate_walkthrough');
            
            console.log('Profile has onboarding completed:', {
              onboarding_completed_at: profile.onboarding_completed_at,
              walkthroughCompleted: !!walkthroughCompleted,
              immediateWalkthrough: !!immediateWalkthrough
            });
            
            // Trigger walkthrough if not completed and onboarding was done
            if (!walkthroughCompleted || immediateWalkthrough) {
              console.log('Triggering walkthrough from profile check');
              localStorage.removeItem('seogenix_immediate_walkthrough');
              setTimeout(() => {
                console.log('Starting immediate walkthrough...');
                setShowWalkthrough(true);
              }, 1500);
            }
          }
        } else {
          console.log('No profile found for user - this is expected for new users');
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [user]);

  // Track page visits
  useEffect(() => {
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
  useEffect(() => {
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

      // Check for immediate walkthrough trigger (from onboarding)
      const immediateWalkthrough = localStorage.getItem('seogenix_immediate_walkthrough');
      const walkthroughCompleted = localStorage.getItem('seogenix_walkthrough_completed');
      
      console.log('Dashboard initialization:', {
        immediateWalkthrough: !!immediateWalkthrough,
        walkthroughCompleted: !!walkthroughCompleted,
        userId: user.id,
        userEmail: user.email
      });

      // Always check for immediate walkthrough first
      if (immediateWalkthrough) {
        console.log('Found immediate walkthrough flag - triggering walkthrough');
        localStorage.removeItem('seogenix_immediate_walkthrough');
        
        // Use a longer delay to ensure dashboard is fully rendered
        setTimeout(() => {
          console.log('Starting immediate walkthrough...');
          setShowWalkthrough(true);
        }, 2000);
        return;
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

  // Handle tool completion with toast notification
  const handleToolComplete = (toolName: string, success: boolean, message?: string) => {
    if (success) {
      addToast({
        type: 'success',
        title: `${toolName} Completed`,
        message: message || 'Tool executed successfully',
        duration: 4000
      });
    } else {
      addToast({
        type: 'error',
        title: `${toolName} Failed`,
        message: message || 'Tool execution failed',
        duration: 6000
      });
    }
  };

  // Handle settings modal actions
  const handleSettingsClick = () => {
    if (activeSection === 'settings') {
      setShowSettings(true);
    } else {
      setActiveSection('settings');
    }
  };

  const handleBillingClick = () => {
    if (activeSection === 'billing') {
      setShowBilling(true);
    } else {
      setActiveSection('billing');
    }
  };

  // Manual walkthrough trigger function
  const triggerWalkthrough = () => {
    setShowWalkthrough(true);
  };

  // Enable chatbot for all users during development
  const isDevelopment = true; // Set to false for production
  const canAccessChatbot = isDevelopment || userPlan !== 'free';

  // Don't render dashboard until we have user data
  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading user data...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

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
                <div className="flex items-center space-x-4">
                  <button
                    onClick={triggerWalkthrough}
                    className="text-sm text-purple-600 hover:text-purple-700 underline"
                  >
                    Take Tour
                  </button>
                </div>
              </div>
            </div>

            {/* Site Selector - Show if user has completed onboarding */}
            {userProfile && userProfile.websites && userProfile.websites.length > 0 && (
              <SiteSelector
                websites={userProfile.websites}
                competitors={userProfile.competitors || []}
                selectedWebsite={selectedWebsite}
                onWebsiteChange={setSelectedWebsite}
                userPlan={userPlan}
              />
            )}
            
            {hasRunTools ? (
              <>
                <VisibilityScore userPlan={userPlan} selectedWebsite={selectedWebsite} />
                <ToolsGrid 
                  userPlan={userPlan} 
                  onToolRun={() => setHasRunTools(true)} 
                  selectedWebsite={selectedWebsite}
                  userProfile={userProfile}
                  onToolComplete={handleToolComplete}
                />
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
                <ToolsGrid 
                  userPlan={userPlan} 
                  onToolRun={() => setHasRunTools(true)} 
                  showPreview={true}
                  selectedWebsite={selectedWebsite}
                  userProfile={userProfile}
                  onToolComplete={handleToolComplete}
                />
              </div>
            )}
          </div>
        );
      
      case 'history':
        return <HistoricalPerformance userPlan={userPlan} selectedWebsite={selectedWebsite} />;
      
      case 'reports':
        return <ReportGenerator userPlan={userPlan} />;
      
      case 'editor':
        return <ContentEditor userPlan={userPlan} />;
      
      case 'realtime-editor':
        return <RealTimeContentEditor userPlan={userPlan} />;
      
      case 'competitive-viz':
        return <CompetitiveVisualization userPlan={userPlan} />;
      
      case 'integrations':
        return <CMSIntegrations userPlan={userPlan} />;
      
      case 'settings':
        return (
          <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Settings</h3>
            <p className="text-gray-600 mb-6">Manage your account settings, websites, and preferences.</p>
            <button
              onClick={() => setShowSettings(true)}
              className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-300"
            >
              Open Settings
            </button>
          </div>
        );
      
      case 'billing':
        return (
          <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Billing & Subscription</h3>
            <p className="text-gray-600 mb-6">Manage your subscription, view usage, and billing history.</p>
            <button
              onClick={() => setShowBilling(true)}
              className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-300"
            >
              Open Billing
            </button>
          </div>
        );
      
      case 'audit':
        return <ToolsGrid 
          userPlan={userPlan} 
          onToolRun={() => setHasRunTools(true)} 
          selectedTool="audit"
          selectedWebsite={selectedWebsite}
          userProfile={userProfile}
          onToolComplete={handleToolComplete}
        />;
      
      case 'schema':
        return <ToolsGrid 
          userPlan={userPlan} 
          onToolRun={() => setHasRunTools(true)} 
          selectedTool="schema"
          selectedWebsite={selectedWebsite}
          userProfile={userProfile}
          onToolComplete={handleToolComplete}
        />;
      
      case 'citations':
        return <ToolsGrid 
          userPlan={userPlan} 
          onToolRun={() => setHasRunTools(true)} 
          selectedTool="citations"
          selectedWebsite={selectedWebsite}
          userProfile={userProfile}
          onToolComplete={handleToolComplete}
        />;
      
      case 'voice':
        return <ToolsGrid 
          userPlan={userPlan} 
          onToolRun={() => setHasRunTools(true)} 
          selectedTool="voice"
          selectedWebsite={selectedWebsite}
          userProfile={userProfile}
          onToolComplete={handleToolComplete}
        />;
      
      case 'summaries':
        return <ToolsGrid 
          userPlan={userPlan} 
          onToolRun={() => setHasRunTools(true)} 
          selectedTool="summaries"
          selectedWebsite={selectedWebsite}
          userProfile={userProfile}
          onToolComplete={handleToolComplete}
        />;
      
      case 'optimizer':
        return <ToolsGrid 
          userPlan={userPlan} 
          onToolRun={() => setHasRunTools(true)} 
          selectedTool="optimizer"
          selectedWebsite={selectedWebsite}
          userProfile={userProfile}
          onToolComplete={handleToolComplete}
        />;
      
      case 'entities':
        return <ToolsGrid 
          userPlan={userPlan} 
          onToolRun={() => setHasRunTools(true)} 
          selectedTool="entities"
          selectedWebsite={selectedWebsite}
          userProfile={userProfile}
          onToolComplete={handleToolComplete}
        />;
      
      case 'generator':
        return <ToolsGrid 
          userPlan={userPlan} 
          onToolRun={() => setHasRunTools(true)} 
          selectedTool="generator"
          selectedWebsite={selectedWebsite}
          userProfile={userProfile}
          onToolComplete={handleToolComplete}
        />;
      
      case 'prompts':
        return <ToolsGrid 
          userPlan={userPlan} 
          onToolRun={() => setHasRunTools(true)} 
          selectedTool="prompts"
          selectedWebsite={selectedWebsite}
          userProfile={userProfile}
          onToolComplete={handleToolComplete}
        />;
      
      case 'competitive':
        return <ToolsGrid 
          userPlan={userPlan} 
          onToolRun={() => setHasRunTools(true)} 
          selectedTool="competitive"
          selectedWebsite={selectedWebsite}
          userProfile={userProfile}
          onToolComplete={handleToolComplete}
        />;
      
      case 'discovery':
        return <ToolsGrid 
          userPlan={userPlan} 
          onToolRun={() => setHasRunTools(true)} 
          selectedTool="discovery"
          selectedWebsite={selectedWebsite}
          userProfile={userProfile}
          onToolComplete={handleToolComplete}
        />;
      
      default:
        return <ToolsGrid 
          userPlan={userPlan} 
          onToolRun={() => setHasRunTools(true)} 
          selectedTool={activeSection}
          selectedWebsite={selectedWebsite}
          userProfile={userProfile}
          onToolComplete={handleToolComplete}
        />;
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
          onSettingsClick={handleSettingsClick}
          onBillingClick={handleBillingClick}
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
            // Clear any remaining immediate walkthrough flags
            localStorage.removeItem('seogenix_immediate_walkthrough');
          }}
          onSkip={() => {
            console.log('Walkthrough skipped - setting completion flag');
            setShowWalkthrough(false);
            localStorage.setItem('seogenix_walkthrough_completed', 'true');
            // Clear any remaining immediate walkthrough flags
            localStorage.removeItem('seogenix_immediate_walkthrough');
          }}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          user={user}
          userProfile={userProfile}
          onProfileUpdate={(profile) => {
            setUserProfile(profile);
            addToast({
              type: 'success',
              title: 'Settings Updated',
              message: 'Your profile has been updated successfully',
              duration: 3000
            });
          }}
        />
      )}

      {/* Billing Modal */}
      {showBilling && (
        <BillingModal
          onClose={() => setShowBilling(false)}
          userPlan={userPlan}
          onPlanChange={(plan) => {
            addToast({
              type: 'info',
              title: 'Plan Change Requested',
              message: `Plan change to ${plan} would be processed by payment system`,
              duration: 4000
            });
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

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
};

export default Dashboard;