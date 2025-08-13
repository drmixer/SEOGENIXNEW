import React, { useState, useEffect, useRef } from 'react';
import DashboardHeader from './DashboardHeader';
import Sidebar from './Sidebar';
import SiteSelector from './SiteSelector';
import CompetitiveAnalysisSiteSelector from './CompetitiveAnalysisSiteSelector';
import GoalTracker from './GoalTracker';
import ActionableInsights from './ActionableInsights';
import VisibilityScore from './VisibilityScore';
import ToolsGrid from './ToolsGrid';
import OptimizationPlaybooks from './OptimizationPlaybooks';
import HistoricalPerformance from './HistoricalPerformance';
import ReportGenerator from './ReportGenerator';
import ContentEditor from './ContentEditor';
import CompetitiveVisualization from './CompetitiveVisualization';
import CMSIntegrations from './CMSIntegrations';
import SettingsModal from './SettingsModal';
import BillingModal from './BillingModal';
import FeedbackModal from './FeedbackModal';
import ChatbotPopup from './ChatbotPopup';
import DashboardWalkthrough from './DashboardWalkthrough';
import ToastContainer from './ToastContainer';

const Dashboard = ({
  userPlan,
  onNavigateToLanding,
  user,
  onSignOut,
  userProfile,
  onProfileUpdate,
  showWalkthrough: showWalkthroughProp,
  onWalkthroughComplete,
}) => {
  const [activeSection, setActiveSection] = useState('overview');
  const [showSettings, setShowSettings] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(showWalkthroughProp || false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);
  const [actionableInsights, setActionableInsights] = useState([]);
  const [hasRunTools, setHasRunTools] = useState(false);
  const [selectedWebsite, setSelectedWebsite] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedCompetitor, setSelectedCompetitor] = useState(null);
  const [userGoals, setUserGoals] = useState([]);
  const [goalProgress, setGoalProgress] = useState({});
  const insightsGeneratedRef = useRef(false);
  const profileFetchedRef = useRef(false);
  const activityTrackedRef = useRef(false);
  const auditHistoryFetchedRef = useRef(false);
  const [toasts, setToasts] = useState([]);

  const addToast = (toast) => setToasts((prev) => [...prev, toast]);
  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const handleToolComplete = ({ toolName, success, message }) => {
    if (success) {
      insightsGeneratedRef.current = false;
      setTimeout(() => generateActionableInsights(), 1000);
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

  const handleInsightAction = (insight) => {
    if (insight.actionUrl) {
      setActiveSection(insight.actionUrl);
      try {
        if (user && user.id) {
          // Replace with your tracking service
        }
      } catch (error) {
        console.error('Error tracking insight action:', error);
      }
    }
  };

  const handleSettingsClick = () => {
    if (activeSection === 'settings') setShowSettings(true);
    else setActiveSection('settings');
  };

  const handleBillingClick = () => {
    if (activeSection === 'billing') setShowBilling(true);
    else setActiveSection('billing');
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
    setDashboardError(null);
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

  if (loading || dashboardLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{loading ? 'Loading dashboard...' : 'Loading...'}</p>
          {dashboardError && <p className="text-red-500 mt-2 max-w-md mx-auto text-sm">{dashboardError}</p>}
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
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back!</h1>
                  <p className="text-gray-600">Monitor your AI visibility performance and access optimization tools.</p>
                </div>
                <div className="flex items-center space-x-4">
                  <button onClick={triggerWalkthrough} className="text-sm text-purple-600 hover:text-purple-700 underline">Take Tour</button>
                  <button onClick={handleOpenFeedback} className="text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded-lg hover:bg-purple-200 transition-colors">Give Feedback</button>
                </div>
              </div>
            </div>

            {userProfile?.websites?.length > 0 && (
              activeSection === 'competitive-viz' ? (
                <CompetitiveAnalysisSiteSelector
                  userWebsites={userProfile.websites}
                  competitors={userProfile.competitors || []}
                  selectedUserWebsite={selectedWebsite}
                  selectedCompetitor={selectedCompetitor}
                  onUserWebsiteChange={setSelectedWebsite}
                  onCompetitorChange={setSelectedCompetitor}
                />
              ) : (
                <SiteSelector
                  websites={userProfile.websites}
                  competitors={userProfile.competitors || []}
                  selectedWebsite={selectedWebsite}
                  onWebsiteChange={(url) => {
                    const selected = userProfile.websites.find((w) => w.url === url);
                    setSelectedWebsite(url);
                    if (selected) setSelectedProjectId(selected.id);
                  }}
                  userPlan={userPlan}
                />
              )
            )}

            {userGoals.length > 0 && (
              <GoalTracker goals={userGoals} progress={goalProgress} userPlan={userPlan} onPlaybookStart={() => setActiveSection('playbooks')} />
            )}

            <ActionableInsights insights={actionableInsights} onInsightAction={handleInsightAction} />

            {hasRunTools ? (
              <>
                <VisibilityScore userPlan={userPlan} selectedWebsite={selectedWebsite} />
                <ToolsGrid userPlan={userPlan} onToolRun={() => setHasRunTools(true)} selectedWebsite={selectedWebsite} selectedProjectId={selectedProjectId} userProfile={userProfile} onToolComplete={handleToolComplete} />
              </>
            ) : (
              <div className="space-y-8">
                <div className="bg-gradient-to-r from-teal-50 to-purple-50 rounded-xl p-8 border border-teal-200 text-center">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready to Get Started?</h2>
                  <p className="text-gray-600 mb-6 max-w-2xl mx-auto">Run your first AI visibility audit to see how well your content is optimized.</p>
                  <button onClick={() => setActiveSection('audit')} className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-300">Run Your First Audit</button>
                </div>
                <ToolsGrid userPlan={userPlan} onToolRun={() => setHasRunTools(true)} showPreview={true} selectedWebsite={selectedWebsite} userProfile={userProfile} onToolComplete={handleToolComplete} />
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
        return <ContentEditor userPlan={userPlan} />;
      case 'competitive-viz':
        return <CompetitiveVisualization userPlan={userPlan} />;
      case 'integrations':
        return <CMSIntegrations userPlan={userPlan} />;
      case 'settings':
        return (
          <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
            <h3 className="text-lg font-medium text-gray-900">Settings</h3>
            <p className="mt-2 text-gray-600">Adjust your account preferences and configurations.</p>
          </div>
        );
      case 'billing':
        return (
          <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
            <h3 className="text-lg font-medium text-gray-900">Billing</h3>
            <p className="mt-2 text-gray-600">Manage your subscription and billing details.</p>
          </div>
        );
      default:
        return <div>Select a section</div>;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} onSettingsClick={handleSettingsClick} onBillingClick={handleBillingClick} />
      <div className="flex-1 flex flex-col">
        <DashboardHeader user={user} onSignOut={onSignOut} />
        <main className="flex-1 p-6 overflow-y-auto">
          {renderActiveSection()}
        </main>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} userProfile={userProfile} onProfileUpdate={onProfileUpdate} />}
      {showBilling && <BillingModal onClose={() => setShowBilling(false)} userPlan={userPlan} />}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
      {showWalkthrough && <DashboardWalkthrough onComplete={() => { setShowWalkthrough(false); onWalkthroughComplete(); }} />}
      {canAccessChatbot && <ChatbotPopup isOpen={showChatbot} onClose={() => setShowChatbot(false)} />}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
};

export default Dashboard;

