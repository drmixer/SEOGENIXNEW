import React, { useState } from 'react';
import { ExternalLink, Settings, CheckCircle, AlertCircle, Loader, Globe, Code, Zap } from 'lucide-react';

interface CMSIntegrationsProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'available' | 'connected' | 'coming_soon';
  planRequired: 'core' | 'pro' | 'agency';
  features: string[];
  setupSteps: string[];
}

const CMSIntegrations: React.FC<CMSIntegrationsProps> = ({ userPlan }) => {
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);

  const integrations: Integration[] = [
    {
      id: 'wordpress',
      name: 'WordPress',
      description: 'Direct publishing and optimization for WordPress sites',
      icon: '🔷',
      status: 'available',
      planRequired: 'core',
      features: [
        'One-click content publishing',
        'Automatic schema markup injection',
        'Real-time SEO optimization',
        'Bulk content optimization',
        'Custom field mapping'
      ],
      setupSteps: [
        'Install SEOGENIX WordPress plugin',
        'Connect your SEOGENIX account',
        'Configure publishing preferences',
        'Set up automatic optimization rules'
      ]
    },
    {
      id: 'shopify',
      name: 'Shopify',
      description: 'E-commerce optimization for Shopify stores',
      icon: '🛍️',
      status: 'available',
      planRequired: 'pro',
      features: [
        'Product description optimization',
        'Collection page enhancement',
        'Schema markup for products',
        'Voice search optimization',
        'Automated meta tag generation'
      ],
      setupSteps: [
        'Install SEOGENIX Shopify app',
        'Authorize store access',
        'Configure product optimization',
        'Set up automated workflows'
      ]
    },
    {
      id: 'webflow',
      name: 'Webflow',
      description: 'Designer-friendly optimization for Webflow sites',
      icon: '🎨',
      status: 'available',
      planRequired: 'pro',
      features: [
        'Visual content optimization',
        'Custom code injection',
        'CMS collection optimization',
        'Dynamic schema generation',
        'Performance monitoring'
      ],
      setupSteps: [
        'Add SEOGENIX embed code',
        'Connect via Webflow API',
        'Map CMS collections',
        'Configure optimization rules'
      ]
    },
    {
      id: 'squarespace',
      name: 'Squarespace',
      description: 'Seamless optimization for Squarespace websites',
      icon: '⬜',
      status: 'coming_soon',
      planRequired: 'core',
      features: [
        'Template-aware optimization',
        'Block-level content enhancement',
        'Automated SEO improvements',
        'Mobile optimization',
        'Analytics integration'
      ],
      setupSteps: [
        'Install via Squarespace Extensions',
        'Authenticate your account',
        'Configure site settings',
        'Enable auto-optimization'
      ]
    },
    {
      id: 'drupal',
      name: 'Drupal',
      description: 'Enterprise-grade optimization for Drupal sites',
      icon: '🔵',
      status: 'coming_soon',
      planRequired: 'agency',
      features: [
        'Multi-site management',
        'Content type optimization',
        'Taxonomy enhancement',
        'Custom module integration',
        'Advanced caching support'
      ],
      setupSteps: [
        'Install SEOGENIX Drupal module',
        'Configure API credentials',
        'Set up content workflows',
        'Enable batch processing'
      ]
    },
    {
      id: 'contentful',
      name: 'Contentful',
      description: 'Headless CMS optimization and content delivery',
      icon: '📝',
      status: 'available',
      planRequired: 'pro',
      features: [
        'Headless content optimization',
        'API-driven enhancements',
        'Multi-channel publishing',
        'Content model optimization',
        'Webhook automation'
      ],
      setupSteps: [
        'Create Contentful webhook',
        'Install SEOGENIX integration',
        'Map content models',
        'Configure delivery rules'
      ]
    }
  ];

  const handleConnect = async (integration: Integration) => {
    setConnecting(integration.id);
    
    // Simulate connection process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // In a real implementation, this would:
    // 1. Open OAuth flow or API key setup
    // 2. Validate credentials
    // 3. Set up webhooks/automation
    // 4. Update integration status
    
    setConnecting(null);
    alert(`${integration.name} integration would be set up here!`);
  };

  const canUseIntegration = (integration: Integration) => {
    const planHierarchy = { core: 1, pro: 2, agency: 3 };
    const userPlanLevel = planHierarchy[userPlan as keyof typeof planHierarchy] || 0;
    const requiredLevel = planHierarchy[integration.planRequired];
    
    return userPlanLevel >= requiredLevel;
  };

  const getStatusIcon = (status: Integration['status']) => {
    switch (status) {
      case 'connected': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'available': return <Globe className="w-5 h-5 text-blue-500" />;
      case 'coming_soon': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default: return <Settings className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: Integration['status']) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'available': return 'Available';
      case 'coming_soon': return 'Coming Soon';
      default: return 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">CMS Integrations</h2>
          <p className="text-gray-600 mt-1">Connect your content management system for seamless optimization</p>
        </div>
        <div className="text-sm text-gray-500">
          {integrations.filter(i => canUseIntegration(i)).length} of {integrations.length} available
        </div>
      </div>

      {/* Integration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((integration) => {
          const canUse = canUseIntegration(integration);
          const isConnecting = connecting === integration.id;
          
          return (
            <div
              key={integration.id}
              className={`bg-white rounded-xl shadow-sm border transition-all duration-300 ${
                canUse && integration.status === 'available'
                  ? 'border-gray-200 hover:border-purple-300 hover:shadow-lg cursor-pointer'
                  : 'border-gray-100'
              } ${!canUse ? 'opacity-60' : ''}`}
              onClick={() => canUse && setSelectedIntegration(integration)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{integration.icon}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                      <div className="flex items-center space-x-2 mt-1">
                        {getStatusIcon(integration.status)}
                        <span className="text-xs text-gray-500">{getStatusText(integration.status)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {!canUse && (
                    <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                      {integration.planRequired.charAt(0).toUpperCase() + integration.planRequired.slice(1)}+
                    </span>
                  )}
                </div>

                <p className="text-gray-600 text-sm mb-4">{integration.description}</p>

                <div className="space-y-2 mb-4">
                  {integration.features.slice(0, 3).map((feature, index) => (
                    <div key={index} className="flex items-center space-x-2 text-xs text-gray-600">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      <span>{feature}</span>
                    </div>
                  ))}
                  {integration.features.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{integration.features.length - 3} more features
                    </div>
                  )}
                </div>

                {canUse ? (
                  integration.status === 'available' ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConnect(integration);
                      }}
                      disabled={isConnecting}
                      className="w-full bg-gradient-to-r from-teal-500 to-purple-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center justify-center space-x-2"
                    >
                      {isConnecting ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          <span>Connecting...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          <span>Connect</span>
                        </>
                      )}
                    </button>
                  ) : integration.status === 'connected' ? (
                    <button className="w-full bg-green-100 text-green-700 py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center space-x-2">
                      <CheckCircle className="w-4 h-4" />
                      <span>Connected</span>
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full bg-gray-100 text-gray-500 py-2 px-4 rounded-lg text-sm font-medium"
                    >
                      Coming Soon
                    </button>
                  )
                ) : (
                  <button className="w-full bg-gray-100 text-gray-500 py-2 px-4 rounded-lg text-sm font-medium">
                    Upgrade Required
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Integration Details Modal */}
      {selectedIntegration && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{selectedIntegration.icon}</span>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{selectedIntegration.name} Integration</h3>
                  <p className="text-sm text-gray-500">{selectedIntegration.description}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedIntegration(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ExternalLink className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-6">
                {/* Features */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Features & Capabilities</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedIntegration.features.map((feature, index) => (
                      <div key={index} className="flex items-center space-x-2 text-sm text-gray-600">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Setup Steps */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Setup Process</h4>
                  <div className="space-y-3">
                    {selectedIntegration.setupSteps.map((step, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </div>
                        <span className="text-sm text-gray-600">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Benefits */}
                <div className="bg-gradient-to-r from-teal-50 to-purple-50 rounded-lg p-4 border border-teal-200">
                  <h4 className="font-semibold text-gray-900 mb-2">Integration Benefits</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Streamlined content optimization workflow</li>
                    <li>• Automatic AI visibility improvements</li>
                    <li>• Real-time performance monitoring</li>
                    <li>• Reduced manual optimization tasks</li>
                    <li>• Consistent SEO implementation</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setSelectedIntegration(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              {selectedIntegration.status === 'available' && canUseIntegration(selectedIntegration) && (
                <button
                  onClick={() => handleConnect(selectedIntegration)}
                  disabled={connecting === selectedIntegration.id}
                  className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center space-x-2"
                >
                  {connecting === selectedIntegration.id ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Connect Now</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">Need Help with Integrations?</h3>
        <p className="text-blue-800 text-sm mb-4">
          Our team can help you set up custom integrations or troubleshoot existing connections.
        </p>
        <div className="flex items-center space-x-4">
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors">
            Contact Support
          </button>
          <button className="text-blue-600 hover:text-blue-700 text-sm flex items-center space-x-1">
            <Code className="w-4 h-4" />
            <span>View API Docs</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CMSIntegrations;