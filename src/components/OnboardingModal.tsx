import React, { useState } from 'react';
import { X, Plus, Trash2, Globe, Target, ArrowRight, Building, FileText } from 'lucide-react';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';

interface OnboardingModalProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  onComplete: () => void;
  onClose: () => void;
}

interface Website {
  url: string;
  name: string;
}

interface Competitor {
  url: string;
  name: string;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ userPlan, onComplete, onClose }) => {
  const [step, setStep] = useState(1);
  const [websites, setWebsites] = useState<Website[]>([{ url: '', name: '' }]);
  const [competitors, setCompetitors] = useState<Competitor[]>([{ url: '', name: '' }]);
  const [industry, setIndustry] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Plan limits
  const planLimits = {
    free: { websites: 1, competitors: 1 },
    core: { websites: 3, competitors: 3 },
    pro: { websites: 10, competitors: 10 },
    agency: { websites: 50, competitors: 25 }
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
      setWebsites([...websites, { url: '', name: '' }]);
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
      setCompetitors([...competitors, { url: '', name: '' }]);
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

  const handleNext = async () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      // Save data and complete onboarding
      setIsSubmitting(true);
      setError(null);
      
      try {
        const filteredWebsites = websites.filter(w => w.url.trim() !== '' && w.name.trim() !== '');
        const filteredCompetitors = competitors.filter(c => c.url.trim() !== '' && c.name.trim() !== '');
        
        const onboardingData = {
          websites: filteredWebsites,
          competitors: filteredCompetitors,
          industry,
          businessDescription,
          plan: userPlan,
          completedAt: new Date().toISOString()
        };
        
        // Save to database
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Update user metadata with plan
          await supabase.auth.updateUser({
            data: { plan: userPlan }
          });
          
          // Check if profile already exists
          const { data: existingProfiles } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.id);
            
          if (existingProfiles && existingProfiles.length > 0) {
            // Update existing profile
            await userDataService.updateUserProfile(user.id, {
              websites: onboardingData.websites,
              competitors: onboardingData.competitors,
              industry: onboardingData.industry,
              business_description: onboardingData.businessDescription,
              plan: userPlan,
              onboarding_completed_at: new Date().toISOString()
            });
          } else {
            // Create new profile
            await userDataService.createUserProfile({
              user_id: user.id,
              websites: onboardingData.websites,
              competitors: onboardingData.competitors,
              industry: onboardingData.industry,
              business_description: onboardingData.businessDescription,
              plan: userPlan,
              onboarding_completed_at: new Date().toISOString()
            });
          }

          // Track onboarding completion
          await userDataService.trackActivity({
            user_id: user.id,
            activity_type: 'onboarding_completed',
            activity_data: { 
              plan: userPlan,
              websitesCount: onboardingData.websites.length,
              competitorsCount: onboardingData.competitors.length,
              industry: onboardingData.industry
            }
          });
        }
        
        // Save to localStorage for backward compatibility
        localStorage.setItem('seogenix_onboarding', JSON.stringify(onboardingData));
        
        // Complete onboarding
        onComplete();
      } catch (err: any) {
        console.error('Error saving onboarding data:', err);
        setError(err.message || 'Failed to save onboarding data. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const canProceed = () => {
    if (step === 1) {
      return websites.some(w => w.url.trim() !== '' && w.name.trim() !== '');
    } else if (step === 2) {
      return industry.trim() !== '';
    } else {
      return true; // Competitors are optional
    }
  };

  const totalSteps = 3;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Welcome to SEOGENIX!</h2>
            <p className="text-gray-600 mt-1">Let's set up your {userPlan} plan</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-6 pb-0">
            {/* Progress indicator */}
            <div className="flex items-center mb-8">
              {[1, 2, 3].map((stepNumber) => (
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
                
                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-6 pt-4 border-t border-gray-200 bg-gray-50">
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
              disabled={!canProceed() || isSubmitting}
              className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>{step === 3 ? 'Complete Setup' : 'Next'}</span>
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