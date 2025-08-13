import React, { useState, useEffect, useRef } from 'react';
import DashboardHeader from './DashboardHeader';
import Sidebar from './Sidebar';
import ToolsGrid from './ToolsGrid';
import VisibilityScore from './VisibilityScore';
import GoalTracker from './GoalTracker';
import ActionableInsights from './ActionableInsights';
import OptimizationPlaybooks from './OptimizationPlaybooks';
import HistoricalPerformance from './HistoricalPerformance';
import ReportGenerator from './ReportGenerator';
import ContentEditor from './ContentEditor';
import CompetitiveVisualization from './CompetitiveVisualization';
import CMSIntegrations from './CMSIntegrations';
import DashboardWalkthrough from './DashboardWalkthrough';
import SettingsModal from './SettingsModal';
import BillingModal from './BillingModal';
import FeedbackModal from './FeedbackModal';
import ChatbotPopup from './ChatbotPopup';
import ToastContainer from './ToastContainer';
import { AlertTriangle, RefreshCw } from 'react-feather';
import { userDataService } from '../services/userDataService';
import { ActionableInsight } from '../types';

interface DashboardProps {
  user: any;
  userProfile: any;
  userGoals: any[];
  goalProgress: any;
  userPlan: string;
  onNavigateToLanding: () => void;
  onSignOut: () => void;
  onProfileUpdate: (profile: any) => void;
  onWalkthroughComplete: () => void;
  actionableInsights: ActionableInsight[];
  loading: boolean;
  loadingProfile: boolean;
  dashboardLoading: boolean;
  dashboardError: string | null;
  handleToolLaunch: (tool: string) => void;
  handleSwitchTool: (tool: string) => void;
  toolContext: any;
}

