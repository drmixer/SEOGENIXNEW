import React, { useState } from 'react';
import { Check, X, Star } from 'lucide-react';
import { lemonsqueezyService } from '../services/lemonsqueezy';
import { supabase } from '../lib/supabase';

interface PricingProps {
  onPlanSelect: (plan: 'free' | 'core' | 'pro' | 'agency') => void;
}

const Pricing: React.FC<PricingProps> = ({ onPlanSelect }) => {
  const [isAnnual, setIsAnnual] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const plans = [
    {
      name: 'Free',
      id: 'free' as const,
      monthlyPrice: 0,
      annualPrice: 0,
      description: 'Try basic tools and explore SEO visibility',
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
      ],
      limitations: [
        'Single user account',
        'No team collaboration'
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

  const handlePlanSelect = async (plan: 'free' | 'core' | 'pro' | 'agency') => {
    if (plan === 'free') {
      onPlanSelect(plan);
      return;
    }
    
    // For paid plans, check if user is logged in
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      // If not logged in, just call the regular onPlanSelect to show signup modal
      onPlanSelect(plan);
      return;
    }
    
    // If logged in, redirect to LemonSqueezy checkout
    try {
      setLoading(plan);
      setError(null);
      
      const checkoutUrl = await lemonsqueezyService.getCheckoutUrl(plan, user);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        setError('Failed to create checkout. Please try again.');
      }
    } catch (err) {
      console.error('Error creating checkout:', err);
      setError('An error occurred while setting up the checkout process.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <section id="pricing" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Start free and scale as you grow. All plans include core AI visibility features.
          </p>
          
          <div className="flex items-center justify-center space-x-4">
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {plans.map((plan) => (
            <div 
              key={plan.id}
              className={`bg-white rounded-2xl shadow-lg border-2 transition-all duration-300 hover:shadow-xl ${
                plan.popular 
                  ? 'border-purple-600 relative' 
                  : 'border-gray-100 hover:border-teal-500'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center space-x-1">
                    <Star className="w-4 h-4" />
                    <span>Most Popular</span>
                  </div>
                </div>
              )}
              
              <div className="p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-gray-600 mb-6 text-sm">{plan.description}</p>
                
                <div className="mb-6">
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold text-gray-900">
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
                  onClick={() => handlePlanSelect(plan.id)}
                  disabled={loading === plan.id}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-300 ${
                    loading === plan.id
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : plan.popular
                        ? 'bg-gradient-to-r from-teal-500 to-purple-600 text-white hover:shadow-lg'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {loading === plan.id ? 'Processing...' : plan.name === 'Free' ? 'Start Free' : 'Choose Plan'}
                </button>
                
                <div className="mt-8">
                  <h4 className="font-semibold text-gray-900 mb-4">Features included:</h4>
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start space-x-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  {plan.limitations && (
                    <ul className="space-y-3 mt-4">
                      {plan.limitations.map((limitation, index) => (
                        <li key={index} className="flex items-start space-x-3">
                          <X className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-400">{limitation}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {error && (
          <div className="mt-8 max-w-md mx-auto bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm text-center">{error}</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default Pricing;