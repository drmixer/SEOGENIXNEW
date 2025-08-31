import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Globe, Target, ArrowRight, Building, FileText, Loader } from 'lucide-react';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';

interface OnboardingModalProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  onComplete: (startWalkthrough: boolean) => void;
  onClose: () => void;
  navigate: (path: string) => void;
}

interface Website {
  url: string;
  name: string;
}

interface Competitor {
  url: string;
  name: string;
}

interface Goal {
  id: string;
  name: string;
  description: string;
  selected: boolean;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ userPlan, onComplete, onClose, navigate }) => {
  const [step, setStep] = useState(1);
  const [websites, setWebsites] = useState<Website[]>([{ url: 'https://', name: '' }]);
  const [competitors, setCompetitors] = useState<Competitor[]>([{ url: 'https://', name: '' }]);
  const [industry, setIndustry] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goals, setGoals] = useState<Goal[]>([
    { 
      id: 'increase_citations', 
      name: 'Increase AI Citations', 
      description: 'Get your content cited more frequently by AI systems like ChatGPT and Claude',
      selected: false
    },
    { 
      id: 'improve_understanding', 
      name: 'Improve AI Understanding', 
      description: 'Make your content more comprehensible to AI systems',
      selected: false
    },
    { 
      id: 'voice_search', 
      name: 'Optimize for Voice Search', 
      description: 'Make your content more discoverable through voice assistants',
      selected: false
    },
    { 
      id: 'competitive_edge', 
      name: 'Gain Competitive Edge', 
      description: 'Outperform competitors in AI visibility metrics',
      selected: false
    },
    { 
      id: 'content_structure', 
      name: 'Improve Content Structure', 
      description: 'Enhance how your content is organized for better AI comprehension',
      selected: false
    }
  ]);

  // Plan limits
  const planLimits = {
    free: { websites: 1, competitors: 1 },
    core: { websites: 3, competitors: 3 },
    pro: { websites: 10, competitors: 10 },
    agency: { websites: 25, competitors: 25 }
  };

  const currentLimits = planLimits[userPlan];

  const industries = [
    'Technology & Software',
    'E-commerce & Retail',
    'Healthcare & Medical',
    'Finance & Banking',
    'Education & Training',
    'Marketing & Advertising',
    'Real Estate',
    'Food & Beverage',
    'Travel & Tourism',
    'Manufacturing',
    'Professional Services',
    'Non-profit',
    'Entertainment & Media',
    'Automotive',
    'Other'
  ];

  const addWebsite = () => {
    if (websites.length < currentLimits.websites) {
      setWebsites([...websites, { url: 'https://', name: '' }]);
    }
  };

  const removeWebsite = (index: number) => {
    if (websites.length > 1) {
      setWebsites(websites.filter((_, i) => i !== index));
    }
  };

  const updateWebsite = (index: number, field: 'url' | 'name', value: string) => {
    const updated = websites.map((website, i) => 
      i === index ? { ...website, [field]: value } : website
    );
    setWebsites(updated);
  };

  const addCompetitor = () => {
    if (competitors.length < currentLimits.competitors) {
      setCompetitors([...competitors, { url: 'https://', name: '' }]);
    }
  };

  const removeCompetitor = (index: number) => {
    if (competitors.length > 1) {
      setCompetitors(competitors.filter((_, i) => i !== index));
    }
  };

  const updateCompetitor = (index: number, field: 'url' | 'name', value: string) => {
    const updated = competitors.map((competitor, i) => 
      i === index ? { ...competitor, [field]: value } : competitor
    );
    setCompetitors(updated);
  };

  const toggleGoal = (id: string) => {
    setGoals(goals.map(goal => 
      goal.id === id ? { ...goal, selected: !goal.selected } : goal
    ));
  };

  const handleNext = async () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      // Save data and complete onboarding
      setLoading(true);
      setError(null);
      
      try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.error('Error getting current user:', userError);
          setError('Unable to complete onboarding: ' + userError.message);
          setLoading(false);
          return;
        }
        
        if (!user) {
          console.error('No user found during onboarding completion');
          setError('User session not found. Please try logging in again.');
          setLoading(false);
          return;
        }
        
        const selectedGoals = goals.filter(g => g.selected).map(g => g.id);
        
        const onboardingData = {
          websites: websites.filter(w => w.url.trim() !== '' && w.name.trim() !== ''),
          competitors: competitors.filter(c => c.url.trim() !== '' && c.name.trim() !== ''),
          industry,
          businessDescription,
          plan: userPlan,
          goals: selectedGoals,
          completedAt: new Date().toISOString()
        };
        
        console.log('Creating/updating profile with data:', onboardingData);
        
        // Update user metadata with plan
        await supabase.auth.updateUser({
          data: { plan: userPlan }
        });
        
        await userDataService.updateUserProfile(user.id, {
            websites: onboardingData.websites,
            competitors: onboardingData.competitors,
            industry: onboardingData.industry,
            business_description: onboardingData.businessDescription,
            plan: userPlan,
            goals: selectedGoals,
            onboarding_completed_at: new Date().toISOString(),
        });

        // Track onboarding completion
        await userDataService.trackActivity({
          user_id: user.id,
          activity_type: 'onboarding_completed',
          activity_data: { 
            plan: userPlan,
            websitesCount: onboardingData.websites.length,
            competitorsCount: onboardingData.competitors.length,
            industry: onboardingData.industry,
            goals: selectedGoals
          }
        });
        
        // Save to localStorage for backward compatibility
        localStorage.setItem('seogenix_onboarding', JSON.stringify(onboardingData));
        
        // Complete onboarding and trigger walkthrough
        onComplete(true);
      } catch (error: any) {
        console.error('Error saving onboarding data:', error);
        setError('Failed to save your settings: ' + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const canProceed = () => {
    if (step === 1) {
      return websites.some(w => w.url.trim() !== '' && w.name.trim() !== '');
    } else if (step === 2) {
      return industry.trim() !== '';
    } else if (step === 3) {
      return competitors.some(c => c.url.trim() !== '' && c.name.trim() !== '');
    } else {
      return goals.some(g => g.selected);
    }
  };

  const totalSteps = 4;

  const header = (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Welcome to SEOGENIX!</h2>
      <p className="text-gray-600 mt-1">Let's set up your {userPlan} plan</p>
    </div>
  );

  return (
    <Modal isOpen={true} onClose={onClose} header={header} size="2xl">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-4 sm:p-6 pb-0">
            {/* Progress indicator */}
            <div className="flex items-center mb-8">
              {[1, 2, 3, 4].map((stepNumber) => (
                <React.Fragment key={stepNumber}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step >= stepNumber ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {stepNumber}
                  </div>
                  {stepNumber < totalSteps && (
                    <div className={`flex-1 h-1 mx-4 ${step > stepNumber ? 'bg-purple-600' : 'bg-gray-200'}`}></div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6">
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <Globe className="w-12 h-12 text-purple-600 mx-auto mb-3" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Add Your Websites</h3>
                  <p className="text-gray-600">
                    Tell us which websites you want to optimize for AI visibility.
                    <br />
                    <span className="text-sm text-purple-600">
                      {userPlan} plan: Up to {currentLimits.websites} website{currentLimits.websites > 1 ? 's' : ''}
                    </span>
                  </p>
                </div>

                <div className="space-y-4">
                  {websites.map((website, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Website {index + 1}</h4>
                        {websites.length > 1 && (
                          <button
                            onClick={() => removeWebsite(index)}
                            className="text-red-500 hover:text-red-700 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Website URL
                          </label>
                          <input
                            type="url"
                            value={website.url}
                            onChange={(e) => updateWebsite(index, 'url', e.target.value)}
                            placeholder="https://example.com"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Website Name
                          </label>
                          <input
                            type="text"
                            value={website.name}
                            onChange={(e) => updateWebsite(index, 'name', e.target.value)}
                            placeholder="My Website"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {websites.length < currentLimits.websites && (
                  <button
                    onClick={addWebsite}
                    className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-600 hover:border-purple-500 hover:text-purple-600 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Another Website</span>
                  </button>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <Building className="w-12 h-12 text-purple-600 mx-auto mb-3" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Tell Us About Your Business</h3>
                  <p className="text-gray-600">
                    This helps us provide better AI visibility recommendations tailored to your industry.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Industry <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Select your industry</option>
                      {industries.map((ind) => (
                        <option key={ind} value={ind}>{ind}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Description <span className="text-gray-500">(Optional)</span>
                    </label>
                    <textarea
                      value={businessDescription}
                      onChange={(e) => setBusinessDescription(e.target.value)}
                      placeholder="Briefly describe what your business does, your target audience, and key services/products..."
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This helps our AI provide more relevant optimization suggestions.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <Target className="w-12 h-12 text-purple-600 mx-auto mb-3" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Add Your Competitors</h3>
                  <p className="text-gray-600">
                    Add competitor websites to track and compare AI visibility performance.
                    <br />
                    <span className="text-sm text-purple-600">
                      {userPlan} plan: Up to {currentLimits.competitors} competitor{currentLimits.competitors > 1 ? 's' : ''}
                    </span>
                  </p>
                </div>

                <div className="space-y-4">
                  {competitors.map((competitor, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Competitor {index + 1}</h4>
                        {competitors.length > 1 && (
                          <button
                            onClick={() => removeCompetitor(index)}
                            className="text-red-500 hover:text-red-700 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Competitor URL
                          </label>
                          <input
                            type="url"
                            value={competitor.url}
                            onChange={(e) => updateCompetitor(index, 'url', e.target.value)}
                            placeholder="https://competitor.com"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Competitor Name
                          </label>
                          <input
                            type="text"
                            value={competitor.name}
                            onChange={(e) => updateCompetitor(index, 'name', e.target.value)}
                            placeholder="Competitor Name"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {competitors.length < currentLimits.competitors && (
                  <button
                    onClick={addCompetitor}
                    className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-600 hover:border-purple-500 hover:text-purple-600 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Another Competitor</span>
                  </button>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <FileText className="w-12 h-12 text-purple-600 mx-auto mb-3" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Set Your AI Visibility Goals</h3>
                  <p className="text-gray-600">
                    Select the primary goals you want to achieve with SEOGENIX.
                    <br />
                    <span className="text-sm text-purple-600">
                      This helps us tailor recommendations and track your progress.
                    </span>
                  </p>
                </div>

                <div className="space-y-3">
                  {goals.map((goal) => (
                    <div 
                      key={goal.id}
                      onClick={() => toggleGoal(goal.id)}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        goal.selected 
                          ? 'border-purple-500 bg-purple-50' 
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="flex items-start">
                        <div className={`w-5 h-5 rounded-full flex-shrink-0 mt-0.5 border ${
                          goal.selected 
                            ? 'bg-purple-600 border-purple-600' 
                            : 'border-gray-300'
                        }`}>
                          {goal.selected && (
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="ml-3">
                          <h4 className="font-medium text-gray-900">{goal.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{goal.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-800 text-sm">{error}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end space-x-3 p-6 pt-4 border-t border-gray-200">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            )}
            
            <div className="flex-1"></div>
            
            <button
              onClick={handleNext}
              disabled={!canProceed() || loading}
              className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>{step === 4 ? 'Complete Setup' : 'Next'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
