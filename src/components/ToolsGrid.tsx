import React from 'react';
import { 
  FileText, 
  Shield,
  Search, 
  Mic, 
  Globe, 
  Users, 
  Zap, 
  TrendingUp,
  Lightbulb,
  BarChart3,
  Lock
} from 'lucide-react';

interface ToolsGridProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
}

const ToolsGrid: React.FC<ToolsGridProps> = ({ userPlan }) => {
  const tools = [
    {
      name: 'AI Visibility Audit',
      description: 'Full report analyzing content structure for AI visibility',
      icon: FileText,
      available: userPlan !== 'free',
      color: 'from-blue-500 to-blue-600'
    },
    {
      name: 'Schema Generator', 
      description: 'Generate Schema.org markup for better AI comprehension',
      icon: Shield,
      available: userPlan !== 'free',
      color: 'from-green-500 to-green-600'
    },
    {
      name: 'Citation Tracker',
      description: 'Monitor mentions from LLMs, Google, and other platforms',
      icon: Search,
      available: userPlan !== 'free',
      color: 'from-purple-500 to-purple-600'
    },
    {
      name: 'Voice Assistant Tester',
      description: 'Simulate queries via Siri, Alexa, and Google Assistant',
      icon: Mic,
      available: userPlan !== 'free',
      color: 'from-indigo-500 to-indigo-600'
    },
    {
      name: 'LLM Site Summaries',
      description: 'Generate summaries for language model understanding',
      icon: Globe,
      available: userPlan !== 'free',
      color: 'from-teal-500 to-teal-600'
    },
    {
      name: 'AI Content Optimizer',
      description: 'Score and rewrite content for maximum AI visibility',
      icon: TrendingUp,
      available: userPlan !== 'free',
      color: 'from-orange-500 to-orange-600'
    },
    {
      name: 'Entity Coverage Analyzer',
      description: 'Identify missing people, places, and topics',
      icon: Users,
      available: ['pro', 'agency'].includes(userPlan),
      color: 'from-pink-500 to-pink-600'
    },
    {
      name: 'AI Content Generator',
      description: 'Create optimized FAQs, snippets, and meta tags',
      icon: Zap,
      available: ['pro', 'agency'].includes(userPlan),
      color: 'from-yellow-500 to-yellow-600'
    },
    {
      name: 'Prompt Match Suggestions',
      description: 'Generate prompts aligned with user AI queries',
      icon: Lightbulb,
      available: ['pro', 'agency'].includes(userPlan),
      color: 'from-cyan-500 to-cyan-600'
    },
    {
      name: 'Competitive Analysis',
      description: 'Compare visibility scores against competitors',
      icon: BarChart3,
      available: ['pro', 'agency'].includes(userPlan),
      color: 'from-red-500 to-red-600'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">AI Optimization Tools</h2>
        <p className="text-gray-600">Click any available tool to get started</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool, index) => {
          const IconComponent = tool.icon;
          
          return (
            <div 
              key={index}
              className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 ${
                tool.available 
                  ? 'hover:shadow-lg hover:border-purple-200 cursor-pointer' 
                  : 'opacity-60'
              }`}
            >
              <div className={`h-2 bg-gradient-to-r ${tool.color}`}></div>
              
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg bg-gradient-to-r ${tool.color}`}>
                    <IconComponent className="w-6 h-6 text-white" />
                  </div>
                  {!tool.available && (
                    <div className="bg-gray-100 p-1 rounded-full">
                      <Lock className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{tool.name}</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">{tool.description}</p>
                
                {tool.available ? (
                  <button className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium transition-colors">
                    Launch Tool
                  </button>
                ) : (
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-2">
                      Available with {userPlan === 'free' ? 'Core' : 'Pro'} plan
                    </p>
                    <button className="bg-gradient-to-r from-teal-500 to-purple-600 text-white py-2 px-4 rounded-lg text-xs hover:shadow-lg transition-all duration-300">
                      Upgrade Plan
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ToolsGrid;