import React, { useState } from 'react';
import { BookOpen, Target, TrendingUp, Users, Zap, CheckCircle, ArrowRight, Clock, Star } from 'lucide-react';

interface PlaybookStep {
  id: string;
  title: string;
  description: string;
  action: string;
  toolId?: string;
  estimatedTime: string;
  completed?: boolean;
}

interface Playbook {
  id: string;
  title: string;
  description: string;
  goal: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedTime: string;
  category: string;
  icon: React.ComponentType<any>;
  color: string;
  steps: PlaybookStep[];
  benefits: string[];
}

interface OptimizationPlaybooksProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  onSectionChange: (section: string) => void;
}

const OptimizationPlaybooks: React.FC<OptimizationPlaybooksProps> = ({ userPlan, onSectionChange }) => {
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const playbooks: Playbook[] = [
    {
      id: 'ai-visibility-foundation',
      title: 'AI Visibility Foundation',
      description: 'Build a strong foundation for AI visibility with essential optimizations',
      goal: 'Achieve a baseline AI visibility score of 70+ and establish monitoring',
      difficulty: 'Beginner',
      estimatedTime: '2-3 hours',
      category: 'Getting Started',
      icon: Target,
      color: 'from-blue-500 to-blue-600',
      steps: [
        {
          id: 'foundation-1',
          title: 'Run Initial AI Visibility Audit',
          description: 'Get your baseline scores and identify key areas for improvement',
          action: 'Run comprehensive audit to understand current AI visibility performance',
          toolId: 'audit',
          estimatedTime: '10 minutes'
        },
        {
          id: 'foundation-2',
          title: 'Generate Schema Markup',
          description: 'Add structured data to help AI systems understand your content',
          action: 'Create and implement Schema.org markup for your main pages',
          toolId: 'schema',
          estimatedTime: '30 minutes'
        },
        {
          id: 'foundation-3',
          title: 'Optimize Core Content',
          description: 'Improve your most important pages for AI comprehension',
          action: 'Use content optimizer on your homepage and key landing pages',
          toolId: 'optimizer',
          estimatedTime: '45 minutes'
        },
        {
          id: 'foundation-4',
          title: 'Set Up Citation Tracking',
          description: 'Monitor when AI systems mention your content',
          action: 'Configure citation tracking for your domain and key topics',
          toolId: 'citations',
          estimatedTime: '15 minutes'
        },
        {
          id: 'foundation-5',
          title: 'Test Voice Assistant Responses',
          description: 'See how voice assistants respond to queries about your business',
          action: 'Test common questions users might ask about your services',
          toolId: 'voice',
          estimatedTime: '20 minutes'
        }
      ],
      benefits: [
        'Establish baseline AI visibility metrics',
        'Implement essential technical optimizations',
        'Begin monitoring AI mentions and citations',
        'Improve content structure for AI understanding',
        'Set foundation for advanced optimizations'
      ]
    },
    {
      id: 'content-optimization-mastery',
      title: 'Content Optimization Mastery',
      description: 'Master content creation and optimization for maximum AI visibility',
      goal: 'Create AI-optimized content that consistently gets cited by AI systems',
      difficulty: 'Intermediate',
      estimatedTime: '4-5 hours',
      category: 'Content Strategy',
      icon: Zap,
      color: 'from-yellow-500 to-yellow-600',
      steps: [
        {
          id: 'content-1',
          title: 'Analyze Entity Coverage',
          description: 'Identify missing entities that should be mentioned in your content',
          action: 'Run entity analysis to find gaps in your content coverage',
          toolId: 'entities',
          estimatedTime: '20 minutes'
        },
        {
          id: 'content-2',
          title: 'Generate AI-Optimized FAQs',
          description: 'Create comprehensive FAQ content optimized for AI systems',
          action: 'Generate FAQ content that answers common user questions',
          toolId: 'generator',
          estimatedTime: '45 minutes'
        },
        {
          id: 'content-3',
          title: 'Create LLM Site Summaries',
          description: 'Generate summaries that help AI systems understand your site',
          action: 'Create different types of summaries for various AI use cases',
          toolId: 'summaries',
          estimatedTime: '30 minutes'
        },
        {
          id: 'content-4',
          title: 'Optimize for Prompt Matching',
          description: 'Align your content with how users ask AI systems questions',
          action: 'Generate and implement prompt-matched content strategies',
          toolId: 'prompts',
          estimatedTime: '60 minutes'
        },
        {
          id: 'content-5',
          title: 'Implement Content Optimization',
          description: 'Apply AI-powered optimizations to existing content',
          action: 'Systematically optimize your key pages using AI recommendations',
          toolId: 'optimizer',
          estimatedTime: '90 minutes'
        }
      ],
      benefits: [
        'Create content that AI systems prefer to cite',
        'Improve entity coverage and topical authority',
        'Optimize for natural language queries',
        'Increase likelihood of AI mentions',
        'Build comprehensive content strategy'
      ]
    },
    {
      id: 'competitive-intelligence',
      title: 'Competitive Intelligence & Benchmarking',
      description: 'Gain competitive advantage through AI visibility intelligence',
      goal: 'Outperform competitors in AI visibility and discover new opportunities',
      difficulty: 'Advanced',
      estimatedTime: '3-4 hours',
      category: 'Competitive Strategy',
      icon: Users,
      color: 'from-purple-500 to-purple-600',
      steps: [
        {
          id: 'competitive-1',
          title: 'Discover Hidden Competitors',
          description: 'Find competitors you might not be aware of using AI analysis',
          action: 'Use AI-powered competitor discovery to expand your competitive landscape',
          toolId: 'discovery',
          estimatedTime: '30 minutes'
        },
        {
          id: 'competitive-2',
          title: 'Run Competitive Analysis',
          description: 'Compare your AI visibility against key competitors',
          action: 'Analyze competitor AI visibility scores and strategies',
          toolId: 'competitive',
          estimatedTime: '45 minutes'
        },
        {
          id: 'competitive-3',
          title: 'Identify Content Gaps',
          description: 'Find entity and content gaps compared to competitors',
          action: 'Analyze what entities and topics competitors cover that you don\'t',
          toolId: 'entities',
          estimatedTime: '40 minutes'
        },
        {
          id: 'competitive-4',
          title: 'Monitor Competitor Citations',
          description: 'Track when competitors get mentioned by AI systems',
          action: 'Set up citation tracking for competitor domains and topics',
          toolId: 'citations',
          estimatedTime: '25 minutes'
        },
        {
          id: 'competitive-5',
          title: 'Develop Differentiation Strategy',
          description: 'Create content that differentiates you from competitors',
          action: 'Generate unique content based on competitive intelligence',
          toolId: 'generator',
          estimatedTime: '60 minutes'
        }
      ],
      benefits: [
        'Identify and outperform competitors',
        'Discover new market opportunities',
        'Build competitive content strategies',
        'Monitor competitive AI visibility',
        'Establish market leadership'
      ]
    },
    {
      id: 'voice-search-optimization',
      title: 'Voice Search Optimization',
      description: 'Optimize your content for voice assistants and conversational AI',
      goal: 'Become the preferred source for voice assistant responses in your niche',
      difficulty: 'Intermediate',
      estimatedTime: '2-3 hours',
      category: 'Voice & Conversational',
      icon: TrendingUp,
      color: 'from-green-500 to-green-600',
      steps: [
        {
          id: 'voice-1',
          title: 'Test Current Voice Performance',
          description: 'See how voice assistants currently respond to queries about your business',
          action: 'Test various voice queries related to your business and industry',
          toolId: 'voice',
          estimatedTime: '30 minutes'
        },
        {
          id: 'voice-2',
          title: 'Generate Conversational Content',
          description: 'Create content optimized for natural language queries',
          action: 'Generate FAQ and conversational content for voice search',
          toolId: 'generator',
          estimatedTime: '45 minutes'
        },
        {
          id: 'voice-3',
          title: 'Optimize for Question Prompts',
          description: 'Align content with how people ask voice assistants questions',
          action: 'Create content that matches natural voice query patterns',
          toolId: 'prompts',
          estimatedTime: '40 minutes'
        },
        {
          id: 'voice-4',
          title: 'Implement Conversational Schema',
          description: 'Add structured data optimized for voice responses',
          action: 'Generate and implement FAQ and Q&A schema markup',
          toolId: 'schema',
          estimatedTime: '35 minutes'
        },
        {
          id: 'voice-5',
          title: 'Monitor Voice Citations',
          description: 'Track when voice assistants cite your content',
          action: 'Set up specialized tracking for voice assistant mentions',
          toolId: 'citations',
          estimatedTime: '20 minutes'
        }
      ],
      benefits: [
        'Increase voice search visibility',
        'Optimize for conversational queries',
        'Improve natural language understanding',
        'Capture voice commerce opportunities',
        'Build authority in voice responses'
      ]
    }
  ];

  const availablePlaybooks = playbooks.filter(playbook => {
    if (userPlan === 'free') {
      return playbook.id === 'ai-visibility-foundation';
    } else if (userPlan === 'core') {
      return ['ai-visibility-foundation', 'voice-search-optimization'].includes(playbook.id);
    } else {
      return true; // Pro and Agency get all playbooks
    }
  });

  const handleStepAction = (step: PlaybookStep) => {
    if (step.toolId) {
      onSectionChange(step.toolId);
    }
    
    // Mark step as completed
    setCompletedSteps(prev => new Set([...prev, step.id]));
  };

  const getPlaybookProgress = (playbook: Playbook) => {
    const completedCount = playbook.steps.filter(step => completedSteps.has(step.id)).length;
    return Math.round((completedCount / playbook.steps.length) * 100);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'bg-green-100 text-green-800';
      case 'Intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'Advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
              {selectedPlaybook.difficulty}
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
              
              return (
                <div 
                  key={step.id}
                  className={`p-4 rounded-lg border-2 transition-all duration-300 ${
                    isCompleted 
                      ? 'border-green-200 bg-green-50' 
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
                            disabled={isCompleted}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                              isCompleted
                                ? 'bg-green-100 text-green-700 cursor-not-allowed'
                                : 'bg-purple-600 text-white hover:bg-purple-700'
                            }`}
                          >
                            {isCompleted ? 'Completed' : step.toolId ? 'Launch Tool' : 'Mark Complete'}
                          </button>
                        </div>
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
        <div className="text-sm text-gray-500">
          {availablePlaybooks.length} playbook{availablePlaybooks.length !== 1 ? 's' : ''} available
        </div>
      </div>

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
        {availablePlaybooks.map((playbook) => {
          const IconComponent = playbook.icon;
          const progress = getPlaybookProgress(playbook);
          
          return (
            <div 
              key={playbook.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 hover:border-purple-300 hover:shadow-lg transition-all duration-300 cursor-pointer"
              onClick={() => setSelectedPlaybook(playbook)}
            >
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
                
                <div className="flex items-center justify-between">
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

      {availablePlaybooks.length === 0 && (
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

export default OptimizationPlaybooks;