const Dashboard: React.FC<DashboardProps> = ({
  user,
  userProfile,
  userGoals,
  goalProgress,
  userPlan,
  onNavigateToLanding,
  onSignOut,
  onProfileUpdate,
  onWalkthroughComplete,
  actionableInsights,
  loading,
  loadingProfile,
  dashboardLoading,
  dashboardError,
  handleToolLaunch,
  handleSwitchTool,
  toolContext,
}) => {
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [showSettings, setShowSettings] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);
  const [selectedWebsite, setSelectedWebsite] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>('');
  const [hasRunTools, setHasRunTools] = useState(false);

  const profileFetchedRef = useRef(false);
  const activityTrackedRef = useRef(false);
  const insightsGeneratedRef = useRef(false);
  const auditHistoryFetchedRef = useRef(false);

  const addToast = (toast: any) => setToasts(prev => [...prev, toast]);
  const removeToast = (id: string | number) => setToasts(prev => prev.filter(t => t.id !== id));

  const getFirstName = () => {
    return user?.name?.split(' ')[0] || 'User';
  };

  const handleToolComplete = (toolName: string, success: boolean, message?: string) => {
    if (success) {
      insightsGeneratedRef.current = false;
      setTimeout(() => {
        generateActionableInsights();
      }, 1000);
    } else {
      addToast({
        id: `tool-error-${Date.now()}`,
        type: 'error',
        title: `${toolName} Failed`,
        message: message || 'Tool execution failed',
        duration: 6000,
        onClose: () => {},
      });
    }
  };

  const generateActionableInsights = () => {
    if (insightsGeneratedRef.current) return;
    insightsGeneratedRef.current = true;
    // You would call your insights API or logic here
  };

  const handleInsightAction = (insight: ActionableInsight) => {
    if (insight.actionUrl) {
      setActiveSection(insight.actionUrl);
      try {
        if (user?.id) {
          userDataService.trackActivity({
            user_id: user.id,
            activity_type: 'insight_action_taken',
            activity_data: {
              insightId: insight.id,
              insightType: insight.type,
              actionUrl: insight.actionUrl,
            },
          });
        }
      } catch (error) {
        console.error('Error tracking insight action:', error);
      }
    }
  };

  const handleSettingsClick = () => {
    activeSection === 'settings' ? setShowSettings(true) : setActiveSection('settings');
  };

  const handleBillingClick = () => {
    activeSection === 'billing' ? setShowBilling(true) : setActiveSection('billing');
  };

  const triggerWalkthrough = () => setShowWalkthrough(true);
  const handleOpenFeedback = () => setShowFeedback(true);

  const isDevelopment = true;
  const canAccessChatbot = isDevelopment || userPlan !== 'free';

  const handleReloadDashboard = () => {
    profileFetchedRef.current = false;
    activityTrackedRef.current = false;
    insightsGeneratedRef.current = false;
    auditHistoryFetchedRef.current = false;

    userDataService.clearCache(user?.id);
    window.location.reload();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading user data...</p>
          <div className="mt-4">
            <button
              onClick={onNavigateToLanding}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Return to Home
            </button>
          </div>
          {dashboardError && <p className="text-red-500 mt-2 max-w-md mx-auto text-sm">{dashboardError}</p>}
        </div>
      </div>
    );
  }

  if (loading || loadingProfile || dashboardLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{loading || loadingProfile ? 'Loading dashboard...' : 'Loading dashboard...'}</p>
        </div>
      </div>
    );
  }

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-8">
            {/* Welcome & actions */}
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back, {getFirstName()}!</h1>
                <p className="text-gray-600">Monitor your AI visibility performance and access optimization tools.</p>
              </div>
              <div className="flex items-center space-x-4">
                <button onClick={triggerWalkthrough} className="text-sm text-purple-600 hover:text-purple-700 underline">
                  Take Tour
                </button>
                <button
                  onClick={handleOpenFeedback}
                  className="text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded-lg hover:bg-purple-200 transition-colors"
                >
                  Give Feedback
                </button>
              </div>
            </div>

            {/* Site Selector */}
            {userProfile?.websites?.length > 0 && (
              <SiteSelector
                websites={userProfile.websites}
                competitors={userProfile.competitors || []}
                selectedWebsite={selectedWebsite}
                onWebsiteChange={(url) => {
                  const selected = userProfile.websites.find((w: any) => w.url === url);
                  setSelectedWebsite(url);
                  if (selected) setSelectedProjectId(selected.id);
                }}
                userPlan={userPlan}
              />
            )}

            {/* Goals */}
            {userGoals.length > 0 && (
              <GoalTracker goals={userGoals} progress={goalProgress} userPlan={userPlan} onPlaybookStart={() => setActiveSection('playbooks')} />
            )}

            {/* Insights */}
            <ActionableInsights insights={actionableInsights} onInsightAction={handleInsightAction} />

            {hasRunTools ? (
              <>
                <VisibilityScore userPlan={userPlan} selectedWebsite={selectedWebsite} />
                <ToolsGrid
                  userPlan={userPlan}
                  onToolRun={() => setHasRunTools(true)}
                  selectedWebsite={selectedWebsite}
                  selectedProjectId={selectedProjectId}
                  userProfile={userProfile}
                  onToolComplete={handleToolComplete}
                />
              </>
            ) : (
              <div className="space-y-8">
                {/* Getting Started */}
                <div className="bg-gradient-to-r from-teal-50 to-purple-50 rounded-xl p-8 border border-teal-200 text-center">
                  <div className="bg-gradient-to-r from-teal-500 to-purple-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready to Get Started?</h2>
                  <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                    Run your first AI visibility audit to see how well your content is optimized for AI systems like ChatGPT, Claude, and voice assistants.
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

      case 'playbooks':
        return <OptimizationPlaybooks userPlan={userPlan} onSectionChange={setActiveSection} userGoals={userGoals} userProfile={userProfile} />;

      case 'history':
        return <HistoricalPerformance userPlan={userPlan} selectedWebsite={selectedWebsite} />;

      case 'reports':
        return <ReportGenerator userPlan={userPlan} />;

      case 'editor':
        return <ContentEditor userPlan={userPlan} context={toolContext} />;

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

      default:
        return (
          <ToolsGrid
            userPlan={userPlan}
            onToolRun={() => setHasRunTools(true)}
            selectedTool={activeSection}
            selectedWebsite={selectedWebsite}
            selectedProjectId={selectedProjectId}
            userProfile={userProfile}
            onToolComplete={handleToolComplete}
            onSwitchTool={handleSwitchTool}
            context={toolContext}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-hidden">
      <DashboardHeader userPlan={userPlan} onNavigateToLanding={onNavigateToLanding} user={user} onSignOut={onSignOut} />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          userPlan={userPlan}
          onSettingsClick={handleSettingsClick}
          onBillingClick={handleBillingClick}
          userGoals={userGoals}
        />
        <main className="flex-1 p-8 overflow-y-auto">
          {dashboardError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
              <div className="flex flex-col items-center text-center">
                <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                <h3 className="text-lg font-medium text-red-800 mb-2">Dashboard Error</h3>
                <p className="text-red-700 mb-4">{dashboardError}</p>
                <button
                  onClick={handleReloadDashboard}
                  className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Reload Dashboard</span>
                </button>
              </div>
            </div>
          ) : (
            renderActiveSection()
          )}
        </main>
      </div>

      {/* Walkthrough */}
      {showWalkthrough && (
        <DashboardWalkthrough
          onComplete={() => {
            onWalkthroughComplete();
            localStorage.setItem('seogenix_walkthrough_completed', 'true');
            localStorage.removeItem('seogenix_immediate_walkthrough');
          }}
          onSkip={() => {
            onWalkthroughComplete();
            localStorage.setItem('seogenix_walkthrough_completed', 'true');
            localStorage.removeItem('seogenix_immediate_walkthrough');
          }}
        />
      )}

      {/* Modals */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} user={user} userProfile={userProfile} onProfileUpdate={onProfileUpdate} />}
      {showBilling && (
        <BillingModal
          onClose={() => setShowBilling(false)}
          userPlan={userPlan}
          user={user}
          onPlanChange={(plan) => {
            addToast({
              id: `plan-change-${Date.now()}`,
              type: 'info',
              title: 'Plan Change Requested',
              message: `Plan change to ${plan} would be processed by payment system`,
              duration: 4000,
              onClose: () => {},
            });
          }}
        />
      )}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} user={user} userPlan={userPlan} />}

      {/* Chatbot */}
      {canAccessChatbot && (
        <>
          <button
            data-walkthrough="chatbot"
            onClick={() => setShowChatbot(true)}
            className="fixed bottom-6 right-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 z-40"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
          {showChatbot && <ChatbotPopup onClose={() => setShowChatbot(false)} type="dashboard" userPlan={userPlan} user={user} onToolLaunch={handleToolLaunch} />}
        </>
      )}

      {/* Toasts */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
};

export default Dashboard;
