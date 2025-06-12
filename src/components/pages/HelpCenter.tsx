import React, { useState } from 'react';
import { Search, Book, Video, MessageSquare, FileText, ArrowRight, ChevronDown, ChevronUp, Mail, Phone } from 'lucide-react';

const HelpCenter = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const helpCategories = [
    {
      title: "Getting Started",
      icon: <Book className="w-6 h-6 text-purple-600" />,
      description: "Learn the basics of SEOGENIX",
      articles: [
        "Introduction to AI Visibility",
        "Setting Up Your First Website",
        "Running Your First Audit",
        "Understanding Your AI Visibility Score"
      ]
    },
    {
      title: "Video Tutorials",
      icon: <Video className="w-6 h-6 text-teal-600" />,
      description: "Watch step-by-step guides",
      articles: [
        "AI Visibility Audit Walkthrough",
        "Content Optimization Tutorial",
        "Schema Generator Guide",
        "Competitive Analysis Basics"
      ]
    },
    {
      title: "Tool Guides",
      icon: <FileText className="w-6 h-6 text-blue-600" />,
      description: "Detailed documentation for each tool",
      articles: [
        "Schema Generator Documentation",
        "Citation Tracker Guide",
        "Voice Assistant Tester Tutorial",
        "Content Optimizer Best Practices"
      ]
    },
    {
      title: "Troubleshooting",
      icon: <MessageSquare className="w-6 h-6 text-red-600" />,
      description: "Solve common issues",
      articles: [
        "Audit Errors Troubleshooting",
        "Connection Issues",
        "Account Management",
        "Billing and Subscription Help"
      ]
    }
  ];

  const faqs = [
    {
      question: "What is AI visibility and why does it matter?",
      answer: "AI visibility refers to how well your content is structured and optimized for AI systems like ChatGPT, Google Bard, and voice assistants. As more people use AI to find information, traditional SEO isn't enough. Your content needs to be easily understood and cited by AI systems to maintain visibility in the AI-driven search landscape."
    },
    {
      question: "How is SEOGENIX different from traditional SEO tools?",
      answer: "While traditional SEO tools focus on search engines, SEOGENIX is built for the AI era. We analyze how LLMs understand your content, track AI citations, optimize for voice assistants, and provide tools specifically designed for AI-driven search and discovery."
    },
    {
      question: "What is the AI Visibility Score?",
      answer: "Our proprietary 0-100 score that measures how well your content is structured for AI systems. It includes subscores for AI Understanding, Citation Likelihood, Conversational Readiness, and Content Structure Quality, giving you actionable insights to improve your AI presence."
    },
    {
      question: "Can I track when AI systems mention my content?",
      answer: "Yes! Our Citation Tracker monitors mentions across LLMs, Google's AI features, Reddit discussions, and other platforms. You'll get alerts when your content is cited, helping you understand your AI reach and impact."
    },
    {
      question: "How quickly will I see results?",
      answer: "You can start improving immediately with our audit insights and optimization tools. AI citation tracking and visibility improvements typically show results within 2-4 weeks, as AI systems update their knowledge bases."
    }
  ];

  const toggleFaq = (index: number) => {
    if (expandedFaq === index) {
      setExpandedFaq(null);
    } else {
      setExpandedFaq(index);
    }
  };

  const filteredFaqs = searchQuery 
    ? faqs.filter(faq => 
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : faqs;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 py-20 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-6">
              How Can We Help You?
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Find answers, tutorials, and support for all your AI visibility needs.
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
                  placeholder="Search for help articles, tutorials, and FAQs..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Help Categories */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Browse Help by Category</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {helpCategories.map((category, index) => (
              <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all p-6">
                <div className="mb-4">
                  {category.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{category.title}</h3>
                <p className="text-gray-600 text-sm mb-4">{category.description}</p>
                
                <ul className="space-y-2 mb-4">
                  {category.articles.map((article, idx) => (
                    <li key={idx} className="text-sm">
                      <a href="#" className="text-gray-700 hover:text-purple-600 flex items-center">
                        <span className="mr-1">•</span> {article}
                      </a>
                    </li>
                  ))}
                </ul>
                
                <a href="#" className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center">
                  View All
                  <ArrowRight className="w-4 h-4 ml-1" />
                </a>
              </div>
            ))}
          </div>
        </div>
        
        {/* Popular Articles */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Popular Help Articles</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all p-6">
              <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded-full mb-4">Getting Started</span>
              <h3 className="font-semibold text-gray-900 mb-2">Understanding Your AI Visibility Score</h3>
              <p className="text-gray-600 text-sm mb-4">Learn how to interpret your AI visibility score and subscores to improve your content's performance with AI systems.</p>
              <a href="#" className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center">
                Read Article
                <ArrowRight className="w-4 h-4 ml-1" />
              </a>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all p-6">
              <span className="inline-block bg-teal-100 text-teal-800 text-xs px-2.5 py-0.5 rounded-full mb-4">Optimization</span>
              <h3 className="font-semibold text-gray-900 mb-2">Content Optimization Best Practices</h3>
              <p className="text-gray-600 text-sm mb-4">Discover the most effective techniques for optimizing your content for AI systems and maximizing citation potential.</p>
              <a href="#" className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center">
                Read Article
                <ArrowRight className="w-4 h-4 ml-1" />
              </a>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all p-6">
              <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full mb-4">Technical</span>
              <h3 className="font-semibold text-gray-900 mb-2">Schema Markup Implementation Guide</h3>
              <p className="text-gray-600 text-sm mb-4">Step-by-step instructions for implementing Schema.org markup to improve AI understanding of your content.</p>
              <a href="#" className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center">
                Read Article
                <ArrowRight className="w-4 h-4 ml-1" />
              </a>
            </div>
          </div>
        </div>
        
        {/* FAQs */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Frequently Asked Questions</h2>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {filteredFaqs.map((faq, index) => (
              <div key={index} className="border-b border-gray-100 last:border-b-0">
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <h3 className="font-medium text-gray-900">{faq.question}</h3>
                  {expandedFaq === index ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                
                {expandedFaq === index && (
                  <div className="px-6 py-4 bg-gray-50">
                    <p className="text-gray-600">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Contact Support */}
        <div className="bg-gradient-to-r from-teal-50 to-purple-50 rounded-xl p-8 border border-teal-100">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Still Need Help?</h2>
            <p className="text-gray-600 max-w-3xl mx-auto">
              Our support team is ready to assist you with any questions or issues you may have.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <Mail className="w-8 h-8 text-purple-600 mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Email Support</h3>
              <p className="text-gray-600 text-sm mb-4">
                Send us an email and we'll get back to you within 24 hours.
              </p>
              <a href="mailto:support@seogenix.com" className="text-purple-600 hover:text-purple-700 font-medium">
                support@seogenix.com
              </a>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <MessageSquare className="w-8 h-8 text-teal-600 mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Live Chat</h3>
              <p className="text-gray-600 text-sm mb-4">
                Chat with our support team during business hours.
              </p>
              <button className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:shadow-lg transition-all duration-300">
                Start Chat
              </button>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <Phone className="w-8 h-8 text-blue-600 mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Phone Support</h3>
              <p className="text-gray-600 text-sm mb-4">
                Available for Pro and Agency plan customers.
              </p>
              <a href="tel:+18005551234" className="text-purple-600 hover:text-purple-700 font-medium">
                +1 (800) 555-1234
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;