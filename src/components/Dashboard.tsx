import React, { useState, useEffect, useCallback, useRef } from 'react';
import DashboardHeader from './DashboardHeader';
import Sidebar from './Sidebar';
import VisibilityScore from './VisibilityScore';
import ToolsGrid from './ToolsGrid';
import HistoricalPerformance from './HistoricalPerformance';
import ReportGenerator from './ReportGenerator';
import ContentEditor from './ContentEditor';
import CompetitiveVisualization from './CompetitiveVisualization';
import CMSIntegrations from './CMSIntegrations';
import OptimizationPlaybooks from './OptimizationPlaybooks';
import ChatbotPopup from './ChatbotPopup';
import DashboardWalkthrough from './DashboardWalkthrough';
import SiteSelector from './SiteSelector';
import CompetitiveAnalysisSiteSelector from './CompetitiveAnalysisSiteSelector';
import SettingsModal from './SettingsModal';
import BillingModal from './BillingModal';
import FeedbackModal from './FeedbackModal';
import GoalTracker from './GoalTracker';
import ToastContainer from './ToastContainer';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { TrendingUp, AlertTriangle, Target, Zap, Users, BarChart3, CheckCircle, ArrowRight, RefreshCw, MessageSquare } from 'lucide-react';
import ActionableInsights, { ActionableInsight } from './ActionableInsights';

