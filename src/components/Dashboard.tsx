import React, { useState, useEffect, useCallback, useRef } from 'react';
import DashboardHeader from './DashboardHeader';
import SchemaPortfolio from './pages/SchemaPortfolio';
import AISitemap from './pages/AISitemap';
import Sidebar from './Sidebar';
import VisibilityScore from './VisibilityScore';
import ToolsGrid from './ToolsGrid';
import ToolModal from './ToolModal';
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
import CompetitiveAnalysisSiteSelector from './CompetitiveAnalysisSiteSelector';
import SettingsModal from './SettingsModal';
import BillingModal from './BillingModal';
import FeedbackModal from './FeedbackModal';
import GoalTracker from './GoalTracker';
import ToastContainer from './ToastContainer';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { TrendingUp, AlertTriangle, Target, Zap, Users, BarChart3, CheckCircle, ArrowRight, RefreshCw, MessageSquare, FileText, Search, Star } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';


interface DashboardProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  onNavigateToLanding: () => void;
  user: any;
  onSignOut: () => void;
  userProfile: any;
  showWalkthrough: boolean;
  onWalkthroughComplete: () => void;
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

// *** NEW: Development Mode Flag ***
// Set this to true to unlock all features for any user, regardless of their actual plan.
// Set to false for production to enforce plan restrictions.
const isDevelopment = true;


// --- NEW Dashboard Command Center Widgets ---

// 1. Historical Performance Snapshot
const HistoricalSnapshot = ({ userId, selectedProjectId }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!userId || !selectedProjectId) return;
            setLoading(true);
            try {
                // Fetch the last 30 days of audit history
                const history = await userDataService.getAuditHistory(userId, 30, selectedProjectId);
                const formattedData = history
                    .map(item => ({
                        date: new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                        score: item.overall_score,
                    }))
                    .reverse(); // Ensure chronological order
                setData(formattedData);
            } catch (error) {
                console.error("Error fetching historical data for snapshot:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [userId, selectedProjectId]);

    if (loading) return <div className="text-center p-4">Loading Score Trend...</div>;
    if (data.length === 0) return <div className="text-center p-4">Run an audit to see your score trend.</div>;

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">30-Day Visibility Trend</h3>
            <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="date" stroke="#6b7280" />
                    <YAxis domain={[0, 100]} stroke="#6b7280" />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="score" stroke="#8884d8" strokeWidth={2} name="Visibility Score" />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

// 2. Competitor Vitals
const CompetitorVitals = ({ userScore, competitors }) => {
    if (!competitors || competitors.length === 0) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                 <h3 className="text-lg font-semibold text-gray-900 mb-2">Competitor Vitals</h3>
                 <p className="text-gray-600 text-sm">Add a competitor in settings to see how you stack up.</p>
            </div>
        );
    }
    const topCompetitor = competitors[0]; // Assuming the first is the one to compare against for now

    // NOTE: In a real implementation, you would fetch the competitor's score.
    // Here, we'll simulate it for display purposes.
    const competitorScore = topCompetitor.last_audited_score || Math.floor(Math.random() * (85 - 65 + 1)) + 65;

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Competitor Vitals</h3>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-800">Your Score</p>
                    <p className={`font-bold text-xl ${userScore > competitorScore ? 'text-green-500' : 'text-gray-700'}`}>{userScore}</p>
                </div>
                <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-800">{topCompetitor.name || new URL(topCompetitor.url).hostname}</p>
                    <p className="font-bold text-xl text-red-500">{competitorScore}</p>
                </div>
                 <button className="text-sm text-purple-600 hover:text-purple-700 w-full text-center mt-2">
                    Run Full Analysis →
                </button>
            </div>
        </div>
    );
};

