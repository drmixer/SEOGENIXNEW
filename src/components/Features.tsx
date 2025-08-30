import React from 'react';
import { 
  Target, 
  Search, 
  Shield, 
  TrendingUp, 
  Mic, 
  FileText, 
  Users, 
  Zap,
  BarChart3,
  MessageSquare,
  Lightbulb,
  Globe
} from 'lucide-react';

const Features = () => {
  const features = [
    {
      icon: Target,
      title: 'AI Visibility Score',
      description: 'Central metric (0-100) with detailed subscores for AI Understanding, Citation Likelihood, and Content Structure Quality.'
    },
    {
      icon: FileText,
      title: 'AI Visibility Audit',
      description: 'Comprehensive analysis of how well your content is structured for AI systems and language models.'
    },
    {
      icon: Shield,
      title: 'Schema Generator',
      description: 'Automatically generates Schema.org markup to improve AI comprehension of your content.'
    },
    {
      icon: Search,
      title: 'Citation Tracker',
      description: 'Monitor when your content gets mentioned by LLMs, Google, Reddit, and other platforms.'
    },
    {
      icon: Mic,
      title: 'Voice Assistant Tester',
      description: 'Simulate voice queries through Siri, Alexa, and Google Assistant to optimize for voice search.'
    },
    {
      icon: Globe,
      title: 'LLM Site Summaries',
      description: 'Generate tailored summaries that help language models understand your site\'s purpose and content.'
    },
    {
      icon: Users,
      title: 'Entity Coverage Analyzer',
      description: 'Identify key people, places, and topics missing from your content strategy.'
    },
    {
      icon: Zap,
      title: 'AI Content Generator',
      description: 'Create optimized FAQs, snippets, and meta tags specifically designed for AI consumption.'
    },
    {
      icon: TrendingUp,
      title: 'AI Content Editor',
      description: 'Edit and optimize content with AI visibility feedback, rewrites, and CMS publishing.'
    },
    {
      icon: Lightbulb,
      title: 'Prompt Match Suggestions',
      description: 'Generate prompts that align with how users ask AI systems questions about your topic.'
    },
    {
      icon: BarChart3,
      title: 'Competitive Analysis',
      description: 'Compare your AI visibility scores against competitors and industry benchmarks.'
    },
    {
      icon: MessageSquare,
      title: 'Genie AI Assistant',
      description: 'Your personal AI guide for understanding audit findings and optimizing performance.'
    }
  ];

  return (
    <section id="features" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* New headline section */}
        <div className="text-center mb-16">
          <h2 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Built for Bots.{' '}
            <span className="text-gray-600">Loved by Humans.</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Our platform bridges the gap between AI systems and human creativity, delivering tools that machines understand and marketers love to use.
          </p>
        </div>

        <div className="text-center mb-16">
          <h3 className="text-4xl font-bold text-gray-900 mb-4">
            Comprehensive AI SEO Tools
          </h3>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Everything you need to optimize your content for the AI-driven future of search and discovery.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div 
                key={index}
                className="bg-white p-6 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100"
              >
                <div className="flex items-center mb-4">
                  <div className="bg-gradient-to-r from-teal-500 to-purple-600 p-3 rounded-lg">
                    <IconComponent className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 ml-4">{feature.title}</h3>
                </div>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
