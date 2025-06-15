import React, { useState, useEffect } from 'react';
import { X, CreditCard, Check, Star, Calendar, Download, ExternalLink, Loader, RefreshCw } from 'lucide-react';
import { lemonsqueezyService } from '../services/lemonsqueezy';
import { supabase } from '../lib/supabase';

interface BillingModalProps {
  onClose: () => void;
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  onPlanChange: (plan: 'free' | 'core' | 'pro' | 'agency') => void;
  user: any;
}

const BillingModal: React.FC<BillingModalProps> = ({ onClose, userPlan, onPlanChange, user }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'plans' | 'billing' | 'usage'>('overview');
  const [isAnnual, setIsAnnual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(false);

  useEffect(() => {
    // Load subscription data when modal opens
    const loadSubscriptionData = async () => {
      if (!user?.id) return;
      
      setLoadingSubscription(true);
      try {
        const subscription = await lemonsqueezyService.getUserSubscription(user.id);
        setSubscriptionData(subscription);
      } catch (err) {
        console.error('Error loading subscription:', err);
      } finally {
        setLoadingSubscription(false);
      }
    };
    
    loadSubscriptionData();
  }, [user?.id]);

  const plans = [
    {
      name: 'Free',
      id: 'free' as const,
      monthlyPrice: 0,
      annualPrice: 0,
      description: 'Try basic tools and explore SEO visibility',
      websitesLimit: 1,
      competitorsLimit: 1,
      features: [
        'AI Visibility Score (Overall)',
        'Basic dashboard access',
        'Limited tool usage',
        'Community support',
        '1 website',
        '1 competitor tracking'
      ],
      limitations: [
        'No subscore breakdown',
        'No advanced tools',
        'No chatbot access',
        'Limited reports'
      ]
    },
    {
      name: 'Core',
      id: 'core' as const,
      monthlyPrice: 20,
      annualPrice: 180,
      description: 'Full audits and essential tools',
      websitesLimit: 3,
      competitorsLimit: 3,
      features: [
        'Everything in Free',
        'AI Visibility Subscores',
        'Schema Generator',
        'AI Content Optimizer',
        'LLM Site Summaries',
        'Citation Tracker',
        'Voice Assistant Tester',
        'Genie Chatbot (Tool Guidance)',
        'Up to 3 websites',
        'Up to 3 competitors'
      ],
      limitations: [
        'No advanced analytics',
        'Limited competitive analysis',
        'No team access'
      ]
    },
    {
      name: 'Pro',
      id: 'pro' as const,
      monthlyPrice: 60,
      annualPrice: 540,
      description: 'Advanced optimization with full chatbot access',
      websitesLimit: 10,
      competitorsLimit: 10,
      popular: true,
      features: [
        'Everything in Core',
        'Prompt Match Suggestions',
        'Entity Coverage Analyzer',
        'Competitive Analysis',
        'AI Content Generator',
        'Full Genie Chatbot Support',
        'Weekly Proactive Suggestions',
        'Priority support',
        'Up to 10 websites',
        'Up to 10 competitors'
      ],
      limitations: [
        'Single user account',
        'No team collaboration'
      ]
    },
    {
      name: 'Agency',
      id: 'agency' as const,
      monthlyPrice: 150,
      annualPrice: 1350,
      description: 'Manage multiple clients with team access',
      websitesLimit: 25,
      competitorsLimit: 25,
      features: [
        'Everything in Pro',
        'Multi-site Management',
        'Team Access & Collaboration',
        'Client Reporting',
        'White-label Options',
        'Dedicated Account Manager',
        'Custom Integrations',
        'Priority Features',
        'Up to 25 websites',
        'Up to 25 competitors'
      ]
    }
  ];

  const currentPlan = plans.find(p => p.id === userPlan);

  const usageData = {
    auditsUsed: 15,
    auditsLimit: userPlan === 'free' ? 5 : userPlan === 'core' ? 50 : userPlan === 'pro' ? 200 : 1000,
    toolsUsed: 42,
    toolsLimit: userPlan === 'free' ? 10 : userPlan === 'core' ? 100 : userPlan === 'pro' ? 500 : 2000,
    reportsGenerated: 3,
    reportsLimit: userPlan === 'free' ? 0 : userPlan === 'core' ? 10 : userPlan === 'pro' ? 50 : 200
  };

  const billingHistory = [
    { date: '2025-01-01', amount: 79, plan: 'Pro', status: 'Paid' },
    { date: '2024-12-01', amount: 79, plan: 'Pro', status: 'Paid' },
    { date: '2024-11-01', amount: 79, plan: 'Pro', status: 'Paid' }
  ];

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'plans', label: 'Plans & Pricing' },
    { id: 'billing', label: 'Billing History' },
    { id: 'usage', label: 'Usage & Limits' }
  ];

  const handlePlanUpgrade = async (planId: 'free' | 'core' | 'pro' | 'agency') => {
    if (planId === 'free') {
      // For downgrading to free, we'll just cancel the subscription
      if (subscriptionData?.id) {
        setLoading(true);
        try {
          const success = await lemonsqueezyService.cancelSubscription(subscriptionData.id);
          if (success) {
            onPlanChange('free');
            // Update local state
            await supabase.auth.updateUser({
              data: { plan: 'free' }
            });
            
            // Update profile
            await supabase
              .from('user_profiles')
              .update({ 
                plan: 'free',
                subscription_status: 'cancelled',
                subscription_updated_at: new Date().toISOString()
              })
              .eq('user_id', user.id);
          } else {
            setError('Failed to cancel subscription. Please try again or contact support.');
          }
        } catch (err) {
          console.error('Error cancelling subscription:', err);
          setError('An error occurred while cancelling your subscription.');
        } finally {
          setLoading(false);
        }
      } else {
        // Already on free plan
        onPlanChange('free');
      }
      return;
    }
    
    // For upgrading to paid plans, redirect to LemonSqueezy checkout
    setLoading(true);
    setError(null);
    
    try {
      const checkoutUrl = await lemonsqueezyService.getCheckoutUrl(
        planId, 
        user, 
        isAnnual ? 'annual' : 'monthly'
      );
      
      if (checkoutUrl) {
        // Redirect to checkout
        window.location.href = checkoutUrl;
      } else {
        setError('Failed to create checkout. Please try again.');
      }
    } catch (err) {
      console.error('Error creating checkout:', err);
      setError('An error occurred while setting up the checkout process.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getNextBillingDate = () => {
    if (!subscriptionData) return 'N/A';
    
    const renewsAt = subscriptionData.attributes?.renews_at;
    if (!renewsAt) return 'N/A';
    
    return formatDate(renewsAt);
  };

  const getSubscriptionStatus = () => {
    if (!subscriptionData) return userPlan === 'free' ? 'Free Plan' : 'Active';
    
    const status = subscriptionData.attributes?.status;
    if (status === 'active') return 'Active';
    if (status === 'cancelled') return 'Cancelled (Expires on ' + getNextBillingDate() + ')';
    if (status === 'expired') return 'Expired';
    if (status === 'on_trial') return 'Trial (Ends on ' + getNextBillingDate() + ')';
    
    return status;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Billing & Subscription</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-64 border-r border-gray-200 p-6">
            <nav className="space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Subscription</h3>
                  
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-xl font-bold text-gray-900">{currentPlan?.name} Plan</h4>
                          {userPlan === 'pro' && <Star className="w-5 h-5 text-yellow-500" />}
                        </div>
                        <p className="text-gray-600 mt-1">{currentPlan?.description}</p>
                        <div className="mt-3">
                          {userPlan === 'free' ? (
                            <span className="text-lg font-semibold text-green-600">Free</span>
                          ) : (
                            <span className="text-lg font-semibold text-gray-900">
                              ${currentPlan?.monthlyPrice}/month
                            </span>
                          )}
                        </div>
                        {loadingSubscription ? (
                          <div className="mt-2 flex items-center text-sm text-gray-500">
                            <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                            <span>Loading subscription details...</span>
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-gray-500">
                            Status: {getSubscriptionStatus()}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">Next billing date</div>
                        <div className="font-medium text-gray-900">
                          {userPlan === 'free' ? 'N/A' : getNextBillingDate()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-gray-900">{usageData.auditsUsed}</div>
                        <div className="text-sm text-gray-500">Audits this month</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">of {usageData.auditsLimit}</div>
                        <div className="w-16 bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-purple-600 h-2 rounded-full"
                            style={{ width: `${Math.min((usageData.auditsUsed / usageData.auditsLimit) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-gray-900">{usageData.toolsUsed}</div>
                        <div className="text-sm text-gray-500">Tools used</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">of {usageData.toolsLimit}</div>
                        <div className="w-16 bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-teal-600 h-2 rounded-full"
                            style={{ width: `${Math.min((usageData.toolsUsed / usageData.toolsLimit) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-gray-900">{usageData.reportsGenerated}</div>
                        <div className="text-sm text-gray-500">Reports generated</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">of {usageData.reportsLimit}</div>
                        <div className="w-16 bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-indigo-600 h-2 rounded-full"
                            style={{ width: usageData.reportsLimit > 0 ? `${Math.min((usageData.reportsGenerated / usageData.reportsLimit) * 100, 100)}%` : '0%' }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {userPlan !== 'agency' && (
                  <div className="bg-gradient-to-r from-teal-50 to-purple-50 border border-teal-200 rounded-xl p-6">
                    <h4 className="font-semibold text-gray-900 mb-2">Ready to upgrade?</h4>
                    <p className="text-gray-600 mb-4">
                      Unlock more features and higher limits with our {userPlan === 'free' ? 'Core' : userPlan === 'core' ? 'Pro' : 'Agency'} plan.
                    </p>
                    <button
                      onClick={() => setActiveTab('plans')}
                      className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all duration-300"
                    >
                      View Plans
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'plans' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Choose Your Plan</h3>
                  <div className="flex items-center space-x-4">
                    <span className={`text-sm ${!isAnnual ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                      Monthly
                    </span>
                    <button
                      onClick={() => setIsAnnual(!isAnnual)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isAnnual ? 'bg-gradient-to-r from-teal-500 to-purple-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isAnnual ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className={`text-sm ${isAnnual ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                      Annual
                    </span>
                    {isAnnual && (
                      <span className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                        Save 25%
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {plans.map((plan) => (
                    <div 
                      key={plan.id}
                      className={`bg-white rounded-xl shadow-sm border-2 transition-all ${
                        plan.popular 
                          ? 'border-purple-600 relative' 
                          : plan.id === userPlan
                            ? 'border-green-500'
                            : 'border-gray-100 hover:border-purple-300'
                      }`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <div className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
                            <Star className="w-3 h-3" />
                            <span>Most Popular</span>
                          </div>
                        </div>
                      )}
                      
                      {plan.id === userPlan && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <div className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                            Current Plan
                          </div>
                        </div>
                      )}
                      
                      <div className="p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                        <p className="text-gray-600 mb-4 text-sm">{plan.description}</p>
                        
                        <div className="mb-6">
                          <div className="flex items-baseline">
                            <span className="text-3xl font-bold text-gray-900">
                              ${isAnnual ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice}
                            </span>
                            <span className="text-gray-600 ml-2">/month</span>
                          </div>
                          {isAnnual && plan.annualPrice > 0 && (
                            <p className="text-sm text-gray-500 mt-1">
                              Billed annually (${plan.annualPrice}/year)
                            </p>
                          )}
                        </div>
                        
                        <button
                          onClick={() => handlePlanUpgrade(plan.id)}
                          disabled={plan.id === userPlan || loading}
                          className={`w-full py-2 px-4 rounded-lg font-medium transition-all duration-300 ${
                            loading ? 'bg-gray-300 text-gray-500 cursor-not-allowed' :
                            plan.id === userPlan
                              ? 'bg-green-100 text-green-700 cursor-not-allowed'
                              : plan.popular
                                ? 'bg-gradient-to-r from-teal-500 to-purple-600 text-white hover:shadow-lg'
                                : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                          }`}
                        >
                          {loading ? (
                            <div className="flex items-center justify-center">
                              <Loader className="w-4 h-4 animate-spin mr-2" />
                              <span>Processing...</span>
                            </div>
                          ) : (
                            plan.id === userPlan ? 'Current Plan' : plan.name === 'Free' ? 'Downgrade' : 'Upgrade'
                          )}
                        </button>
                        
                        <div className="mt-6">
                          <h4 className="font-medium text-gray-900 mb-3 text-sm">Features included:</h4>
                          <ul className="space-y-2">
                            {plan.features.slice(0, 4).map((feature, index) => (
                              <li key={index} className="flex items-start space-x-2">
                                <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                <span className="text-xs text-gray-600">{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                    <p className="text-red-800 text-sm">{error}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Billing History</h3>
                  <button className="flex items-center space-x-2 text-purple-600 hover:text-purple-700">
                    <Download className="w-4 h-4" />
                    <span>Download All</span>
                  </button>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Plan
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Invoice
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {loadingSubscription ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-4 text-center">
                            <div className="flex justify-center items-center">
                              <RefreshCw className="w-5 h-5 animate-spin text-purple-600 mr-2" />
                              <span>Loading billing history...</span>
                            </div>
                          </td>
                        </tr>
                      ) : subscriptionData ? (
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(subscriptionData.attributes?.created_at || new Date().toISOString())}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {userPlan.charAt(0).toUpperCase() + userPlan.slice(1)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${currentPlan?.monthlyPrice}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              {subscriptionData.attributes?.status || 'Active'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button className="text-purple-600 hover:text-purple-700 flex items-center space-x-1">
                              <ExternalLink className="w-3 h-3" />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                      ) : userPlan !== 'free' ? (
                        billingHistory.map((bill, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(bill.date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {bill.plan}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              ${bill.amount}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                {bill.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <button className="text-purple-600 hover:text-purple-700 flex items-center space-x-1">
                                <ExternalLink className="w-3 h-3" />
                                <span>View</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                            No billing history available for free plan
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {userPlan !== 'free' && subscriptionData && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="font-medium text-gray-900 mb-4">Subscription Details</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subscription ID</span>
                        <span className="text-gray-900">{subscriptionData.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status</span>
                        <span className="text-gray-900">{subscriptionData.attributes?.status || 'Active'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Next Renewal</span>
                        <span className="text-gray-900">{getNextBillingDate()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Payment Method</span>
                        <span className="text-gray-900 flex items-center">
                          <CreditCard className="w-4 h-4 mr-1" />
                          •••• 4242
                        </span>
                      </div>
                    </div>
                    
                    {subscriptionData.attributes?.status === 'active' && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <button
                          onClick={() => handlePlanUpgrade('free')}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Cancel Subscription
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'usage' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Usage & Limits</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-gray-900">AI Visibility Audits</h4>
                      <span className="text-sm text-gray-500">This month</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Used</span>
                        <span>{usageData.auditsUsed} of {usageData.auditsLimit}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-1000"
                          style={{ width: `${Math.min((usageData.auditsUsed / usageData.auditsLimit) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500">
                        {usageData.auditsLimit - usageData.auditsUsed} audits remaining
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-gray-900">Tool Executions</h4>
                      <span className="text-sm text-gray-500">This month</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Used</span>
                        <span>{usageData.toolsUsed} of {usageData.toolsLimit}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-gradient-to-r from-teal-500 to-teal-600 h-3 rounded-full transition-all duration-1000"
                          style={{ width: `${Math.min((usageData.toolsUsed / usageData.toolsLimit) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500">
                        {usageData.toolsLimit - usageData.toolsUsed} tool uses remaining
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-gray-900">Reports Generated</h4>
                      <span className="text-sm text-gray-500">This month</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Used</span>
                        <span>{usageData.reportsGenerated} of {usageData.reportsLimit || 'Unlimited'}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-3 rounded-full transition-all duration-1000"
                          style={{ width: usageData.reportsLimit > 0 ? `${Math.min((usageData.reportsGenerated / usageData.reportsLimit) * 100, 100)}%` : '0%' }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500">
                        {usageData.reportsLimit > 0 ? `${usageData.reportsLimit - usageData.reportsGenerated} reports remaining` : 'Unlimited reports'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-gray-900">Plan Benefits</h4>
                      <span className="text-sm text-purple-600 font-medium">{userPlan.toUpperCase()}</span>
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span>Websites</span>
                        <span className="font-medium">{currentPlan?.websitesLimit || 1}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Competitors</span>
                        <span className="font-medium">{currentPlan?.competitorsLimit || 1}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {currentPlan?.features.slice(0, 4).map((feature, index) => (
                        <div key={index} className="flex items-center">
                          <Check className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-gray-600 ml-2">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingModal;