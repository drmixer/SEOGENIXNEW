import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Target, Brain, MessageSquare, FileText, RefreshCw, Info, ChevronDown, ChevronUp, ExternalLink, AlertCircle } from 'lucide-react';
import { apiService, type AuditResult } from '../services/api';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';

interface VisibilityScoreProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  selectedWebsite?: string;
}

interface DetailedExplanation {
  component: string;
  score: number;
  reasoning: string;
  issues: string[];
  actions: string[];
  examples: string[];
}

interface ContentIssue {
  sentence: string;
  issues: string[];
  suggestions: string[];
  position: { start: number, end: number };
  severity: 'high' | 'medium' | 'low';
}

const VisibilityScore: React.FC<VisibilityScoreProps> = ({ userPlan, selectedWebsite }) => {
  const [auditData, setAuditData] = useState<AuditResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRunAudit, setHasRunAudit] = useState(false);
  const [weeklyChange, setWeeklyChange] = useState(0);
  const [expandedSubscore, setExpandedSubscore] = useState<string | null>(null);
  const [detailedExplanations, setDetailedExplanations] = useState<DetailedExplanation[]>([]);
  const [contentIssues, setContentIssues] = useState<ContentIssue[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);
  const auditInProgressRef = useRef(false);

  // Enable subscores for all users during development
  const isDevelopment = true; // Set to false for production
  const hasSubscores = isDevelopment || userPlan !== 'free';
  const hasDetailedInsights = isDevelopment || ['core', 'pro', 'agency'].includes(userPlan);

  // Helper function to safely extract hostname from URL
  const getHostname = (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      // Fallback: try to extract domain using regex
      const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
      return match ? match[1] : url;
    }
  };

  const runRealAudit = async () => {
    // Prevent multiple simultaneous audit runs
    if (auditInProgressRef.current) {
      console.log('Audit already in progress, skipping');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    auditInProgressRef.current = true;
    
    try {
      // Use selected website or fallback to example
      const urlToAudit = selectedWebsite || 'https://example.com';
      
      // Run real audit using Gemini API
      const result = await apiService.runAudit(urlToAudit);
      setAuditData(result);
      setHasRunAudit(true);
      localStorage.setItem('seogenix_audit_run', 'true');

      // Save audit result to history
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await userDataService.saveAuditResult({
            user_id: user.id,
            website_url: urlToAudit,
            overall_score: result.overallScore,
            ai_understanding: result.subscores.aiUnderstanding,
            citation_likelihood: result.subscores.citationLikelihood,
            conversational_readiness: result.subscores.conversationalReadiness,
            content_structure: result.subscores.contentStructure,
            recommendations: result.recommendations,
            issues: result.issues,
            audit_data: result
          });

          // Track audit activity
          await userDataService.trackActivity({
            user_id: user.id,
            activity_type: 'audit_run',
            activity_data: { 
              score: result.overallScore,
              url: urlToAudit,
              type: 'real_audit'
            }
          });
        }
      } catch (dbError) {
        console.error('Error saving audit result:', dbError);
      }

      // Clear any existing detailed data when running a new audit
      setDetailedExplanations([]);
      setContentIssues([]);
      setExpandedSubscore(null);

    } catch (err) {
      setError('Failed to run audit. Please try again.');
      console.error('Audit error:', err);
    } finally {
      setIsLoading(false);
      auditInProgressRef.current = false;
    }
  };

  // Load historical data and calculate trends
  useEffect(() => {
    const loadHistoricalData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          let auditHistory;
          
          if (selectedWebsite) {
            // Get audits for specific website
            auditHistory = await userDataService.getAuditHistoryForWebsite(user.id, selectedWebsite);
          } else {
            // Get all audits
            auditHistory = await userDataService.getAuditHistory(user.id, 10);
          }
          
          if (auditHistory.length > 0) {
            setHasRunAudit(true);
            
            // Use latest audit data
            const latest = auditHistory[0];
            setAuditData({
              overallScore: latest.overall_score,
              subscores: {
                aiUnderstanding: latest.ai_understanding,
                citationLikelihood: latest.citation_likelihood,
                conversationalReadiness: latest.conversational_readiness,
                contentStructure: latest.content_structure
              },
              recommendations: latest.recommendations,
              issues: latest.issues
            });

            // Calculate weekly change from real data
            if (auditHistory.length > 1) {
              const weekAgo = new Date();
              weekAgo.setDate(weekAgo.getDate() - 7);
              
              const weeklyAudits = auditHistory.filter(audit => 
                new Date(audit.created_at) >= weekAgo
              );
              
              if (weeklyAudits.length >= 2) {
                const oldestThisWeek = weeklyAudits[weeklyAudits.length - 1];
                const change = latest.overall_score - oldestThisWeek.overall_score;
                setWeeklyChange(change);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading historical data:', error);
      }
    };

    loadHistoricalData();

    // Also check localStorage for backward compatibility
    const auditRun = localStorage.getItem('seogenix_audit_run');
    if (auditRun && !hasRunAudit) {
      setHasRunAudit(true);
      if (hasSubscores) {
        runRealAudit();
      }
    }
  }, [selectedWebsite]);

  // Load detailed explanations when a subscore is expanded
  const loadDetailedExplanations = async (component: string) => {
    if (!hasDetailedInsights || !selectedWebsite) return;
    
    setIsLoadingDetails(true);
    
    try {
      // In a real implementation, this would call an API endpoint
      // For now, we'll simulate the data
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const explanations: DetailedExplanation[] = [
        {
          component: 'AI Understanding',
          score: auditData?.subscores.aiUnderstanding || 0,
          reasoning: "The content provides good context but lacks clear entity definitions and relationships. Some sentences are too complex for AI systems to parse effectively.",
          issues: [
            "Complex sentence structures with multiple clauses",
            "Ambiguous pronoun references",
            "Insufficient entity definitions",
            "Unclear relationships between concepts"
          ],
          actions: [
            "Simplify complex sentences into shorter, clearer statements",
            "Define key entities explicitly when first mentioned",
            "Clarify relationships between concepts with explicit statements",
            "Use more consistent terminology throughout"
          ],
          examples: [
            "Instead of 'The implementation, which was developed using the latest methodologies and frameworks, provides significant advantages', use 'The implementation provides significant advantages. It was developed using the latest methodologies and frameworks.'",
            "Define entities: 'AI visibility refers to how well AI systems can understand and cite your content.'"
          ]
        },
        {
          component: 'Citation Likelihood',
          score: auditData?.subscores.citationLikelihood || 0,
          reasoning: "The content contains some citable information but lacks clear data points, statistics, and authoritative statements that AI systems prefer to cite.",
          issues: [
            "Limited factual statements and statistics",
            "Few definitive claims or authoritative statements",
            "Insufficient evidence or sources",
            "Content not structured for easy extraction"
          ],
          actions: [
            "Add specific data points, statistics, and research findings",
            "Include clear, definitive statements about the topic",
            "Structure content with clear headings and concise paragraphs",
            "Use list formats for key points that are citation-worthy"
          ],
          examples: [
            "Add statistics: 'According to our research, AI visibility improvements lead to a 35% increase in content citations.'",
            "Make definitive statements: 'Schema markup is essential for AI understanding because it provides explicit context about content relationships.'"
          ]
        },
        {
          component: 'Conversational Readiness',
          score: auditData?.subscores.conversationalReadiness || 0,
          reasoning: "The content doesn't fully address common questions in a conversational format that voice assistants can easily extract and present.",
          issues: [
            "Limited question-answer format content",
            "Few direct responses to common queries",
            "Not optimized for voice search patterns",
            "Missing conversational transitions"
          ],
          actions: [
            "Add FAQ sections with common questions and concise answers",
            "Structure content to directly answer 'who, what, when, where, why, how' questions",
            "Use natural language patterns that match voice queries",
            "Include conversational phrases and transitions"
          ],
          examples: [
            "Add FAQs: 'Q: What is AI visibility? A: AI visibility refers to how well AI systems can understand, process, and cite your content.'",
            "Answer common questions directly: 'The best time to implement these changes is immediately after conducting an AI visibility audit.'"
          ]
        },
        {
          component: 'Content Structure',
          score: auditData?.subscores.contentStructure || 0,
          reasoning: "The content has basic structure but lacks proper semantic HTML, schema markup, and clear hierarchical organization.",
          issues: [
            "Inconsistent heading hierarchy",
            "Limited use of semantic HTML elements",
            "Missing or incomplete schema markup",
            "Poor content segmentation"
          ],
          actions: [
            "Implement proper H1-H6 heading hierarchy",
            "Add comprehensive Schema.org markup",
            "Use semantic HTML elements (article, section, nav, etc.)",
            "Organize content into clear, logical sections"
          ],
          examples: [
            "Use proper heading hierarchy: H1 for page title, H2 for main sections, H3 for subsections",
            "Add schema markup: <script type=\"application/ld+json\">{\n  \"@context\": \"https://schema.org\",\n  \"@type\": \"Article\",\n  \"headline\": \"Your Title\"\n}</script>"
          ]
        }
      ];
      
      // Filter to just the requested component or return all
      const filteredExplanations = component === 'all' 
        ? explanations 
        : explanations.filter(exp => exp.component.toLowerCase() === component.toLowerCase());
      
      setDetailedExplanations(filteredExplanations);
      
      // Also load content issues
      const issues: ContentIssue[] = [
        {
          sentence: "The implementation, which was developed using the latest methodologies and frameworks, provides significant advantages over traditional approaches that have been used in the industry for many years.",
          issues: ["Complex sentence structure", "Multiple clauses", "Difficult for AI to parse"],
          suggestions: ["Break into shorter sentences", "Simplify structure", "Be more direct"],
          position: { start: 120, end: 280 },
          severity: 'high'
        },
        {
          sentence: "It enhances user experience while simultaneously improving performance metrics.",
          issues: ["Vague claims", "Lacks specific details"],
          suggestions: ["Add specific metrics or examples", "Quantify improvements"],
          position: { start: 300, end: 370 },
          severity: 'medium'
        },
        {
          sentence: "Users can leverage this to achieve their goals.",
          issues: ["Too generic", "Lacks context"],
          suggestions: ["Specify which goals", "Add concrete examples"],
          position: { start: 400, end: 440 },
          severity: 'low'
        }
      ];
      
      setContentIssues(issues);
      
    } catch (error) {
      console.error('Error loading detailed explanations:', error);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const toggleSubscoreExpansion = (subscore: string) => {
    if (expandedSubscore === subscore) {
      setExpandedSubscore(null);
    } else {
      setExpandedSubscore(subscore);
      loadDetailedExplanations(subscore);
    }
  };

  const overallScore = auditData?.overallScore || 0;
  
  const subscores = auditData ? [
    { name: 'AI Understanding', score: auditData.subscores.aiUnderstanding, icon: Brain, color: 'text-teal-600' },
    { name: 'Citation Likelihood', score: auditData.subscores.citationLikelihood, icon: Target, color: 'text-purple-600' },
    { name: 'Conversational Readiness', score: auditData.subscores.conversationalReadiness, icon: MessageSquare, color: 'text-indigo-600' },
    { name: 'Content Structure', score: auditData.subscores.contentStructure, icon: FileText, color: 'text-blue-600' }
  ] : [];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'from-green-500 to-green-600';
    if (score >= 60) return 'from-yellow-500 to-yellow-600';
    return 'from-red-500 to-red-600';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'border-red-300 bg-red-50 text-red-800';
      case 'medium': return 'border-yellow-300 bg-yellow-50 text-yellow-800';
      case 'low': return 'border-blue-300 bg-blue-50 text-blue-800';
      default: return 'border-gray-300 bg-gray-50 text-gray-800';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Overall Score */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">AI Visibility Score</h3>
              {selectedWebsite && (
                <p className="text-xs text-gray-500 mt-1">
                  {getHostname(selectedWebsite)}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {weeklyChange !== 0 && (
                <div className={`flex items-center space-x-1 text-sm ${weeklyChange > 0 ? 'text-green-600' : weeklyChange < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                  {weeklyChange > 0 ? <TrendingUp className="w-4 h-4" /> : weeklyChange < 0 ? <TrendingDown className="w-4 h-4" /> : null}
                  <span>{weeklyChange > 0 ? '+' : ''}{weeklyChange}% this week</span>
                </div>
              )}
              {hasSubscores && (
                <button
                  onClick={runRealAudit}
                  disabled={isLoading || auditInProgressRef.current}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Run new audit"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
          </div>
          
          <div className="relative">
            <div className="w-32 h-32 mx-auto mb-4">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-gray-200"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="url(#gradient)"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${overallScore * 2.51} 251`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#33D9C1" />
                    <stop offset="100%" stopColor="#971CB5" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className={`text-3xl font-bold ${getScoreColor(overallScore)}`}>{overallScore}</div>
                  <div className="text-sm text-gray-500">out of 100</div>
                </div>
              </div>
            </div>
          </div>
          
          {!hasRunAudit ? (
            <div className="text-center">
              <p className="text-gray-600 text-sm mb-4">
                Run your first AI visibility audit to see your score
              </p>
              <button
                onClick={runRealAudit}
                disabled={isLoading || auditInProgressRef.current}
                className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50"
              >
                {isLoading ? 'Running Audit...' : 'Run First Audit'}
              </button>
            </div>
          ) : (
            <p className="text-center text-gray-600 text-sm">
              {auditData ? 
                'Real-time audit results from AI analysis' : 
                'Click refresh to run a new audit'
              }
            </p>
          )}
          
          {error && (
            <p className="text-center text-red-500 text-sm mt-2">{error}</p>
          )}
        </div>
      </div>
      
      {/* Subscores */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">
            AI Visibility Breakdown
            {!hasSubscores && !isDevelopment && (
              <span className="text-sm text-gray-500 ml-2">(Upgrade to Core for detailed breakdown)</span>
            )}
          </h3>
          
          {hasSubscores && auditData ? (
            <div className="space-y-6">
              {subscores.map((subscore, index) => {
                const IconComponent = subscore.icon;
                const isExpanded = expandedSubscore === subscore.name;
                
                return (
                  <div key={index} className="space-y-3">
                    <div 
                      className={`p-4 rounded-lg border transition-all duration-300 ${
                        isExpanded ? 'border-purple-300 bg-purple-50' : 'border-gray-200 hover:border-purple-300'
                      } cursor-pointer`}
                      onClick={() => toggleSubscoreExpansion(subscore.name)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <IconComponent className={`w-5 h-5 ${subscore.color}`} />
                          <span className="font-medium text-gray-900">{subscore.name}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`font-bold ${getScoreColor(subscore.score)}`}>
                            {subscore.score}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-500" />
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div 
                          className={`h-2 rounded-full bg-gradient-to-r ${getScoreBg(subscore.score)} transition-all duration-1000`}
                          style={{ width: `${subscore.score}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="bg-white rounded-lg border border-purple-200 p-4 ml-4 space-y-4">
                        {isLoadingDetails ? (
                          <div className="flex justify-center items-center py-4">
                            <RefreshCw className="w-6 h-6 text-purple-600 animate-spin" />
                          </div>
                        ) : (
                          detailedExplanations.filter(exp => exp.component === subscore.name).map((explanation, i) => (
                            <div key={i} className="space-y-4">
                              <div className="p-3 bg-purple-50 rounded-lg">
                                <h4 className="font-medium text-purple-900 mb-1">Analysis</h4>
                                <p className="text-sm text-purple-800">{explanation.reasoning}</p>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <h4 className="font-medium text-gray-900 mb-2">Key Issues</h4>
                                  <ul className="space-y-1">
                                    {explanation.issues.map((issue, j) => (
                                      <li key={j} className="text-sm text-gray-700 flex items-start space-x-2">
                                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                        <span>{issue}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                
                                <div>
                                  <h4 className="font-medium text-gray-900 mb-2">Recommended Actions</h4>
                                  <ul className="space-y-1">
                                    {explanation.actions.map((action, j) => (
                                      <li key={j} className="text-sm text-gray-700 flex items-start space-x-2">
                                        <ArrowRight className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                        <span>{action}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                              
                              {explanation.examples.length > 0 && (
                                <div>
                                  <h4 className="font-medium text-gray-900 mb-2">Examples</h4>
                                  <div className="space-y-2">
                                    {explanation.examples.map((example, j) => (
                                      <div key={j} className="text-sm text-gray-700 p-2 bg-gray-50 rounded border border-gray-200">
                                        {example}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {contentIssues.length > 0 && subscore.name === 'AI Understanding' && (
                                <div>
                                  <h4 className="font-medium text-gray-900 mb-2">Content Issues</h4>
                                  <div className="space-y-3 max-h-60 overflow-y-auto">
                                    {contentIssues.map((issue, j) => (
                                      <div 
                                        key={j} 
                                        className={`p-3 rounded-lg border ${getSeverityColor(issue.severity)}`}
                                      >
                                        <p className="text-sm font-medium mb-1">{issue.sentence}</p>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                          {issue.issues.map((issueText, k) => (
                                            <span key={k} className="text-xs px-2 py-0.5 bg-white bg-opacity-50 rounded">
                                              {issueText}
                                            </span>
                                          ))}
                                        </div>
                                        <div className="text-xs">
                                          <strong>Suggestions:</strong> {issue.suggestions.join('; ')}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex justify-end">
                                <button className="text-sm text-purple-600 hover:text-purple-800 flex items-center space-x-1">
                                  <span>View detailed report</span>
                                  <ExternalLink className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                        
                        {!isLoadingDetails && detailedExplanations.length === 0 && (
                          <div className="text-center py-4">
                            <Info className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-600">Detailed analysis not available</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : hasSubscores && !auditData ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-4">
                <Target className="w-12 h-12 mx-auto" />
              </div>
              <p className="text-gray-600 mb-4">Run an audit to see detailed breakdown</p>
              <button
                onClick={runRealAudit}
                disabled={isLoading || auditInProgressRef.current}
                className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50"
              >
                {isLoading ? 'Running Audit...' : 'Run Audit'}
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="text-gray-400 mb-2">
                  <Target className="w-12 h-12 mx-auto" />
                </div>
                <p className="text-gray-600 mb-4">Detailed breakdown available with Core plan and above</p>
                <button className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:shadow-lg transition-all duration-300">
                  Upgrade to Core
                </button>
              </div>
            </div>
          )}
          
          {auditData && hasSubscores && auditData.recommendations && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-blue-900">Key Recommendations:</h4>
                <button 
                  onClick={() => setShowAllRecommendations(!showAllRecommendations)}
                  className="text-xs text-blue-700 flex items-center"
                >
                  {showAllRecommendations ? (
                    <>
                      <span>Show less</span>
                      <ChevronUp className="w-3 h-3 ml-1" />
                    </>
                  ) : (
                    <>
                      <span>Show all</span>
                      <ChevronDown className="w-3 h-3 ml-1" />
                    </>
                  )}
                </button>
              </div>
              <ul className="text-sm text-blue-800 space-y-1">
                {auditData.recommendations.slice(0, showAllRecommendations ? undefined : 3).map((rec, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <ArrowRight className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
              
              {hasDetailedInsights && (
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <button
                    onClick={() => {
                      setExpandedSubscore(expandedSubscore ? null : 'AI Understanding');
                      if (!expandedSubscore) {
                        loadDetailedExplanations('AI Understanding');
                      }
                    }}
                    className="text-sm text-blue-700 flex items-center space-x-1 hover:text-blue-900 transition-colors"
                  >
                    <Info className="w-4 h-4" />
                    <span>{expandedSubscore ? 'Hide detailed analysis' : 'View detailed analysis'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisibilityScore;