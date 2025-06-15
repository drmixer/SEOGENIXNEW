import React, { useState, useEffect } from 'react';
import { BookOpen, Target, TrendingUp, Users, Zap, CheckCircle, ArrowRight, Clock, Star, RefreshCw, AlertTriangle, Brain, FileText, Lightbulb, MessageSquare, Mic } from 'lucide-react';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';

interface PlaybookStep {
  id: string;
  title: string;
  description: string;
  action: string;
  toolId?: string;
  estimatedTime: string;
  priority: number;
  dependsOn?: string[];
}

interface Playbook {
  id: string;
  title: string;
  description: string;
  goal: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  category: string;
  icon: React.ComponentType<any>;
  color: string;
  steps: PlaybookStep[];
  benefits: string[];
  recommendedFor?: string[];
  matchScore?: number;
  goalAlignment?: string[];
}

interface OptimizationPlaybooksProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  onSectionChange: (section: string) => void;
  userGoals?: string[];
  userProfile?: any;
}

const OptimizationPlaybooks: React.FC<OptimizationPlaybooksProps> = ({ 
  userPlan, 
  onSectionChange,
  userGoals = [],
  userProfile
}) => {
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(false);
  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const [recommendedPlaybook, setRecommendedPlaybook] = useState<string | null>(null);
  const [generatingPlaybook, setGeneratingPlaybook] = useState(false);
  const [customPlaybookGoal, setCustomPlaybookGoal] = useState<string>('');
  const [showCustomPlaybookForm, setShowCustomPlaybookForm] = useState(false);
  const [customFocusArea, setCustomFocusArea] = useState<string>('overall');

  // Load user data and playbooks
  useEffect(() => {
    const loadUserData = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Load audit history
          const history = await userDataService.getAuditHistory(user.id, 10);
          setAuditHistory(history);
          
          // Generate playbook recommendations based on user data
          if (history.length > 0) {
            const latestAudit = history[0];
            
            // Find the lowest subscore
            const subscores = {
              ai_understanding: latestAudit.ai_understanding,
              citation_likelihood: latestAudit.citation_likelihood,
              conversational_readiness: latestAudit.conversational_readiness,
              content_structure: latestAudit.content_structure
            };
            
            const lowestSubscore = Object.entries(subscores).reduce(
              (min, [key, value]) => value < min.value ? { key, value } : min,
              { key: 'overall', value: 100 }
            );
            
            // Recommend playbook based on lowest subscore
            if (lowestSubscore.key === 'ai_understanding' || lowestSubscore.key === 'content_structure') {
              setRecommendedPlaybook('ai-visibility-foundation');
            } else if (lowestSubscore.key === 'citation_likelihood') {
              setRecommendedPlaybook('content-optimization-mastery');
            } else if (lowestSubscore.key === 'conversational_readiness') {
              setRecommendedPlaybook('voice-search-optimization');
            }
          }
          
          // Alternatively, recommend based on user goals
          else if (userGoals.length > 0) {
            if (userGoals.includes('increase_citations')) {
              setRecommendedPlaybook('content-optimization-mastery');
            } else if (userGoals.includes('voice_search')) {
              setRecommendedPlaybook('voice-search-optimization');
            } else if (userGoals.includes('competitive_edge')) {
              setRecommendedPlaybook('competitive-intelligence');
            } else {
              setRecommendedPlaybook('ai-visibility-foundation');
            }
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadUserData();
    loadPlaybooks();
  }, [userGoals]);

  const loadPlaybooks = () => {
    const defaultPlaybooks: Playbook[] = [
      {
        id: 'ai-visibility-foundation',
        title: 'AI Visibility Foundation',
        description: 'Build a strong foundation for AI visibility with essential optimizations',
        goal: 'Achieve a baseline AI visibility score of 70+ and establish monitoring',
        difficulty: 'beginner',
        estimatedTime: '2-3 hours',
        category: 'Getting Started',
        icon: Target,
        color: 'from-blue-500 to-blue-600',
        goalAlignment: ['improve_understanding', 'content_structure'],
        steps: [
          {
            id: 'foundation-1',
            title: 'Run Initial AI Visibility Audit',
            description: 'Get your baseline scores and identify key areas for improvement',
            action: 'Run comprehensive audit to understand current AI visibility performance',
            toolId: 'audit',
            estimatedTime: '10 minutes',
            priority: 1
          },
          {
            id: 'foundation-2',
            title: 'Generate Schema Markup',
            description: 'Add structured data to help AI systems understand your content',
            action: 'Create and implement Schema.org markup for your main pages',
            toolId: 'schema',
            estimatedTime: '30 minutes',
            priority: 2
          },
          {
            id: 'foundation-3',
            title: 'Optimize Core Content',
            description: 'Improve your most important pages for AI comprehension',
            action: 'Use content optimizer on your homepage and key landing pages',
            toolId: 'optimizer',
            estimatedTime: '45 minutes',
            priority: 3
          },
          {
            id: 'foundation-4',
            title: 'Set Up Citation Tracking',
            description: 'Monitor when AI systems mention your content',
            action: 'Configure citation tracking for your domain and key topics',
            toolId: 'citations',
            estimatedTime: '15 minutes',
            priority: 4
          },
          {
            id: 'foundation-5',
            title: 'Test Voice Assistant Responses',
            description: 'See how voice assistants respond to queries about your business',
            action: 'Test common questions users might ask about your services',
            toolId: 'voice',
            estimatedTime: '20 minutes',
            priority: 5
          }
        ],
        benefits: [
          'Establish baseline AI visibility metrics',
          'Implement essential technical optimizations',
          'Begin monitoring AI mentions and citations',
          'Improve content structure for AI understanding',
          'Set foundation for advanced optimizations'
        ],
        recommendedFor: [
          'New users getting started with AI visibility',
          'Websites with scores below 60',
          'Sites with little or no schema markup',
          'Content that needs basic optimization'
        ],
        matchScore: 95
      },
      {
        id: 'content-optimization-mastery',
        title: 'Content Optimization Mastery',
        description: 'Master content creation and optimization for maximum AI visibility',
        goal: 'Create AI-optimized content that consistently gets cited by AI systems',
        difficulty: 'intermediate',
        estimatedTime: '4-5 hours',
        category: 'Content Strategy',
        icon: Zap,
        color: 'from-yellow-500 to-yellow-600',
        goalAlignment: ['increase_citations', 'improve_understanding'],
        steps: [
          {
            id: 'content-1',
            title: 'Analyze Entity Coverage',
            description: 'Identify missing entities that should be mentioned in your content',
            action: 'Run entity analysis to find gaps in your content coverage',
            toolId: 'entities',
            estimatedTime: '20 minutes',
            priority: 1
          },
          {
            id: 'content-2',
            title: 'Generate AI-Optimized FAQs',
            description: 'Create comprehensive FAQ content optimized for AI systems',
            action: 'Generate FAQ content that answers common user questions',
            toolId: 'generator',
            estimatedTime: '45 minutes',
            priority: 2
          },
          {
            id: 'content-3',
            title: 'Create LLM Site Summaries',
            description: 'Generate summaries that help AI systems understand your site',
            action: 'Create different types of summaries for various AI use cases',
            toolId: 'summaries',
            estimatedTime: '30 minutes',
            priority: 3
          },
          {
            id: 'content-4',
            title: 'Optimize for Prompt Matching',
            description: 'Align your content with how users ask AI systems questions',
            action: 'Generate and implement prompt-matched content strategies',
            toolId: 'prompts',
            estimatedTime: '60 minutes',
            priority: 4
          },
          {
            id: 'content-5',
            title: 'Implement Content Optimization',
            description: 'Apply AI-powered optimizations to existing content',
            action: 'Systematically optimize your key pages using AI recommendations',
            toolId: 'optimizer',
            estimatedTime: '90 minutes',
            priority: 5
          }
        ],
        benefits: [
          'Create content that AI systems prefer to cite',
          'Improve entity coverage and topical authority',
          'Optimize for natural language queries',
          'Increase likelihood of AI mentions',
          'Build comprehensive content strategy'
        ],
        recommendedFor: [
          'Sites with citation scores below 70',
          'Content-heavy websites needing optimization',
          'Businesses wanting to improve AI citations',
          'Sites with good technical foundation but poor content structure'
        ],
        matchScore: 85
      },
      {
        id: 'competitive-intelligence',
        title: 'Competitive Intelligence & Benchmarking',
        description: 'Gain competitive advantage through AI visibility intelligence',
        goal: 'Outperform competitors in AI visibility and discover new opportunities',
        difficulty: 'advanced',
        estimatedTime: '3-4 hours',
        category: 'Competitive Strategy',
        icon: Users,
        color: 'from-purple-500 to-purple-600',
        goalAlignment: ['competitive_edge'],
        steps: [
          {
            id: 'competitive-1',
            title: 'Discover Hidden Competitors',
            description: 'Find competitors you might not be aware of using AI analysis',
            action: 'Use AI-powered competitor discovery to expand your competitive landscape',
            toolId: 'discovery',
            estimatedTime: '30 minutes',
            priority: 1
          },
          {
            id: 'competitive-2',
            title: 'Run Competitive Analysis',
            description: 'Compare your AI visibility against key competitors',
            action: 'Analyze competitor AI visibility scores and strategies',
            toolId: 'competitive',
            estimatedTime: '45 minutes',
            priority: 2
          },
          {
            id: 'competitive-3',
            title: 'Identify Content Gaps',
            description: 'Find entity and content gaps compared to competitors',
            action: 'Analyze what entities and topics competitors cover that you don\'t',
            toolId: 'entities',
            estimatedTime: '40 minutes',
            priority: 3
          },
          {
            id: 'competitive-4',
            title: 'Monitor Competitor Citations',
            description: 'Track when competitors get mentioned by AI systems',
            action: 'Set up citation tracking for competitor domains and topics',
            toolId: 'citations',
            estimatedTime: '25 minutes',
            priority: 4
          },
          {
            id: 'competitive-5',
            title: 'Develop Differentiation Strategy',
            description: 'Create content that differentiates you from competitors',
            action: 'Generate unique content based on competitive intelligence',
            toolId: 'generator',
            estimatedTime: '60 minutes',
            priority: 5
          }
        ],
        benefits: [
          'Identify and outperform competitors',
          'Discover new market opportunities',
          'Build competitive content strategies',
          'Monitor competitive AI visibility',
          'Establish market leadership'
        ],
        recommendedFor: [
          'Businesses in competitive industries',
          'Sites with good baseline scores wanting to improve further',
          'Companies concerned about competitor performance',
          'Marketers needing competitive intelligence'
        ],
        matchScore: 75
      },
      {
        id: 'voice-search-optimization',
        title: 'Voice Search Optimization',
        description: 'Optimize your content for voice assistants and conversational AI',
        goal: 'Become the preferred source for voice assistant responses in your niche',
        difficulty: 'intermediate',
        estimatedTime: '2-3 hours',
        category: 'Voice & Conversational',
        icon: Mic,
        color: 'from-green-500 to-green-600',
        goalAlignment: ['voice_search', 'conversational_readiness'],
        steps: [
          {
            id: 'voice-1',
            title: 'Test Current Voice Performance',
            description: 'See how voice assistants currently respond to queries about your business',
            action: 'Test various voice queries related to your business and industry',
            toolId: 'voice',
            estimatedTime: '30 minutes',
            priority: 1
          },
          {
            id: 'voice-2',
            title: 'Generate Conversational Content',
            description: 'Create content optimized for natural language queries',
            action: 'Generate FAQ and conversational content for voice search',
            toolId: 'generator',
            estimatedTime: '45 minutes',
            priority: 2
          },
          {
            id: 'voice-3',
            title: 'Optimize for Question Prompts',
            description: 'Align content with how people ask voice assistants questions',
            action: 'Create content that matches natural voice query patterns',
            toolId: 'prompts',
            estimatedTime: '40 minutes',
            priority: 3
          },
          {
            id: 'voice-4',
            title: 'Implement Conversational Schema',
            description: 'Add structured data optimized for voice responses',
            action: 'Generate and implement FAQ and Q&A schema markup',
            toolId: 'schema',
            estimatedTime: '35 minutes',
            priority: 4
          },
          {
            id: 'voice-5',
            title: 'Monitor Voice Citations',
            description: 'Track when voice assistants cite your content',
            action: 'Set up specialized tracking for voice assistant mentions',
            toolId: 'citations',
            estimatedTime: '20 minutes',
            priority: 5
          }
        ],
        benefits: [
          'Increase voice search visibility',
          'Optimize for conversational queries',
          'Improve natural language understanding',
          'Capture voice commerce opportunities',
          'Build authority in voice responses'
        ],
        recommendedFor: [
          'Local businesses targeting voice searches',
          'Sites with low conversational readiness scores',
          'Businesses targeting mobile and smart speaker users',
          'Content publishers wanting voice assistant citations'
        ],
        matchScore: 80
      },
      {
        id: 'citation-boost',
        title: 'Citation Boost Strategy',
        description: 'Dramatically increase how often AI systems cite your content',
        goal: 'Double your citation rate and become a preferred source for AI systems',
        difficulty: 'intermediate',
        estimatedTime: '3-4 hours',
        category: 'Citation Optimization',
        icon: MessageSquare,
        color: 'from-indigo-500 to-indigo-600',
        goalAlignment: ['increase_citations'],
        steps: [
          {
            id: 'citation-1',
            title: 'Analyze Current Citations',
            description: 'Understand your current citation patterns and opportunities',
            action: 'Set up citation tracking and analyze existing mentions',
            toolId: 'citations',
            estimatedTime: '30 minutes',
            priority: 1
          },
          {
            id: 'citation-2',
            title: 'Create Highly Citable Content',
            description: 'Generate content specifically designed for AI citation',
            action: 'Use AI Content Generator to create citation-optimized content',
            toolId: 'generator',
            estimatedTime: '60 minutes',
            priority: 2
          },
          {
            id: 'citation-3',
            title: 'Implement Fact-Based Structures',
            description: 'Reorganize content to highlight factual, citable information',
            action: 'Use Content Editor to restructure existing content',
            toolId: 'editor',
            estimatedTime: '45 minutes',
            priority: 3
          },
          {
            id: 'citation-4',
            title: 'Add Citation Fingerprints',
            description: 'Include unique identifiable phrases that help track citations',
            action: 'Create and implement fingerprint phrases in your content',
            toolId: 'citations',
            estimatedTime: '30 minutes',
            priority: 4
          },
          {
            id: 'citation-5',
            title: 'Monitor and Refine Strategy',
            description: 'Track citation improvements and adjust your approach',
            action: 'Set up regular citation monitoring and optimization',
            toolId: 'history',
            estimatedTime: '30 minutes',
            priority: 5
          }
        ],
        benefits: [
          'Dramatically increase AI citations of your content',
          'Become a preferred source for AI systems',
          'Improve brand visibility in AI-generated answers',
          'Track and measure citation improvements',
          'Establish content authority in your niche'
        ],
        recommendedFor: [
          'Content publishers seeking more AI visibility',
          'Businesses with citation scores below 75',
          'Thought leaders wanting to increase influence',
          'Sites competing for visibility in AI responses'
        ],
        matchScore: 90
      }
    ];
    
    // Sort playbooks by goal alignment
    if (userGoals.length > 0) {
      defaultPlaybooks.sort((a, b) => {
        const aAlignment = a.goalAlignment ? a.goalAlignment.filter(g => userGoals.includes(g)).length : 0;
        const bAlignment = b.goalAlignment ? b.goalAlignment.filter(g => userGoals.includes(g)).length : 0;
        return bAlignment - aAlignment;
      });
    }
    
    setPlaybooks(defaultPlaybooks);
  };

  const generateCustomPlaybook = async () => {
    setGeneratingPlaybook(true);
    
    try {
      // In a real implementation, this would call the adaptive-playbook-generator edge function
      // For now, we'll simulate the response
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Create a custom playbook based on the goal and focus area
      const customPlaybook: Playbook = {
        id: `custom-${Date.now()}`,
        title: `Custom ${customFocusArea.charAt(0).toUpperCase() + customFocusArea.slice(1)} Optimization`,
        description: customPlaybookGoal || 'Personalized optimization playbook based on your specific goals',
        goal: customPlaybookGoal || `Improve your ${customFocusArea} performance significantly`,
        difficulty: 'intermediate',
        estimatedTime: '3-4 hours',
        category: 'Custom Strategy',
        icon: Brain,
        color: 'from-indigo-500 to-indigo-600',
        steps: generateCustomSteps(customFocusArea),
        benefits: [
          `Targeted improvement in ${customFocusArea} performance`,
          'Personalized optimization strategy',
          'Address your specific content challenges',
          'Focus on your highest-impact opportunities',
          'Tailored to your industry and audience'
        ],
        recommendedFor: [
          'Your specific website and content needs',
          `Sites needing ${customFocusArea} improvements`,
          'Businesses with unique optimization requirements',
          'Content teams with specific performance goals'
        ],
        matchScore: 100
      };
      
      // Add the custom playbook to the list and select it
      setPlaybooks(prev => [customPlaybook, ...prev]);
      setSelectedPlaybook(customPlaybook);
      setShowCustomPlaybookForm(false);
      
    } catch (error) {
      console.error('Error generating custom playbook:', error);
    } finally {
      setGeneratingPlaybook(false);
    }
  };

  const generateCustomSteps = (focusArea: string): PlaybookStep[] => {
    // Base steps that are common to all focus areas
    const baseSteps: PlaybookStep[] = [
      {
        id: `custom-audit-${Date.now()}`,
        title: 'Run Comprehensive Audit',
        description: 'Get detailed analysis of your current performance',
        action: 'Run an AI visibility audit focused on your specific goals',
        toolId: 'audit',
        estimatedTime: '10 minutes',
        priority: 1
      }
    ];
    
    // Focus area specific steps
    let specificSteps: PlaybookStep[] = [];
    
    switch (focusArea) {
      case 'overall':
        specificSteps = [
          {
            id: `custom-schema-${Date.now()}`,
            title: 'Implement Schema Markup',
            description: 'Add structured data to improve AI understanding',
            action: 'Generate and implement schema markup for key pages',
            toolId: 'schema',
            estimatedTime: '30 minutes',
            priority: 2
          },
          {
            id: `custom-content-${Date.now()}`,
            title: 'Optimize High-Value Content',
            description: 'Improve your most important pages for AI visibility',
            action: 'Use the content optimizer on your key pages',
            toolId: 'optimizer',
            estimatedTime: '45 minutes',
            priority: 3
          },
          {
            id: `custom-entities-${Date.now()}`,
            title: 'Enhance Entity Coverage',
            description: 'Add missing entities to improve topical comprehensiveness',
            action: 'Run entity analysis and add missing entities to your content',
            toolId: 'entities',
            estimatedTime: '40 minutes',
            priority: 4
          },
          {
            id: `custom-monitor-${Date.now()}`,
            title: 'Set Up Monitoring',
            description: 'Track your AI visibility performance over time',
            action: 'Configure citation tracking and schedule regular audits',
            toolId: 'citations',
            estimatedTime: '20 minutes',
            priority: 5
          }
        ];
        break;
        
      case 'ai_understanding':
        specificSteps = [
          {
            id: `custom-entities-${Date.now()}`,
            title: 'Comprehensive Entity Analysis',
            description: 'Identify and add missing entities in your content',
            action: 'Run entity coverage analyzer and implement recommendations',
            toolId: 'entities',
            estimatedTime: '40 minutes',
            priority: 2
          },
          {
            id: `custom-structure-${Date.now()}`,
            title: 'Improve Content Structure',
            description: 'Enhance how your content is organized for AI comprehension',
            action: 'Reorganize content with clear sections and headings',
            toolId: 'optimizer',
            estimatedTime: '60 minutes',
            priority: 3
          },
          {
            id: `custom-definitions-${Date.now()}`,
            title: 'Add Clear Definitions',
            description: 'Ensure key concepts are explicitly defined',
            action: 'Add definitions for important terms and concepts',
            toolId: 'editor',
            estimatedTime: '45 minutes',
            priority: 4
          },
          {
            id: `custom-summaries-${Date.now()}`,
            title: 'Create AI-Friendly Summaries',
            description: 'Add summaries that help AI systems understand your content',
            action: 'Generate and implement LLM site summaries',
            toolId: 'summaries',
            estimatedTime: '30 minutes',
            priority: 5
          }
        ];
        break;
        
      case 'citation_likelihood':
        specificSteps = [
          {
            id: `custom-citations-${Date.now()}`,
            title: 'Set Up Citation Tracking',
            description: 'Monitor when AI systems mention your content',
            action: 'Configure citation tracking for your domain and key topics',
            toolId: 'citations',
            estimatedTime: '20 minutes',
            priority: 2
          },
          {
            id: `custom-citable-${Date.now()}`,
            title: 'Create Highly Citable Content',
            description: 'Generate content specifically designed for AI citation',
            action: 'Use the AI content generator to create citable content',
            toolId: 'generator',
            estimatedTime: '60 minutes',
            priority: 3
          },
          {
            id: `custom-facts-${Date.now()}`,
            title: 'Add Factual Statements',
            description: 'Include clear, factual statements that AI systems prefer to cite',
            action: 'Enhance content with statistics, data points, and definitive statements',
            toolId: 'editor',
            estimatedTime: '45 minutes',
            priority: 4
          },
          {
            id: `custom-competitive-${Date.now()}`,
            title: 'Analyze Competitor Citations',
            description: 'See what competitor content gets cited and why',
            action: 'Run competitive analysis focused on citation patterns',
            toolId: 'competitive',
            estimatedTime: '40 minutes',
            priority: 5
          }
        ];
        break;
        
      case 'conversational_readiness':
        specificSteps = [
          {
            id: `custom-voice-${Date.now()}`,
            title: 'Test Voice Assistant Responses',
            description: 'See how voice assistants respond to queries about your business',
            action: 'Run voice assistant tests with common questions',
            toolId: 'voice',
            estimatedTime: '30 minutes',
            priority: 2
          },
          {
            id: `custom-faq-${Date.now()}`,
            title: 'Create Conversational FAQs',
            description: 'Add FAQ content that matches how people ask questions',
            action: 'Generate and implement conversational FAQ content',
            toolId: 'generator',
            estimatedTime: '45 minutes',
            priority: 3
          },
          {
            id: `custom-prompts-${Date.now()}`,
            title: 'Optimize for Question Patterns',
            description: 'Align content with common question formats',
            action: 'Use prompt match suggestions to optimize for questions',
            toolId: 'prompts',
            estimatedTime: '40 minutes',
            priority: 4
          },
          {
            id: `custom-schema-${Date.now()}`,
            title: 'Implement FAQ Schema',
            description: 'Add structured data for question-answer content',
            action: 'Generate and implement FAQ schema markup',
            toolId: 'schema',
            estimatedTime: '30 minutes',
            priority: 5
          }
        ];
        break;
        
      case 'content_structure':
        specificSteps = [
          {
            id: `custom-schema-${Date.now()}`,
            title: 'Implement Comprehensive Schema',
            description: 'Add detailed structured data to your content',
            action: 'Generate and implement schema markup for all key pages',
            toolId: 'schema',
            estimatedTime: '45 minutes',
            priority: 2
          },
          {
            id: `custom-headings-${Date.now()}`,
            title: 'Optimize Heading Structure',
            description: 'Improve your heading hierarchy for better AI understanding',
            action: 'Reorganize content with proper H1-H6 structure',
            toolId: 'editor',
            estimatedTime: '60 minutes',
            priority: 3
          },
          {
            id: `custom-semantic-${Date.now()}`,
            title: 'Enhance Semantic Structure',
            description: 'Improve the semantic organization of your content',
            action: 'Implement semantic HTML and content organization',
            toolId: 'optimizer',
            estimatedTime: '50 minutes',
            priority: 4
          },
          {
            id: `custom-lists-${Date.now()}`,
            title: 'Add Structured Content Elements',
            description: 'Implement lists, tables, and other structured elements',
            action: 'Add structured content formats that AI systems can easily parse',
            toolId: 'editor',
            estimatedTime: '40 minutes',
            priority: 5
          }
        ];
        break;
    }
    
    // Add verification step at the end
    const verificationStep: PlaybookStep = {
      id: `custom-verify-${Date.now()}`,
      title: 'Verify Improvements',
      description: 'Run a follow-up audit to measure your progress',
      action: 'Run a new audit to see how your changes have improved your scores',
      toolId: 'audit',
      estimatedTime: '10 minutes',
      priority: 10,
      dependsOn: [...baseSteps, ...specificSteps].map(step => step.id)
    };
    
    return [...baseSteps, ...specificSteps, verificationStep];
  };

  const handleStepAction = async (step: PlaybookStep) => {
    if (step.toolId) {
      onSectionChange(step.toolId);
    }
    
    // Mark step as completed
    setCompletedSteps(prev => new Set([...prev, step.id]));
    
    // Track activity
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await userDataService.trackActivity({
          user_id: user.id,
          activity_type: 'playbook_step_completed',
          activity_data: { 
            playbookId: selectedPlaybook?.id,
            stepId: step.id,
            stepTitle: step.title
          }
        });
      }
    } catch (error) {
      console.error('Error tracking playbook step completion:', error);
    }
  };

  const getPlaybookProgress = (playbook: Playbook) => {
    const completedCount = playbook.steps.filter(step => completedSteps.has(step.id)).length;
    return Math.round((completedCount / playbook.steps.length) * 100);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRecommendationBadge = (playbookId: string) => {
    if (recommendedPlaybook === playbookId) {
      return (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <div className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
            <Lightbulb className="w-3 h-3" />
            <span>Recommended for You</span>
          </div>
        </div>
      );
    }
    
    // Check if this playbook aligns with user goals
    if (userGoals.length > 0) {
      const playbook = playbooks.find(p => p.id === playbookId);
      if (playbook?.goalAlignment) {
        const alignedGoals = playbook.goalAlignment.filter(g => userGoals.includes(g));
        if (alignedGoals.length > 0) {
          return (
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <div className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
                <Target className="w-3 h-3" />
                <span>Matches Your Goals</span>
              </div>
            </div>
          );
        }
      }
    }
    
    return null;
  };

  if (selectedPlaybook) {
    const progress = getPlaybookProgress(selectedPlaybook);
    const IconComponent = selectedPlaybook.icon;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedPlaybook(null)}
            className="text-purple-600 hover:text-purple-700 flex items-center space-x-2"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            <span>Back to Playbooks</span>
          </button>
          <div className="flex items-center space-x-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(selectedPlaybook.difficulty)}`}>
              {selectedPlaybook.difficulty.charAt(0).toUpperCase() + selectedPlaybook.difficulty.slice(1)}
            </span>
            <span className="text-sm text-gray-500">{progress}% Complete</span>
          </div>
        </div>

        {/* Playbook Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-start space-x-4">
            <div className={`p-4 rounded-xl bg-gradient-to-r ${selectedPlaybook.color}`}>
              <IconComponent className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{selectedPlaybook.title}</h1>
              <p className="text-gray-600 mb-4">{selectedPlaybook.description}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="flex items-center space-x-2">
                  <Target className="w-4 h-4 text-purple-600" />
                  <span className="text-sm text-gray-700">Goal: {selectedPlaybook.goal}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-purple-600" />
                  <span className="text-sm text-gray-700">Time: {selectedPlaybook.estimatedTime}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Star className="w-4 h-4 text-purple-600" />
                  <span className="text-sm text-gray-700">Category: {selectedPlaybook.category}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full bg-gradient-to-r ${selectedPlaybook.color} transition-all duration-500`}
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">What You'll Achieve</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {selectedPlaybook.benefits.map((benefit, index) => (
              <div key={index} className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-sm text-gray-700">{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Step-by-Step Guide</h3>
          
          <div className="space-y-4">
            {selectedPlaybook.steps.map((step, index) => {
              const isCompleted = completedSteps.has(step.id);
              const isDisabled = step.dependsOn?.some(depId => !completedSteps.has(depId)) || false;
              
              return (
                <div 
                  key={step.id}
                  className={`p-4 rounded-lg border-2 transition-all duration-300 ${
                    isCompleted 
                      ? 'border-green-200 bg-green-50' 
                      : isDisabled
                        ? 'border-gray-200 bg-gray-50 opacity-70'
                        : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        isCompleted 
                          ? 'bg-green-500 text-white' 
                          : 'bg-gray-200 text-gray-700'
                      }`}>
                        {isCompleted ? <CheckCircle className="w-4 h-4" /> : index + 1}
                      </div>
                      
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-1">{step.title}</h4>
                        <p className="text-sm text-gray-600 mb-2">{step.description}</p>
                        <p className="text-xs text-gray-500 mb-3">{step.action}</p>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{step.estimatedTime}</span>
                          </span>
                          
                          <button
                            onClick={() => handleStepAction(step)}
                            disabled={isCompleted || isDisabled}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                              isCompleted
                                ? 'bg-green-100 text-green-700 cursor-not-allowed'
                                : isDisabled
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-purple-600 text-white hover:bg-purple-700'
                            }`}
                          >
                            {isCompleted ? 'Completed' : isDisabled ? 'Locked' : step.toolId ? 'Launch Tool' : 'Mark Complete'}
                          </button>
                        </div>
                        
                        {isDisabled && step.dependsOn && (
                          <p className="text-xs text-yellow-600 mt-2">
                            <AlertTriangle className="w-3 h-3 inline mr-1" />
                            Complete previous steps first to unlock
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Optimization Playbooks</h2>
          <p className="text-gray-600 mt-1">Structured guides to achieve specific AI visibility goals</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-sm text-gray-500">
            {playbooks.filter(p => canUsePlaybook(p.id, userPlan)).length} playbook{playbooks.filter(p => canUsePlaybook(p.id, userPlan)).length !== 1 ? 's' : ''} available
          </div>
          
          {['core', 'pro', 'agency'].includes(userPlan) && (
            <button
              onClick={() => setShowCustomPlaybookForm(!showCustomPlaybookForm)}
              className="text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded-lg hover:bg-purple-200 transition-colors flex items-center space-x-1"
            >
              <Brain className="w-4 h-4" />
              <span>Custom Playbook</span>
            </button>
          )}
        </div>
      </div>

      {/* Goal-based recommendations */}
      {userGoals.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-200">
          <h3 className="font-semibold text-gray-900 mb-3">Recommended Based on Your Goals</h3>
          <p className="text-gray-700 mb-4">
            We've identified these playbooks to help you achieve your AI visibility goals.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {playbooks
              .filter(p => 
                canUsePlaybook(p.id, userPlan) && 
                p.goalAlignment && 
                p.goalAlignment.some(g => userGoals.includes(g))
              )
              .slice(0, 3)
              .map(playbook => {
                const IconComponent = playbook.icon;
                return (
                  <div
                    key={playbook.id}
                    onClick={() => setSelectedPlaybook(playbook)}
                    className="bg-white rounded-lg shadow-sm border border-purple-100 hover:border-purple-300 hover:shadow-md transition-all p-4 cursor-pointer"
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <div className={`p-2 rounded-lg bg-gradient-to-r ${playbook.color}`}>
                        <IconComponent className="w-4 h-4 text-white" />
                      </div>
                      <h4 className="font-medium text-gray-900">{playbook.title}</h4>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{playbook.description}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-purple-600">Start Playbook</span>
                      <span className={`px-2 py-0.5 rounded-full ${getDifficultyColor(playbook.difficulty)}`}>
                        {playbook.difficulty}
                      </span>
                    </div>
                  </div>
                );
              })
            }
          </div>
        </div>
      )}

      {/* Custom Playbook Form */}
      {showCustomPlaybookForm && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-purple-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Custom Playbook</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                What's your optimization goal?
              </label>
              <input
                type="text"
                value={customPlaybookGoal}
                onChange={(e) => setCustomPlaybookGoal(e.target.value)}
                placeholder="e.g., Improve citation likelihood, Optimize for voice search, etc."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Focus Area
              </label>
              <select
                value={customFocusArea}
                onChange={(e) => setCustomFocusArea(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="overall">Overall AI Visibility</option>
                <option value="ai_understanding">AI Understanding</option>
                <option value="citation_likelihood">Citation Likelihood</option>
                <option value="conversational_readiness">Conversational Readiness</option>
                <option value="content_structure">Content Structure</option>
              </select>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={() => setShowCustomPlaybookForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={generateCustomPlaybook}
                disabled={generatingPlaybook}
                className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center space-x-2"
              >
                {generatingPlaybook ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4" />
                    <span>Generate Playbook</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {userPlan === 'free' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="font-medium text-blue-900 mb-2">Unlock More Playbooks</h3>
          <p className="text-blue-800 text-sm mb-3">
            Upgrade to Core plan or higher to access advanced optimization playbooks including competitive intelligence and voice search optimization.
          </p>
          <button
            onClick={() => onSectionChange('billing')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            View Plans
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {playbooks
          .filter(playbook => canUsePlaybook(playbook.id, userPlan))
          .map((playbook) => {
            const IconComponent = playbook.icon;
            const progress = getPlaybookProgress(playbook);
            
            return (
              <div 
                key={playbook.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 hover:border-purple-300 hover:shadow-lg transition-all duration-300 cursor-pointer relative"
                onClick={() => setSelectedPlaybook(playbook)}
              >
                {getRecommendationBadge(playbook.id)}
                
                <div className="p-6">
                  <div className="flex items-start space-x-4 mb-4">
                    <div className={`p-3 rounded-lg bg-gradient-to-r ${playbook.color}`}>
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">{playbook.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(playbook.difficulty)}`}>
                          {playbook.difficulty}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm mb-3">{playbook.description}</p>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{playbook.steps.length} steps</span>
                          <span>{playbook.estimatedTime}</span>
                        </div>
                        
                        {progress > 0 && (
                          <div>
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                              <span>Progress</span>
                              <span>{progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full bg-gradient-to-r ${playbook.color} transition-all duration-500`}
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Match score and recommended for */}
                  {playbook.matchScore && playbook.recommendedFor && (
                    <div className="mt-2 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">Match Score</span>
                        <span className="text-xs font-medium text-purple-600">{playbook.matchScore}%</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Recommended for: {playbook.recommendedFor[0]}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-sm text-gray-600">{playbook.category}</span>
                    <div className="flex items-center space-x-2 text-purple-600">
                      <span className="text-sm font-medium">Start Playbook</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {playbooks.filter(p => canUsePlaybook(p.id, userPlan)).length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Playbooks Available</h3>
          <p className="text-gray-600 mb-4">
            Upgrade your plan to access optimization playbooks and structured guidance.
          </p>
          <button
            onClick={() => onSectionChange('billing')}
            className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-300"
          >
            View Plans
          </button>
        </div>
      )}
    </div>
  );
};

// Helper function to determine if a playbook is available for the user's plan
const canUsePlaybook = (playbookId: string, userPlan: string): boolean => {
  if (userPlan === 'free') {
    return playbookId === 'ai-visibility-foundation';
  } else if (userPlan === 'core') {
    return ['ai-visibility-foundation', 'voice-search-optimization', 'citation-boost'].includes(playbookId) || playbookId.startsWith('custom-');
  } else {
    return true; // Pro and Agency get all playbooks
  }
};

export default OptimizationPlaybooks;