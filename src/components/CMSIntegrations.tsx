import React, { useState, useEffect } from 'react';
import { ExternalLink, Settings, CheckCircle, AlertCircle, Loader, Globe, Code, Zap, X, Upload, Download } from 'lucide-react';
import { apiService } from '../services/api';
import { userDataService, type CMSIntegration } from '../services/userDataService';
import { supabase } from '../lib/supabase';

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
  const [connectedIntegrations, setConnectedIntegrations] = useState<CMSIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConnectionModal, setShowConnectionModal] = useState<Integration | null>(null);
  const [connectionForm, setConnectionForm] = useState<any>({});

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

  useEffect(() => {
    loadConnectedIntegrations();
  }, []);

  const loadConnectedIntegrations = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const integrations = await userDataService.getCMSIntegrations(user.id);
        setConnectedIntegrations(integrations);
      }
    } catch (error) {
      console.error('Error loading integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (integration: Integration) => {
    setShowConnectionModal(integration);
    setConnectionForm({});
  };

  const handleConnectionSubmit = async () => {
    if (!showConnectionModal) return;
    
    setConnecting(showConnectionModal.id);
    
    try {
      let response;
      
      if (showConnectionModal.id === 'wordpress') {
        response = await apiService.connectWordPress(
          connectionForm.siteUrl,
          connectionForm.username,
          connectionForm.applicationPassword
        );
      } else if (showConnectionModal.id === 'shopify') {
        response = await apiService.connectShopify(
          connectionForm.shopDomain,
          connectionForm.accessToken
        );
      }
      
      if (response?.success) {
        await loadConnectedIntegrations();
        setShowConnectionModal(null);
        setConnectionForm({});
      } else {
        throw new Error(response?.error || 'Connection failed');
      }
    } catch (error) {
      console.error('Connection error:', error);
      alert(`Failed to connect ${showConnectionModal.name}: ${error.message}`);
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (integrationId: string, cmsType: string) => {
    if (!confirm('Are you sure you want to disconnect this integration?')) return;
    
    try {
      await apiService.disconnectCMS(cmsType as 'wordpress' | 'shopify');
      await userDataService.deleteCMSIntegration(integrationId);
      await loadConnectedIntegrations();
    } catch (error) {
      console.error('Disconnect error:', error);
      alert('Failed to disconnect integration');
    }
  };

  const handleSync = async (integration: CMSIntegration) => {
    try {
      const response = await apiService.syncCMSData(integration.cms_type as 'wordpress' | 'shopify');
      if (response?.success) {
        await loadConnectedIntegrations();
        alert('Sync completed successfully');
      }
    } catch (error) {
      console.error('Sync error:', error);
      alert('Sync failed');
    }
  };

  const canUseIntegration = (integration: Integration) => {
    const planHierarchy = { core: 1, pro: 2, agency: 3 };
    const userPlanLevel = planHierarchy[userPlan as keyof typeof planHierarchy] || 0;
    const requiredLevel = planHierarchy[integration.planRequired];
    
    return userPlanLevel >= requiredLevel;
  };

  const getIntegrationStatus = (integration: Integration) => {
    const connected = connectedIntegrations.find(ci => ci.cms_type === integration.id);
    if (connected) return 'connected';
    return integration.status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'available': return <Globe className="w-5 h-5 text-blue-500" />;
      case 'coming_soon': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default: return <Settings className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'available': return 'Available';
      case 'coming_soon': return 'Coming Soon';
      default: return 'Unknown';
    }
  };

  const renderConnectionForm = () => {
    if (!showConnectionModal) return null;

    switch (showConnectionModal.id) {
      case 'wordpress':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WordPress Site URL</label>
              <input
                type="url"
                value={connectionForm.siteUrl || ''}
                onChange={(e) => setConnectionForm({...connectionForm, siteUrl: e.target.value})}
                placeholder="https://yoursite.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={connectionForm.username || ''}
                onChange={(e) => setConnectionForm({...connectionForm, username: e.target.value})}
                placeholder="WordPress username"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Application Password</label>
              <input
                type="password"
                value={connectionForm.applicationPassword || ''}
                onChange={(e) => setConnectionForm({...connectionForm, applicationPassword: e.target.value})}
                placeholder="WordPress application password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Generate an application password in your WordPress admin under Users → Profile
              </p>
            </div>
          </div>
        );
      
      case 'shopify':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shop Domain</label>
              <input
                type="text"
                value={connectionForm.shopDomain || ''}
                onChange={(e) => setConnectionForm({...connectionForm, shopDomain: e.target.value})}
                placeholder="yourstore.myshopify.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
              <input
                type="password"
                value={connectionForm.accessToken || ''}
                onChange={(e) => setConnectionForm({...connectionForm, accessToken: e.target.value})}
                placeholder="Shopify private app access token"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Create a private app in your Shopify admin to get an access token
              </p>
            </div>
          </div>
        );
      
      default:
        return <p className="text-gray-600">Connection form not available for this integration.</p>;
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
          {connectedIntegrations.length} connected • {integrations.filter(i => canUseIntegration(i)).length} available
        </div>
      </div>

      {/* Connected Integrations */}
      {connectedIntegrations.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Connected Integrations</h3>
          <div className="space-y-4">
            {connectedIntegrations.map((integration) => (
              <div key={integration.id} className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  <div>
                    <h4 className="font-medium text-gray-900">{integration.cms_name}</h4>
                    <p className="text-sm text-gray-600">{integration.site_url}</p>
                    <p className="text-xs text-gray-500">
                      Last synced: {integration.last_sync_at ? new Date(integration.last_sync_at).toLocaleDateString() : 'Never'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleSync(integration)}
                    className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                    title="Sync data"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDisconnect(integration.id, integration.cms_type)}
                    className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                    title="Disconnect"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Integration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((integration) => {
          const canUse = canUseIntegration(integration);
          const status = getIntegrationStatus(integration);
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
                        {getStatusIcon(status)}
                        <span className="text-xs text-gray-500">{getStatusText(status)}</span>
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
                  status === 'available' ? (
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
                  ) : status === 'connected' ? (
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

      {/* Connection Modal */}
      {showConnectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-md sm:rounded-xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{showConnectionModal.icon}</span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Connect {showConnectionModal.name}</h3>
                  <p className="text-sm text-gray-500">Enter your connection details</p>
                </div>
              </div>
              <button
                onClick={() => setShowConnectionModal(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto">
              {renderConnectionForm()}
              
              <div className="flex items-center justify-end space-x-3 mt-4 sm:mt-6">
                <button
                  onClick={() => setShowConnectionModal(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConnectionSubmit}
                  disabled={connecting === showConnectionModal.id}
                  className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center space-x-2"
                >
                  {connecting === showConnectionModal.id ? (
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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Integration Details Modal */}
      {selectedIntegration && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
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
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
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

            <div className="flex items-center justify-end space-x-3 p-4 sm:p-6 border-t border-gray-200">
              <button
                onClick={() => setSelectedIntegration(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              {selectedIntegration.status === 'available' && canUseIntegration(selectedIntegration) && (
                <button
                  onClick={() => {
                    setSelectedIntegration(null);
                    handleConnect(selectedIntegration);
                  }}
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
