import React, { useState, useEffect, useCallback } from 'react';
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
import OptimizationPlaybooks from './OptimizationPlaybooks';
import ChatbotPopup from './ChatbotPopup';
import DashboardWalkthrough from './DashboardWalkthrough';
import SiteSelector from './SiteSelector';
import SettingsModal from './SettingsModal';
import BillingModal from './BillingModal';
import ToastContainer from './ToastContainer';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { TrendingUp, AlertTriangle, Target, Zap, Users, BarChart3, CheckCircle, ArrowRight, RefreshCw } from 'lucide-react';

interface DashboardProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  onNavigateToLanding: () => void;
  user: any;
  onSignOut: () => void;
}

interface ActionableInsight {
  id: string;
  type: 'urgent' | 'opportunity' | 'suggestion';
  title: string;
  description: string;
  action: string;
  actionUrl?: string;
  icon: React.ComponentType<any>;
  color: string;
  contextualTip?: string;
  learnMoreLink?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ userPlan, onNavigateToLanding, user, onSignOut }) => {
  const [showChatbot, setShowChatbot] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [hasRunTools, setHasRunTools] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [selectedWebsite, setSelectedWebsite] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [actionableInsights, setActionableInsights] = useState<ActionableInsight[]>([]);
  const { toasts, addToast, removeToast } = useToast();
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [profileFetchAttempted, setProfileFetchAttempted] = useState(false);

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
    if (!user || !userProfile) return;

    try {
      const insights: ActionableInsight[] = [];

      // Get recent audit history
      const auditHistory = await userDataService.getAuditHistory(user.id, 5);
      const recentActivity = await userDataService.getRecentActivity(user.id, 10);

      // 1. No websites configured
      if (!userProfile.websites || userProfile.websites.length === 0) {
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

      setActionableInsights(insights.slice(0, 3)); // Show top 3 insights

    } catch (error) {
      console.error('Error generating actionable insights:', error);
      setDashboardError('Failed to generate insights. Please refresh the page.');
    }
  }, [user, userProfile, userPlan]);

  // Load user profile and set up dashboard
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user) {
        console.log('No user available, skipping profile load');
        setLoading(false);
        setLoadingProfile(false);
        return;
      }

      try {
        console.log('Loading user profile for:', user.id);
        setLoadingProfile(true);
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
              }, 1000); // Reduced from 1500ms for faster rendering
            }
          }
          
          // Check if user has run tools before
          const toolsRun = localStorage.getItem('seogenix_tools_run');
          if (toolsRun) {
            setHasRunTools(true);
          }
          
          setLoading(false);
          setLoadingProfile(false);
          setProfileFetchAttempted(true);
        } else {
          console.log('No profile found for user - this is expected for new users');
          setLoading(false);
          setLoadingProfile(false);
          setProfileFetchAttempted(true);
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
        setDashboardError('Failed to load user profile. Please refresh the page.');
        setLoading(false);
        setLoadingProfile(false);
        setProfileFetchAttempted(true);
      }
    };

    if (user && !profileFetchAttempted) {
      loadUserProfile();
    } else if (!user) {
      setLoading(false);
      setLoadingProfile(false);
    }
  }, [user, profileFetchAttempted]);

  // Generate insights when profile loads
  useEffect(() => {
    if (userProfile && user) {
      generateActionableInsights();
    }
  }, [userProfile, user, userPlan, generateActionableInsights]);

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
        if (user) {
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

  // Enable chatbot for all users during development
  const isDevelopment = true; // Set to false for production
  const canAccessChatbot = isDevelopment || userPlan !== 'free';

  // Force a reload of the dashboard to try again
  const handleReloadDashboard = () => {
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

            {/* Actionable Insights Section */}
            {actionableInsights.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Actionable Insights</h3>
                  <span className="text-sm text-gray-500">{actionableInsights.length} recommendations</span>
                </div>
                
                <div className="space-y-4">
                  {actionableInsights.map((insight) => {
                    const IconComponent = insight.icon;
                    return (
                      <div 
                        key={insight.id}
                        className={`p-4 rounded-lg border-l-4 ${
                          insight.type === 'urgent' ? 'border-red-500 bg-red-50' :
                          insight.type === 'opportunity' ? 'border-yellow-500 bg-yellow-50' :
                          'border-blue-500 bg-blue-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <div className={`p-2 rounded-lg bg-gradient-to-r ${insight.color}`}>
                              <IconComponent className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 mb-1">{insight.title}</h4>
                              <p className="text-sm text-gray-600 mb-2">{insight.description}</p>
                              
                              {/* Contextual Tip */}
                              {insight.contextualTip && (
                                <div className="bg-white bg-opacity-50 rounded-lg p-3 mb-3 border border-gray-200">
                                  <p className="text-xs text-gray-700 leading-relaxed">
                                    💡 <strong>Why this matters:</strong> {insight.contextualTip}
                                  </p>
                                  {insight.learnMoreLink && (
                                    <a 
                                      href={insight.learnMoreLink} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:text-blue-700 mt-1 inline-block"
                                    >
                                      Learn more →
                                    </a>
                                  )}
                                </div>
                              )}
                              
                              <button
                                onClick={() => handleInsightAction(insight)}
                                className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                                  insight.type === 'urgent' ? 'bg-red-600 text-white hover:bg-red-700' :
                                  insight.type === 'opportunity' ? 'bg-yellow-600 text-white hover:bg-yellow-700' :
                                  'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                              >
                                <span>{insight.action}</span>
                                <ArrowRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                            insight.type === 'urgent' ? 'bg-red-100 text-red-800' :
                            insight.type === 'opportunity' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {insight.type}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
      
      case 'playbooks':
        return <OptimizationPlaybooks userPlan={userPlan} onSectionChange={setActiveSection} />;
      
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
              id: `settings-updated-${Date.now()}`,
              type: 'success',
              title: 'Settings Updated',
              message: 'Your profile has been updated successfully',
              duration: 3000,
              onClose: () => {}
            });
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