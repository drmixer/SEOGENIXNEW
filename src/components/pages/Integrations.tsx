import React from 'react';
import { ArrowRight, Zap, Globe, Code, CheckCircle, ExternalLink } from 'lucide-react';

const Integrations = () => {
  const integrationCategories = [
    {
      title: "Content Management Systems",
      description: "Connect your CMS for seamless content optimization",
      integrations: [
        { name: "WordPress", icon: "🔷", description: "Direct publishing and optimization for WordPress sites", status: "Available" },
        { name: "Shopify", icon: "🛍️", description: "E-commerce optimization for Shopify stores", status: "Available" },
        { name: "Webflow", icon: "🎨", description: "Designer-friendly optimization for Webflow sites", status: "Available" },
        { name: "Squarespace", icon: "⬜", description: "Seamless optimization for Squarespace websites", status: "Coming Soon" },
        { name: "Drupal", icon: "🔵", description: "Enterprise-grade optimization for Drupal sites", status: "Coming Soon" },
        { name: "Contentful", icon: "📝", description: "Headless CMS optimization and content delivery", status: "Available" }
      ]
    },
    {
      title: "Analytics & Reporting",
      description: "Connect your analytics tools for comprehensive insights",
      integrations: [
        { name: "Google Analytics", icon: "📊", description: "Track AI visibility impact on traffic and engagement", status: "Available" },
        { name: "Google Search Console", icon: "🔍", description: "Monitor search performance and AI-driven queries", status: "Available" },
        { name: "Adobe Analytics", icon: "📈", description: "Enterprise analytics integration for AI visibility", status: "Coming Soon" },
        { name: "Looker Studio", icon: "📉", description: "Create custom dashboards with AI visibility data", status: "Available" }
      ]
    },
    {
      title: "Marketing Tools",
      description: "Integrate with your marketing stack for maximum impact",
      integrations: [
        { name: "HubSpot", icon: "🧲", description: "Connect CRM data with AI visibility insights", status: "Available" },
        { name: "Mailchimp", icon: "📧", description: "Optimize email content for AI visibility", status: "Coming Soon" },
        { name: "Zapier", icon: "⚡", description: "Connect SEOGENIX with 3,000+ apps", status: "Available" },
        { name: "Slack", icon: "💬", description: "Get AI visibility alerts and reports in Slack", status: "Available" }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 py-20 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-6">
              Integrations & Connections
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Connect SEOGENIX with your favorite tools and platforms for seamless AI visibility optimization.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Integration Categories */}
        {integrationCategories.map((category, index) => (
          <div key={index} className="mb-16">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{category.title}</h2>
              <p className="text-gray-600">{category.description}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {category.integrations.map((integration, idx) => (
                <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="text-2xl">{integration.icon}</div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                      <div className="flex items-center mt-1">
                        {integration.status === "Available" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Available
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Coming Soon
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-4">{integration.description}</p>
                  
                  <button className={`flex items-center text-sm font-medium ${
                    integration.status === "Available" 
                      ? "text-purple-600 hover:text-purple-700" 
                      : "text-gray-400 cursor-not-allowed"
                  }`}>
                    {integration.status === "Available" ? "Connect" : "Notify Me"}
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* API Section */}
        <div className="bg-gradient-to-r from-teal-50 to-purple-50 rounded-xl p-8 border border-teal-100 mb-16">
          <div className="flex flex-col md:flex-row items-center">
            <div className="md:w-2/3 mb-6 md:mb-0 md:pr-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Developer API</h2>
              <p className="text-gray-700 mb-4">
                Build custom integrations with our comprehensive API. Access AI visibility scores, run audits, and integrate SEOGENIX capabilities directly into your applications.
              </p>
              <div className="flex flex-wrap gap-4">
                <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-teal-500 to-purple-600 hover:from-teal-600 hover:to-purple-700">
                  <Code className="w-4 h-4 mr-2" />
                  API Documentation
                </button>
                <button className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Developer Portal
                </button>
              </div>
            </div>
            <div className="md:w-1/3">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <pre className="text-xs text-gray-800 overflow-x-auto">
                  <code>{`// Example API request
fetch('https://api.seogenix.com/v1/audit', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://example.com'
  })
})`}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Integration Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Need a Custom Integration?</h2>
            <p className="text-gray-600 max-w-3xl mx-auto">
              Our team can build custom integrations for your specific needs. Contact us to discuss your requirements.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 p-6 rounded-lg">
              <Zap className="w-8 h-8 text-purple-600 mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Enterprise Integrations</h3>
              <p className="text-gray-600 text-sm">
                Custom solutions for enterprise-level requirements with dedicated support.
              </p>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-lg">
              <Globe className="w-8 h-8 text-teal-600 mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Multi-site Management</h3>
              <p className="text-gray-600 text-sm">
                Specialized integrations for managing multiple websites across different platforms.
              </p>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-lg">
              <Code className="w-8 h-8 text-blue-600 mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Custom Development</h3>
              <p className="text-gray-600 text-sm">
                Bespoke development services to integrate SEOGENIX with your proprietary systems.
              </p>
            </div>
          </div>
          
          <div className="text-center mt-8">
            <button className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-teal-500 to-purple-600 hover:from-teal-600 hover:to-purple-700">
              Contact Our Integration Team
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Integrations;