interface DashboardProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  onNavigateToLanding: () => void;
  user: any;
  onSignOut: () => void;
  userProfile: any;
  showWalkthrough: boolean;
  onWalkthroughComplete: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ userPlan, onNavigateToLanding, user, onSignOut, userProfile, showWalkthrough, onWalkthroughComplete }) => {
  const [showChatbot, setShowChatbot] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const [hasRunTools, setHasRunTools] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [selectedWebsite, setSelectedWebsite] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [actionableInsights, setActionableInsights] = useState<ActionableInsight[]>([]);
  const { toasts, addToast, removeToast } = useToast();
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [profileFetchAttempted, setProfileFetchAttempted] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [userGoals, setUserGoals] = useState<string[]>([]);
  const [goalProgress, setGoalProgress] = useState<Record<string, number>>({});
  const [toolContext, setToolContext] = useState<any>(null);
  
  // Use refs to prevent duplicate fetches and track component mount state
  const profileFetchedRef = useRef(false);
  const isMountedRef = useRef(true);
  const activityTrackedRef = useRef(false);
  const insightsGeneratedRef = useRef(false);
  const auditHistoryFetchedRef = useRef(false);

  // Listen for alert actions from ProactiveAlerts component
  useEffect(() => {
    const handleAlertAction = (event: CustomEvent) => {
      const { actionUrl, alertId } = event.detail;
      if (actionUrl) {
        setActiveSection(actionUrl);
      }
    };

    window.addEventListener('alertAction', handleAlertAction as EventListener);
    
    return () => {
      window.removeEventListener('alertAction', handleAlertAction as EventListener);
    };
  }, []);

  // Extract first name from user data
  const getFirstName = () => {
    if (!user) {
      return 'User';
    }
    
    // Try multiple possible locations for the name
    if (user?.user_metadata?.full_name) {
      const firstName = user.user_metadata.full_name.split(' ')[0];
      return firstName;
    }
    
    if (user?.user_metadata?.name) {
      const firstName = user.user_metadata.name.split(' ')[0];
      return firstName;
    }
    
    // Fall back to email
    if (user?.email) {
      const emailName = user.email.split('@')[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    
    return 'User';
  };

  // Generate actionable insights based on user data
  const generateActionableInsights = useCallback(async () => {
    // Guard: only run if userProfile is fully loaded and onboarding status is defined
    if (!user || !user.id || !userProfile || typeof userProfile.onboarded !== 'boolean') return;
    
    // Prevent duplicate insight generation
    if (insightsGeneratedRef.current) return;
    insightsGeneratedRef.current = true;

    try {
      const insights: ActionableInsight[] = [];

      // Get recent audit history - use cached data if available
      const auditHistory = await userDataService.getAuditHistory(user.id, 5);
      const recentActivity = await userDataService.getRecentActivity(user.id, 10);

      // 1. No websites configured
      // Only fire if userProfile.websites is an empty array AND onboarding is complete
      if (
        Array.isArray(userProfile.websites) &&
        userProfile.websites.length === 0 &&
        userProfile.onboarded === true
      ) {
        insights.push({
          id: 'no-websites',
          type: 'urgent',
          title: 'Add Your First Website',
          description: 'Start optimizing by adding your website to track AI visibility performance.',
          action: 'Add Website',
          actionUrl: 'settings',
          icon: Target,
          color: 'from-red-500 to-red-600',
          contextualTip: 'Adding your website is essential for AI visibility tracking. Without it, you cannot run audits or monitor your performance against competitors.',
          learnMoreLink: 'https://docs.seogenix.com/getting-started/add-website'
        });
      }

      // 2. No audits run yet
      if (auditHistory.length === 0 && userProfile.websites?.length > 0) {
        insights.push({
          id: 'no-audits',
          type: 'urgent',
          title: 'Run Your First AI Visibility Audit',
          description: 'Get baseline scores and discover optimization opportunities for your website.',
          action: 'Run Audit',
          actionUrl: 'audit',
          icon: BarChart3,
          color: 'from-blue-500 to-blue-600',
          contextualTip: 'AI visibility audits analyze how well your content is structured for AI systems like ChatGPT, Claude, and voice assistants. This baseline is crucial for improvement.',
          learnMoreLink: 'https://docs.seogenix.com/tools/ai-visibility-audit'
        });
      }

      // 3. Low audit scores
      if (auditHistory.length > 0) {
        const latestAudit = auditHistory[0];
        if (latestAudit.overall_score < 60) {
          insights.push({
            id: 'low-score',
            type: 'urgent',
            title: 'Critical: Low AI Visibility Score',
            description: `Your latest score is ${latestAudit.overall_score}/100. Use Content Optimizer to improve immediately.`,
            action: 'Optimize Content',
            actionUrl: 'optimizer',
            icon: AlertTriangle,
            color: 'from-red-500 to-red-600',
            contextualTip: 'Scores below 60 indicate significant issues with AI comprehension. Content optimization can quickly improve your visibility and citation likelihood.',
            learnMoreLink: 'https://docs.seogenix.com/optimization/content-optimizer'
          });
        } else if (latestAudit.overall_score < 75) {
          insights.push({
            id: 'medium-score',
            type: 'opportunity',
            title: 'Improve Your AI Visibility Score',
            description: `Score: ${latestAudit.overall_score}/100. Add structured data with Schema Generator for quick wins.`,
            action: 'Generate Schema',
            actionUrl: 'schema',
            icon: TrendingUp,
            color: 'from-yellow-500 to-yellow-600',
            contextualTip: 'Schema markup helps AI systems understand your content structure and context, leading to better comprehension and higher citation rates.',
            learnMoreLink: 'https://docs.seogenix.com/tools/schema-generator'
          });
        }

        // Check for specific subscore issues
        if (latestAudit.content_structure < 70) {
          insights.push({
            id: 'structure-issue',
            type: 'opportunity',
            title: 'Content Structure Needs Work',
            description: `Structure score: ${latestAudit.content_structure}/100. Generate FAQ content to improve organization.`,
            action: 'Generate Content',
            actionUrl: 'generator',
            icon: Zap,
            color: 'from-purple-500 to-purple-600',
            contextualTip: 'Well-structured content with clear headings, FAQs, and logical flow helps AI systems extract and cite information more effectively.',
            learnMoreLink: 'https://docs.seogenix.com/optimization/content-structure'
          });
        }

        if (latestAudit.citation_likelihood < 70) {
          insights.push({
            id: 'citation-issue',
            type: 'opportunity',
            title: 'Low Citation Likelihood',
            description: `Citation score: ${latestAudit.citation_likelihood}/100. Track current mentions and optimize content.`,
            action: 'Track Citations',
            actionUrl: 'citations',
            icon: Target,
            color: 'from-teal-500 to-teal-600',
            contextualTip: 'Citation likelihood measures how likely AI systems are to reference your content. Higher scores mean more AI mentions and increased visibility.',
            learnMoreLink: 'https://docs.seogenix.com/monitoring/citation-tracking'
          });
        }
      }

      // 4. No competitors added
      if ((!userProfile.competitors || userProfile.competitors.length === 0) && userPlan !== 'free') {
        insights.push({
          id: 'no-competitors',
          type: 'opportunity',
          title: 'Add Competitors for Benchmarking',
          description: 'Discover how you stack up against competitors and find new optimization opportunities.',
          action: 'Discover Competitors',
          actionUrl: 'discovery',
          icon: Users,
          color: 'from-indigo-500 to-indigo-600',
          contextualTip: 'Competitive analysis reveals gaps in your AI visibility strategy and helps identify content opportunities your competitors are missing.',
          learnMoreLink: 'https://docs.seogenix.com/analysis/competitive-intelligence'
        });
      }

      // 5. Haven't used tools recently
      const recentToolUsage = recentActivity.filter(a => 
        a.activity_type === 'tool_used' && 
        new Date(a.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      );

      if (recentToolUsage.length === 0 && auditHistory.length > 0) {
        insights.push({
          id: 'inactive',
          type: 'suggestion',
          title: 'Stay Active with Regular Optimization',
          description: 'You haven\'t used optimization tools this week. Regular monitoring maintains AI visibility.',
          action: 'Run Quick Audit',
          actionUrl: 'audit',
          icon: CheckCircle,
          color: 'from-green-500 to-green-600',
          contextualTip: 'AI algorithms and search patterns evolve constantly. Regular optimization ensures your content stays visible and relevant to AI systems.',
          learnMoreLink: 'https://docs.seogenix.com/best-practices/regular-optimization'
        });
      }

      // 6. Plan-specific suggestions
      if (userPlan === 'free' && auditHistory.length >= 2) {
        insights.push({
          id: 'upgrade-suggestion',
          type: 'opportunity',
          title: 'Unlock Advanced Features',
          description: 'You\'ve run multiple audits! Upgrade to Core for detailed insights and optimization tools.',
          action: 'View Plans',
          actionUrl: 'billing',
          icon: TrendingUp,
          color: 'from-purple-500 to-purple-600',
          contextualTip: 'Advanced plans provide detailed subscore breakdowns, optimization tools, and competitive analysis to accelerate your AI visibility improvements.',
          learnMoreLink: 'https://docs.seogenix.com/plans/feature-comparison'
        });
      }

      // 7. High-performing users
      if (auditHistory.length > 0 && auditHistory[0].overall_score >= 85) {
        insights.push({
          id: 'high-performer',
          type: 'suggestion',
          title: 'Excellent AI Visibility!',
          description: `Score: ${auditHistory[0].overall_score}/100. Maintain your edge with competitive analysis.`,
          action: 'Analyze Competitors',
          actionUrl: 'competitive',
          icon: BarChart3,
          color: 'from-green-500 to-green-600',
          contextualTip: 'High scores indicate excellent AI visibility. Competitive analysis helps you stay ahead by identifying emerging trends and maintaining your advantage.',
          learnMoreLink: 'https://docs.seogenix.com/advanced/maintaining-leadership'
        });
      }

      // 8. Playbook recommendations based on goals
      if (userGoals.length > 0 && ['core', 'pro', 'agency'].includes(userPlan)) {
        if (userGoals.includes('increase_citations')) {
          insights.push({
            id: 'goal-citations',
            type: 'opportunity',
            title: 'Boost Your Citation Rate',
            description: 'Follow our Content Optimization Mastery playbook to increase AI citations.',
            action: 'Start Playbook',
            actionUrl: 'playbooks',
            icon: MessageSquare,
            color: 'from-yellow-500 to-yellow-600',
            contextualTip: 'Our specialized playbook will guide you through creating content that AI systems prefer to cite, with step-by-step instructions.',
            learnMoreLink: 'https://docs.seogenix.com/playbooks/content-optimization'
          });
        } else if (userGoals.includes('voice_search')) {
          insights.push({
            id: 'goal-voice',
            type: 'opportunity',
            title: 'Optimize for Voice Search',
            description: 'Follow our Voice Search Optimization playbook to improve conversational readiness.',
            action: 'Start Playbook',
            actionUrl: 'playbooks',
            icon: MessageSquare,
            color: 'from-green-500 to-green-600',
            contextualTip: 'Our voice search playbook will help you structure content for voice assistants and conversational AI.',
            learnMoreLink: 'https://docs.seogenix.com/playbooks/voice-search'
          });
        }
      }

      if (isMountedRef.current) {
        setActionableInsights(insights.slice(0, 3)); // Show top 3 insights
      }

      // Update goal progress
      if (auditHistory.length > 0 && userGoals.length > 0) {
        const latestAudit = auditHistory[0];
        const progress: Record<string, number> = {};
        
        if (userGoals.includes('increase_citations')) {
          progress['increase_citations'] = latestAudit.citation_likelihood;
        }
        
        if (userGoals.includes('improve_understanding')) {
          progress['improve_understanding'] = latestAudit.ai_understanding;
        }
        
        if (userGoals.includes('voice_search')) {
          progress['voice_search'] = latestAudit.conversational_readiness;
        }
        
        if (userGoals.includes('content_structure')) {
          progress['content_structure'] = latestAudit.content_structure;
        }
        
        if (userGoals.includes('competitive_edge')) {
          // For competitive edge, we'll need to calculate this differently
          // For now, just use the overall score
          progress['competitive_edge'] = latestAudit.overall_score;
        }
        
        setGoalProgress(progress);
      }

    } catch (error) {
      console.error('Error generating actionable insights:', error);
      if (isMountedRef.current) {
        setDashboardError('Failed to generate insights. Please refresh the page.');
      }
    } finally {
      // Reset the insights generation flag after a delay to allow for future regeneration
      setTimeout(() => {
        insightsGeneratedRef.current = false;
      }, 60000); // 1 minute cooldown
    }
  }, [user?.id, userProfile, userPlan, userGoals]);

  // Track component mount/unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Auto-select first website if none is selected
  useEffect(() => {
    if (userProfile?.websites?.length > 0 && !selectedWebsite) {
      const firstWebsite = userProfile.websites[0];
      if (firstWebsite?.url && firstWebsite?.id) {
        setSelectedWebsite(firstWebsite.url);
        setSelectedProjectId(firstWebsite.id);
      }
    }
  }, [userProfile]);

  // Auto-select first competitor
  useEffect(() => {
    if (userProfile?.competitors?.length > 0 && !selectedCompetitor) {
      const firstCompetitor = userProfile.competitors[0];
      if (firstCompetitor?.url) {
        setSelectedCompetitor(firstCompetitor.url);
      }
    }
  }, [userProfile, selectedCompetitor]);

  // Generate insights when profile loads - only once
  useEffect(() => {
    if (userProfile && user && user.id && !insightsGeneratedRef.current) {
      generateActionableInsights();
    }
  }, [userProfile, user?.id, userPlan, generateActionableInsights, userGoals]);

  // Centralized audit history fetching to prevent duplicate requests
  useEffect(() => {
    const fetchAuditHistory = async () => {
      if (!user?.id || !isMountedRef.current || auditHistoryFetchedRef.current) return;
      
      auditHistoryFetchedRef.current = true;
      
      try {
        // Fetch with the largest limit we'll need (20) once
        await userDataService.getAuditHistory(user.id, 20);
        console.log('Centralized audit history fetch completed');
      } catch (error) {
        console.error('Error in centralized audit history fetch:', error);
      } finally {
        // Reset the flag after a delay to allow for future fetches if needed
        setTimeout(() => {
          auditHistoryFetchedRef.current = false;
        }, 30000); // 30 second cooldown
      }
    };
    
    fetchAuditHistory();
  }, [user?.id]);

  // Track page visits - only once when section changes
  useEffect(() => {
    const trackPageVisit = async () => {
      // Only track once per section change and if user exists
      if (activityTrackedRef.current || !user?.id) return;
      
      activityTrackedRef.current = true;
      
      try {
        await userDataService.trackActivity({
          user_id: user.id,
          activity_type: 'page_visited',
          activity_data: { section: activeSection }
        });
      } catch (error) {
        console.error('Error tracking page visit:', error);
      } finally {
        // Reset the tracking flag after a delay to allow for future tracking
        setTimeout(() => {
          activityTrackedRef.current = false;
        }, 5000);
      }
    };

    trackPageVisit();
  }, [activeSection, user?.id]); // Only depend on user.id, not the entire user object

  // Handle tool launch from Genie
  const handleToolLaunch = async (toolId: string) => {
    setSelectedTool(toolId);
    setActiveSection(toolId);
    
    // Track tool launch activity
    try {
      if (user && user.id) {
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

  const handleSwitchTool = (toolId: string, context: any) => {
    setToolContext(context);
    setActiveSection(toolId);
  };

  // Handle tool completion with toast notification
  const handleToolComplete = (toolName: string, success: boolean, message?: string) => {
    if (success) {
      addToast({
        id: `tool-${Date.now()}`,
        type: 'success',
        title: `${toolName} Completed`,
        message: message || 'Tool executed successfully',
        duration: 4000,
        onClose: () => {}
      });
      
      // Mark that tools have been run
      localStorage.setItem('seogenix_tools_run', 'true');
      setHasRunTools(true);
      
      // Reset insights generation flag to allow regeneration
      insightsGeneratedRef.current = false;
      
      // Regenerate insights after tool completion
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
        onClose: () => {}
      });
    }
  };

  // Handle insight action clicks
  const handleInsightAction = (insight: ActionableInsight) => {
    if (insight.actionUrl) {
      setActiveSection(insight.actionUrl);
      
      // Track insight action
      try {
        if (user && user.id) {
          userDataService.trackActivity({
            user_id: user.id,
            activity_type: 'insight_action_taken',
            activity_data: { 
              insightId: insight.id,
              insightType: insight.type,
              actionUrl: insight.actionUrl
            }
          });
        }
      } catch (error) {
        console.error('Error tracking insight action:', error);
      }
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

  // Open feedback modal
  const handleOpenFeedback = () => {
    setShowFeedback(true);
  };

  // Enable chatbot for all users during development
  const isDevelopment = true; // Set to false for production
  const canAccessChatbot = isDevelopment || userPlan !== 'free';

  // Force a reload of the dashboard to try again
  const handleReloadDashboard = () => {
    // Reset all refs and state before reload
    profileFetchedRef.current = false;
    activityTrackedRef.current = false;
    insightsGeneratedRef.current = false;
    auditHistoryFetchedRef.current = false;
    setProfileFetchAttempted(false);
    setDashboardError(null);
    
    // Clear all caches to ensure fresh data
    userDataService.clearCache(user?.id);
    
    // Reload the page
    window.location.reload();
  };

  // Don't render dashboard until we have user data
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
          {dashboardError && (
            <p className="text-red-500 mt-2 max-w-md mx-auto text-sm">{dashboardError}</p>
          )}
        </div>
      </div>
    );
  }

  if (loading || loadingProfile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
          {dashboardError && (
            <p className="text-red-500 mt-2 max-w-md mx-auto text-sm">{dashboardError}</p>
          )}
        </div>
      </div>
    );
  }

  if (dashboardLoading) {
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
                  <button
                    onClick={handleOpenFeedback}
                    className="text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded-lg hover:bg-purple-200 transition-colors"
                  >
                    Give Feedback
                  </button>
                </div>
              </div>
            </div>

            {/* Site Selector - Show if user has completed onboarding */}
            {userProfile && userProfile.websites && userProfile.websites.length > 0 && (
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
                    const selected = userProfile.websites.find((w: any) => w.url === url);
                    setSelectedWebsite(url);
                    if (selected) {
                      setSelectedProjectId(selected.id);
                    }
                  }}
                  userPlan={userPlan}
                />
              )
            )}

            {/* Goal Tracker */}
            {userGoals.length > 0 && (
              <GoalTracker 
                goals={userGoals} 
                progress={goalProgress}
                userPlan={userPlan}
                onPlaybookStart={() => setActiveSection('playbooks')}
              />
            )}

            {/* Actionable Insights Section */}
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
        return <OptimizationPlaybooks 
                userPlan={userPlan} 
                onSectionChange={setActiveSection} 
                userGoals={userGoals}
                userProfile={userProfile}
               />;
      
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
        return <ToolsGrid 
          userPlan={userPlan} 
          onToolRun={() => setHasRunTools(true)} 
          selectedTool={activeSection}
          selectedWebsite={selectedWebsite}
          selectedProjectId={selectedProjectId}
          userProfile={userProfile}
          onToolComplete={handleToolComplete}
          onSwitchTool={handleSwitchTool}
          context={toolContext}
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
      
      {/* Dashboard Walkthrough */}
      {showWalkthrough && (
        <DashboardWalkthrough
          onComplete={() => {
            console.log('Walkthrough completed - setting completion flag');
            onWalkthroughComplete();
            localStorage.setItem('seogenix_walkthrough_completed', 'true');
            // Clear any remaining immediate walkthrough flags
            localStorage.removeItem('seogenix_immediate_walkthrough');
          }}
          onSkip={() => {
            console.log('Walkthrough skipped - setting completion flag');
            onWalkthroughComplete();
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
            
            // Update user goals if they've changed
            if (profile.goals && Array.isArray(profile.goals)) {
              setUserGoals(profile.goals);
            }
            
            addToast({
              id: `settings-updated-${Date.now()}`,
              type: 'success',
              title: 'Settings Updated',
              message: 'Your profile has been updated successfully',
              duration: 3000,
              onClose: () => {}
            });
            
            // Clear profile cache to ensure fresh data
            userDataService.clearCache(user.id);
            
            // Reset insights generation flag to allow regeneration
            insightsGeneratedRef.current = false;
            
            // Regenerate insights after profile update
            setTimeout(() => {
              generateActionableInsights();
            }, 500);
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
              id: `plan-change-${Date.now()}`,
              type: 'info',
              title: 'Plan Change Requested',
              message: `Plan change to ${plan} would be processed by payment system`,
              duration: 4000,
              onClose: () => {}
            });
          }}
          user={user}
        />
      )}

      {/* Feedback Modal */}
      {showFeedback && (
        <FeedbackModal
          onClose={() => setShowFeedback(false)}
          user={user}
          userPlan={userPlan}
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
          user={user}
        />
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
};

export default Dashboard;