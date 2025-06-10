import React, { useState } from 'react';
import { X, CreditCard, Check, Star, Calendar, Download, ExternalLink } from 'lucide-react';

interface BillingModalProps {
  onClose: () => void;
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  onPlanChange: (plan: 'free' | 'core' | 'pro' | 'agency') => void;
}

const BillingModal: React.FC<BillingModalProps> = ({ onClose, userPlan, onPlanChange }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'plans' | 'billing' | 'usage'>('overview');
  const [isAnnual, setIsAnnual] = useState(false);

  const plans = [
    {
      name: 'Free',
      id: 'free' as const,
      monthlyPrice: 0,
      annualPrice: 0,
      description: 'Try basic tools and explore AI visibility',
      features: [
        'AI Visibility Score (Overall)',
        'Basic dashboard access',
        'Limited tool usage',
        'Community support'
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
      monthlyPrice: 29,
      annualPrice: 261,
      description: 'Full audits and essential tools',
      features: [
        'Everything in Free',
        'AI Visibility Subscores',
        'Schema Generator',
        'AI Content Optimizer',
        'LLM Site Summaries',
        'Citation Tracker',
        'Voice Assistant Tester',
        'Genie Chatbot (Tool Guidance)'
      ]
    },
    {
      name: 'Pro',
      id: 'pro' as const,
      monthlyPrice: 79,
      annualPrice: 711,
      description: 'Advanced optimization with full chatbot access',
      popular: true,
      features: [
        'Everything in Core',
        'Prompt Match Suggestions',
        'Entity Coverage Analyzer',
        'Competitive Analysis',
        'AI Content Generator',
        'Full Genie Chatbot Support',
        'Weekly Proactive Suggestions',
        'Priority support'
      ]
    },
    {
      name: 'Agency',
      id: 'agency' as const,
      monthlyPrice: 199,
      annualPrice: 1791,
      description: 'Manage multiple clients with team access',
      features: [
        'Everything in Pro',
        'Multi-site Management',
        'Team Access & Collaboration',
        'Client Reporting',
        'White-label Options',
        'Dedicated Account Manager',
        'Custom Integrations',
        'Priority Features'
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

  const handlePlanUpgrade = (planId: 'free' | 'core' | 'pro' | 'agency') => {
    // In a real app, this would integrate with Stripe or another payment processor
    alert(`Upgrading to ${planId} plan would be handled by payment processor`);
    onPlanChange(planId);
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
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">Next billing date</div>
                        <div className="font-medium text-gray-900">
                          {userPlan === 'free' ? 'N/A' : 'February 1, 2025'}
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
                      className={`bg-white rounded-xl shadow-sm border-2 transition-all duration-300 ${
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
                          onClick={() => plan.id !== userPlan && handlePlanUpgrade(plan.id)}
                          disabled={plan.id === userPlan}
                          className={`w-full py-2 px-4 rounded-lg font-medium transition-all duration-300 ${
                            plan.id === userPlan
                              ? 'bg-green-100 text-green-700 cursor-not-allowed'
                              : plan.popular
                                ? 'bg-gradient-to-r from-teal-500 to-purple-600 text-white hover:shadow-lg'
                                : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                          }`}
                        >
                          {plan.id === userPlan ? 'Current Plan' : plan.name === 'Free' ? 'Downgrade' : 'Upgrade'}
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
                      {billingHistory.map((bill, index) => (
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
                      ))}
                    </tbody>
                  </table>
                </div>
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
                    <div className="space-y-2">
                      {currentPlan?.features.slice(0, 4).map((feature, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <Check className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-gray-600">{feature}</span>
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