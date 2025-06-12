import React, { useState } from 'react';
import { Search, Book, Code, FileText, Terminal, Database, Server, ArrowRight, ChevronRight, ChevronDown } from 'lucide-react';

const Documentation = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('getting-started');

  const toggleSection = (section: string) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
    }
  };

  const docSections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: <Book className="w-5 h-5" />,
      pages: [
        { title: 'Introduction to SEOGENIX', path: '/docs/introduction' },
        { title: 'Quick Start Guide', path: '/docs/quick-start' },
        { title: 'Core Concepts', path: '/docs/core-concepts' },
        { title: 'AI Visibility Explained', path: '/docs/ai-visibility' },
        { title: 'Setting Up Your Account', path: '/docs/account-setup' }
      ]
    },
    {
      id: 'tools-guides',
      title: 'Tools & Guides',
      icon: <FileText className="w-5 h-5" />,
      pages: [
        { title: 'AI Visibility Audit', path: '/docs/audit-tool' },
        { title: 'Schema Generator', path: '/docs/schema-generator' },
        { title: 'Citation Tracker', path: '/docs/citation-tracker' },
        { title: 'Voice Assistant Tester', path: '/docs/voice-tester' },
        { title: 'Content Optimizer', path: '/docs/content-optimizer' },
        { title: 'Entity Coverage Analyzer', path: '/docs/entity-analyzer' },
        { title: 'Prompt Match Suggestions', path: '/docs/prompt-suggestions' }
      ]
    },
    {
      id: 'api-reference',
      title: 'API Reference',
      icon: <Code className="w-5 h-5" />,
      pages: [
        { title: 'API Overview', path: '/docs/api-overview' },
        { title: 'Authentication', path: '/docs/api-auth' },
        { title: 'Audit API', path: '/docs/api-audit' },
        { title: 'Schema API', path: '/docs/api-schema' },
        { title: 'Citations API', path: '/docs/api-citations' },
        { title: 'Content API', path: '/docs/api-content' },
        { title: 'Rate Limits & Quotas', path: '/docs/api-limits' }
      ]
    },
    {
      id: 'integrations',
      title: 'Integrations',
      icon: <Server className="w-5 h-5" />,
      pages: [
        { title: 'WordPress Integration', path: '/docs/wordpress-integration' },
        { title: 'Shopify Integration', path: '/docs/shopify-integration' },
        { title: 'Webflow Integration', path: '/docs/webflow-integration' },
        { title: 'Contentful Integration', path: '/docs/contentful-integration' },
        { title: 'Custom Integrations', path: '/docs/custom-integrations' }
      ]
    },
    {
      id: 'advanced',
      title: 'Advanced Topics',
      icon: <Terminal className="w-5 h-5" />,
      pages: [
        { title: 'AI Visibility Strategy', path: '/docs/ai-strategy' },
        { title: 'Competitive Analysis', path: '/docs/competitive-analysis' },
        { title: 'Entity Optimization', path: '/docs/entity-optimization' },
        { title: 'Voice Search Optimization', path: '/docs/voice-optimization' },
        { title: 'ROI Calculation', path: '/docs/roi-calculation' },
        { title: 'White-labeling', path: '/docs/white-labeling' }
      ]
    }
  ];

  // Featured documentation
  const featuredDocs = [
    {
      title: "AI Visibility Score Explained",
      description: "Learn how our proprietary scoring system measures your content's AI readiness",
      icon: <FileText className="w-6 h-6 text-purple-600" />,
      path: "/docs/ai-visibility-score"
    },
    {
      title: "Schema Markup Best Practices",
      description: "Implement structured data that helps AI systems understand your content",
      icon: <Code className="w-6 h-6 text-teal-600" />,
      path: "/docs/schema-best-practices"
    },
    {
      title: "API Authentication Guide",
      description: "Secure your API connections with proper authentication methods",
      icon: <Database className="w-6 h-6 text-blue-600" />,
      path: "/docs/api-authentication"
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 py-20 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-6">
              SEOGENIX Documentation
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Comprehensive guides, API references, and tutorials for optimizing your AI visibility.
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-sm"
                  placeholder="Search documentation..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col lg:flex-row">
          {/* Sidebar */}
          <div className="lg:w-64 lg:flex-shrink-0 mb-8 lg:mb-0 lg:pr-8">
            <nav className="space-y-1">
              {docSections.map((section) => (
                <div key={section.id} className="mb-4">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between text-left px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center">
                      <span className="text-gray-500 mr-3">{section.icon}</span>
                      <span className="font-medium text-gray-900">{section.title}</span>
                    </div>
                    {expandedSection === section.id ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  
                  {expandedSection === section.id && (
                    <div className="mt-2 ml-8 space-y-1">
                      {section.pages.map((page, index) => (
                        <a
                          key={index}
                          href={page.path}
                          className="block px-3 py-2 text-sm text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        >
                          {page.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
          
          {/* Main Documentation Content */}
          <div className="lg:flex-1 lg:min-w-0">
            {/* Featured Documentation */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Featured Documentation</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {featuredDocs.map((doc, index) => (
                  <a 
                    key={index}
                    href={doc.path}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all p-6"
                  >
                    <div className="mb-4">
                      {doc.icon}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">{doc.title}</h3>
                    <p className="text-gray-600 text-sm mb-4">{doc.description}</p>
                    <div className="text-purple-600 text-sm font-medium flex items-center">
                      Read Documentation
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
            
            {/* Documentation Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <div className="prose max-w-none">
                <h1>Introduction to SEOGENIX</h1>
                <p className="lead">
                  SEOGENIX is an AI-powered SEO platform designed to optimize your content for AI visibility in the era of AI-generated answers, voice search, and conversational interfaces.
                </p>
                
                <h2>What is AI Visibility?</h2>
                <p>
                  AI visibility refers to how well your content is structured and optimized for AI systems like ChatGPT, Google Bard, and voice assistants. As more people use AI to find information, traditional SEO isn't enough. Your content needs to be easily understood and cited by AI systems.
                </p>
                
                <h2>Key Concepts</h2>
                <h3>AI Visibility Score</h3>
                <p>
                  Our proprietary 0-100 score that measures how well your content is structured for AI systems. It includes subscores for AI Understanding, Citation Likelihood, Conversational Readiness, and Content Structure Quality.
                </p>
                
                <h3>Citation Likelihood</h3>
                <p>
                  The probability that AI systems will cite your content when answering related queries. Higher citation likelihood means more visibility in AI-generated answers.
                </p>
                
                <h3>Entity Coverage</h3>
                <p>
                  How well your content covers relevant entities (people, places, organizations, concepts) that AI systems use to understand context and relationships.
                </p>
                
                <h2>Getting Started</h2>
                <p>
                  To begin optimizing your content for AI visibility:
                </p>
                <ol>
                  <li>Create your SEOGENIX account</li>
                  <li>Add your website(s) to your profile</li>
                  <li>Run your first AI Visibility Audit</li>
                  <li>Review your scores and recommendations</li>
                  <li>Use our optimization tools to improve your content</li>
                </ol>
                
                <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 my-6">
                  <h3 className="text-purple-800 font-medium">Next Steps</h3>
                  <p className="text-purple-700 mb-2">
                    Continue your journey with these resources:
                  </p>
                  <ul className="text-purple-700">
                    <li><a href="/docs/quick-start" className="text-purple-600 hover:text-purple-800">Quick Start Guide</a></li>
                    <li><a href="/docs/ai-visibility" className="text-purple-600 hover:text-purple-800">AI Visibility Explained</a></li>
                    <li><a href="/docs/audit-tool" className="text-purple-600 hover:text-purple-800">AI Visibility Audit Guide</a></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Documentation;