// 3. Recent Discoveries
const RecentDiscoveries = ({ onSwitchTool }) => {
    // This would be populated by real data from recent tool runs
    const discoveries = [
        { id: 1, icon: FileText, text: "New 'structured data' entity missing on your homepage.", tool: 'entity-analyzer', context: { page: '/' } },
        { id: 2, icon: Search, text: "Reddit question found matching your core service.", tool: 'citation-tracker', context: { source: 'Reddit' } },
        { id: 3, icon: Star, text: "Opportunity to add FAQ schema for 'AI SEO strategies'.", tool: 'schema-generator', context: { topic: 'AI SEO strategies' } },
    ];

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 col-span-1 md:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Discoveries</h3>
            <ul className="space-y-3">
                {discoveries.map(discovery => {
                    const Icon = discovery.icon;
                    return (
                        <li key={discovery.id} className="flex items-start space-x-3">
                             <Icon className="w-5 h-5 text-purple-500 mt-1 flex-shrink-0" />
                            <p className="text-gray-700">
                                {discovery.text}
                                <button onClick={() => onSwitchTool(discovery.tool, discovery.context)} className="ml-2 text-purple-600 hover:underline text-sm font-medium">
                                    Act now
                                </button>
                            </p>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};


const Dashboard: React.FC<DashboardProps> = ({ 
  userPlan, 
  onNavigateToLanding, 
  user, 
  onSignOut, 
  userProfile, 
  showWalkthrough, 
  onWalkthroughComplete 
}) => {
  const [showChatbot, setShowChatbot] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const [hasRunTools, setHasRunTools] = useState(true); // Default to true to show command center
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
  const [latestAuditScore, setLatestAuditScore] = useState(85); // Simulated score
  // Editor mode: 'standard' or 'realtime' with persistence
  const [editorMode, setEditorMode] = useState<'standard' | 'realtime'>(() => {
    const saved = localStorage.getItem('seogenix_editor_mode');
    return (saved === 'realtime' || saved === 'standard') ? saved : 'standard';
  });
  useEffect(() => {
    localStorage.setItem('seogenix_editor_mode', editorMode);
  }, [editorMode]);
  
  // Modal state for individual tools
  const [showToolModal, setShowToolModal] = useState(false);
  const [modalToolId, setModalToolId] = useState<string>('');
  const [modalToolName, setModalToolName] = useState<string>('');
  
  // Use refs to prevent duplicate fetches and track component mount state
  const profileFetchedRef = useRef(false);
  const isMountedRef = useRef(true);
  const activityTrackedRef = useRef(false);
  const insightsGeneratedRef = useRef(false);
  const auditHistoryFetchedRef = useRef(false);

  // *** NEW: Determine the effective plan based on the development flag ***
  const effectivePlan = isDevelopment ? 'agency' : userPlan;

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
    if (!user || !user.id || !userProfile || !userProfile.onboarding_completed_at) return;
    
    // Prevent duplicate insight generation
    if (insightsGeneratedRef.current) return;
    insightsGeneratedRef.current = true;

    try {
      const insights: ActionableInsight[] = [];

      // Get recent audit history - use cached data if available
      const auditHistory = await userDataService.getAuditHistory(user.id, 5);
      const recentActivity = await userDataService.getRecentActivity(user.id, 10);

      // 1. No websites configured
      if (
        Array.isArray(userProfile.websites) &&
        userProfile.websites.length === 0 &&
        userProfile.onboarding_completed_at
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
        setLatestAuditScore(latestAudit.overall_score); // Update the score for the new widget
        if (latestAudit.overall_score < 60) {
          insights.push({
            id: 'low-score',
            type: 'urgent',
            title: 'Critical: Low AI Visibility Score',
            description: `Your latest score is ${latestAudit.overall_score}/100. Use the Content Editor to improve immediately.`,
            action: 'Open Content Editor',
            actionUrl: 'editor',
            icon: AlertTriangle,
            color: 'from-red-500 to-red-600',
            contextualTip: 'Scores below 60 indicate significant issues with AI comprehension. Optimizing your content in the editor can quickly improve visibility and citation likelihood.',
            learnMoreLink: 'https://docs.seogenix.com/tools/content-editor'
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
      
       if (isMountedRef.current) {
        setActionableInsights(insights.slice(0, 1)); // Show only the top insight to make room
      }


    } catch (error) {
      console.error('Error generating actionable insights:', error);
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

  // FINAL FIX: This hook now correctly sets the initial website and project ID
  // as soon as the userProfile prop is available.
  useEffect(() => {
    if (userProfile && Array.isArray(userProfile.websites) && userProfile.websites.length > 0) {
      const firstWebsite = userProfile.websites[0];
      // Check if a site is already selected to prevent unnecessary re-renders
      if (firstWebsite && firstWebsite.url && firstWebsite.id && !selectedWebsite) {
          setSelectedWebsite(firstWebsite.url);
          setSelectedProjectId(firstWebsite.id);
      }
    }
  }, [userProfile, selectedWebsite]); // Depend on selectedWebsite to avoid re-running if already set

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

  const handleSwitchTool = (toolId: string, context: any) => {
    setToolContext(context);
    setActiveSection(toolId);

    // Success toast when tool opened from a workflow (e.g., Fix it / Generator)
    if (context && (context.source === 'fixit' || context.source === 'generator-open-in-editor')) {
      const toolNames: Record<string, string> = {
        editor: 'Content Editor',
        schema: 'Schema Generator',
        entities: 'Entity Analyzer',
        citations: 'Citation Tracker',
        voice: 'Voice Assistant Tester',
        prompts: 'Prompt Suggestions',
        generator: 'AI Content Generator',
        audit: 'AI Visibility Audit'
      };
      const pretty = toolNames[toolId] || 'Tool';
      addToast({
        id: `nav-${Date.now()}`,
        type: 'success',
        title: `Opened ${pretty}`,
        message: context.source === 'fixit' ? 'Jumped from a recommendation to take action.' : 'Loaded generated content into the editor.',
        duration: 3500,
        onClose: () => {}
      });
    }
  };

  // Handle tool run from ToolsGrid - this can either open modal or navigate
  const handleToolRun = (toolId?: string, toolName?: string, useModal = false) => {
    if (toolId && toolName && useModal) {
      // Open tool in modal
      setModalToolId(toolId);
      setModalToolName(toolName);
      setShowToolModal(true);
    } else {
      // Mark that tools have been run for overview section
      localStorage.setItem('seogenix_tools_run', 'true');
      setHasRunTools(true);
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
    }
  };

  const handleSettingsClick = () => setActiveSection('settings');
  const handleBillingClick = () => setActiveSection('billing');
  const triggerWalkthrough = () => { onWalkthroughComplete(); /* Logic to restart tour */ };

  if (!user || !userProfile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // --- NEW: Command Center Component ---
  const DashboardCommandCenter = () => (
    <div className="space-y-8">
        <VisibilityScore userPlan={effectivePlan} selectedWebsite={selectedWebsite} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <HistoricalSnapshot userId={user.id} selectedProjectId={selectedProjectId} />
            <CompetitorVitals userScore={latestAuditScore} competitors={userProfile.competitors} />
            <RecentDiscoveries onSwitchTool={handleSwitchTool} />
        </div>

        {actionableInsights.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
             <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Recommendation</h3>
            {actionableInsights.map((insight) => {
                const IconComponent = insight.icon;
                return (
                  <div key={insight.id} className={`p-4 rounded-lg border-l-4 ${ insight.type === 'urgent' ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50' }`}>
                    <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                            <div className={`p-2 rounded-lg bg-gradient-to-r ${insight.color}`}>
                                <IconComponent className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-900">{insight.title}</h4>
                                <p className="text-sm text-gray-600">{insight.description}</p>
                            </div>
                        </div>
                        <button onClick={() => handleInsightAction(insight)} className={`inline-flex items-center space-x-2 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${ insight.type === 'urgent' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-yellow-600 text-white hover:bg-yellow-700'}`}>
                            <span>{insight.action}</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                  </div>
                );
            })}
          </div>
        )}
         <ToolsGrid 
              userPlan={effectivePlan}
              onToolRun={handleToolRun} 
              showPreview={true}
              selectedWebsite={selectedWebsite}
              selectedProjectId={selectedProjectId}
              userProfile={userProfile}
              onToolComplete={handleToolComplete}
              onSwitchTool={handleSwitchTool}
              context={toolContext}
            />
    </div>
  );

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
                  <p className="text-gray-600">Here's your AI Visibility command center.</p>
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

            {userProfile && userProfile.websites && userProfile.websites.length > 0 && (
                <SiteSelector
                  websites={userProfile.websites}
                  competitors={userProfile.competitors || []}
                  selectedWebsite={selectedWebsite}
                  onWebsiteChange={(url) => {
                    setSelectedWebsite(url);
                    const selected = userProfile.websites.find((w: any) => w.url === url);
                    setSelectedProjectId(selected ? selected.id : '');
                  }}
                  userPlan={effectivePlan}
                />
            )}
            
            <DashboardCommandCenter />

          </div>
        );
      
      case 'playbooks':
        return <OptimizationPlaybooks 
                userPlan={effectivePlan}
                onSectionChange={setActiveSection} 
                userGoals={userGoals}
                userProfile={userProfile}
               />;
      
      case 'history':
        return <HistoricalPerformance userPlan={effectivePlan} selectedWebsite={selectedWebsite} />;
      
      case 'reports':
        return <ReportGenerator userPlan={effectivePlan} />;
      
      case 'editor': {
        // Suggest Real-time banner if the current context recommendation is about readability/clarity/structure
        const recText = String(
          toolContext?.fromRecommendation?.title || ''
        ) + ' ' + String(toolContext?.fromRecommendation?.description || '');
        const lower = recText.toLowerCase();
        const suggestRealtime = editorMode === 'standard' && (
          lower.includes('readability') || lower.includes('clarity') || lower.includes('structure') || lower.includes('optimiz')
        );

        return (
          <div className="space-y-4">
            {/* Segmented control for editor modes */}
            <div className="inline-flex rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm" role="tablist" aria-label="Editor mode selector">
              <button
                role="tab"
                aria-selected={editorMode === 'standard'}
                onClick={() => setEditorMode('standard')}
                title="Standard Editor: compose and optimize with workflows"
                className={`${editorMode === 'standard' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} px-4 py-2 text-sm font-medium border-r border-gray-200`}
              >
                Standard
              </button>
              <button
                role="tab"
                aria-selected={editorMode === 'realtime'}
                onClick={() => setEditorMode('realtime')}
                title="Real-time Editor: instant suggestions as you type"
                className={`${editorMode === 'realtime' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} px-4 py-2 text-sm font-medium`}
              >
                Real-time
              </button>
            </div>

            {/* Contextual banner suggesting Real-time mode */}
            {suggestRealtime && (
              <div className="flex items-start justify-between bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <div>
                  <div className="font-medium text-indigo-900">Try Real-time mode for readability and clarity</div>
                  <div className="text-sm text-indigo-800">See instant suggestions for structure, clarity, and keyword usage while you write.</div>
                </div>
                <button
                  onClick={() => setEditorMode('realtime')}
                  className="ml-4 px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                  title="Switch to Real-time Editor"
                >
                  Switch now
                </button>
              </div>
            )}

            {editorMode === 'standard' ? (
              <ContentEditor
                userPlan={effectivePlan}
                context={toolContext}
                onToast={addToast}
                selectedProjectId={selectedProjectId || ''}
              />
            ) : (
              <RealTimeContentEditor
                userPlan={effectivePlan}
                selectedProjectId={selectedProjectId || ''}
              />
            )}
          </div>
        );
      }
      
      case 'competitive-viz':
        return <CompetitiveVisualization userPlan={effectivePlan} />;
      
      case 'integrations':
        return <CMSIntegrations userPlan={effectivePlan} />;
      case 'schema-portfolio':
        return <SchemaPortfolio selectedProjectId={selectedProjectId || ''} />;
      case 'ai-sitemap':
        return <AISitemap selectedProjectId={selectedProjectId || ''} />;
      
      case 'settings':
        return <SettingsModal onClose={() => setActiveSection('overview')} user={user} userProfile={userProfile} onProfileUpdate={() => {}} />;

      case 'billing':
        return <BillingModal onClose={() => setActiveSection('overview')} userPlan={effectivePlan} onPlanChange={() => {}} user={user} />;

      default:
        return <ToolsGrid 
          userPlan={effectivePlan}
          onToolRun={handleToolRun} 
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
        userPlan={effectivePlan}
        onNavigateToLanding={onNavigateToLanding}
        user={user}
        onSignOut={onSignOut}
        onOpenSettings={handleSettingsClick}
      />
      
      <div className="flex flex-1 min-h-0">
        <Sidebar 
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          userPlan={effectivePlan}
          onSettingsClick={handleSettingsClick}
          onBillingClick={handleBillingClick}
          userGoals={userGoals}
        />
        
        <main className="flex-1 p-8 overflow-y-auto">
          {dashboardError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-red-800">Dashboard Error</h3>
                <p className="text-red-700">{dashboardError}</p>
            </div>
          ) : (
            renderActiveSection()
          )}
        </main>
      </div>
      
      {showWalkthrough && (
        <DashboardWalkthrough onComplete={onWalkthroughComplete} onSkip={onWalkthroughComplete} />
      )}

      {showToolModal && (
        <ToolModal
          isOpen={showToolModal}
          onClose={() => setShowToolModal(false)}
          toolId={modalToolId}
          toolName={modalToolName}
          selectedWebsite={selectedWebsite}
          selectedProjectId={selectedProjectId}
          userProfile={userProfile}
          onComplete={handleToolComplete}
          onSwitchTool={handleSwitchTool}
        />
      )}

      <button
        onClick={() => setShowChatbot(true)}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 z-40"
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {showChatbot && (
        <ChatbotPopup
          onClose={() => setShowChatbot(false)}
          type="dashboard"
          userPlan={userPlan}
          user={user}
        />
      )}

      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
};

export default Dashboard;
