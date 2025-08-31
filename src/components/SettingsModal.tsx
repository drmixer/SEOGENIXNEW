import React, { useState, useEffect } from 'react';
import { X, User, Globe, Target, Save, Loader, Trash2, Plus } from 'lucide-react';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';

interface SettingsModalProps {
  onClose: () => void;
  user: any;
  userProfile: any;
  onProfileUpdate: (profile: any) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, user, userProfile, onProfileUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'websites' | 'competitors' | 'goals'>('profile');
  const [formData, setFormData] = useState({
    industry: userProfile?.industry || '',
    businessDescription: userProfile?.business_description || '',
    websites: userProfile?.websites || [{ url: '', name: '', id: null }],
    competitors: userProfile?.competitors || [{ url: '', name: '' }],
    goals: userProfile?.goals || []
  });

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

  const availableGoals = [
    { 
      id: 'increase_citations', 
      name: 'Increase AI Citations', 
      description: 'Get your content cited more frequently by AI systems like ChatGPT and Claude'
    },
    { 
      id: 'improve_understanding', 
      name: 'Improve AI Understanding', 
      description: 'Make your content more comprehensible to AI systems'
    },
    { 
      id: 'voice_search', 
      name: 'Optimize for Voice Search', 
      description: 'Make your content more discoverable through voice assistants'
    },
    { 
      id: 'competitive_edge', 
      name: 'Gain Competitive Edge', 
      description: 'Outperform competitors in AI visibility metrics'
    },
    { 
      id: 'content_structure', 
      name: 'Improve Content Structure', 
      description: 'Enhance how your content is organized for better AI comprehension'
    }
  ];

  const handleSave = async () => {
    setLoading(true);
    try {
      // Step 1: Process and save NEW websites as projects.
      await Promise.all(
        formData.websites
          .filter(w => w.url.trim() && w.name.trim() && !w.id) // Filter for only new websites
          .map(async (website) => {
            console.log(`Creating new project for website: ${website.name}`);
            const { error } = await supabase
              .from('projects')
              .insert({
                name: website.name,
                owner_id: user.id,
                url: website.url,
                // FINAL FIX: Add the required org_id with a placeholder value
                org_id: '00000000-0000-0000-0000-000000000000' 
              });

            if (error) throw new Error(`Failed to create project for ${website.name}: ${error.message}`);
          })
      );

      // Step 2: Update the user profile with all other changes.
      const updates = {
        industry: formData.industry,
        business_description: formData.businessDescription,
        competitors: formData.competitors.filter(c => c.url.trim() && c.name.trim()),
        goals: formData.goals
      };
      await userDataService.updateUserProfile(user.id, updates);

      // Step 3: Force a fresh fetch of the complete profile.
      console.log("Forcing a fresh fetch of the user profile from backend...");
      const freshProfile = await userDataService.getUserProfile(user.id, true);
      console.log("Fetched profile:", freshProfile);

      // Step 4: Update the global state with the fresh profile.
      if (freshProfile) {
        onProfileUpdate(freshProfile);
      }

      onClose();

    } catch (error) {
      console.error('Error updating profile:', error);
      alert(`Failed to update settings. Please try again. ${error instanceof Error ? error.message : ''}`);
    } finally {
      setLoading(false);
    }
  };

  const addWebsite = () => {
    setFormData({
      ...formData,
      websites: [...formData.websites, { url: '', name: '', id: null }]
    });
  };

  const removeWebsite = (index: number) => {
    setFormData({
      ...formData,
      websites: formData.websites.filter((_, i) => i !== index)
    });
  };

  const updateWebsite = (index: number, field: 'url' | 'name', value: string) => {
    const updated = formData.websites.map((website, i) => 
      i === index ? { ...website, [field]: value } : website
    );
    setFormData({ ...formData, websites: updated });
  };

  const addCompetitor = () => {
    setFormData({
      ...formData,
      competitors: [...formData.competitors, { url: '', name: '' }]
    });
  };

  const removeCompetitor = (index: number) => {
    setFormData({
      ...formData,
      competitors: formData.competitors.filter((_, i) => i !== index)
    });
  };

  const updateCompetitor = (index: number, field: 'url' | 'name', value: string) => {
    const updated = formData.competitors.map((competitor, i) => 
      i === index ? { ...competitor, [field]: value } : competitor
    );
    setFormData({ ...formData, competitors: updated });
  };

  const toggleGoal = (goalId: string) => {
    if (formData.goals.includes(goalId)) {
      setFormData({
        ...formData,
        goals: formData.goals.filter(id => id !== goalId)
      });
    } else {
      setFormData({
        ...formData,
        goals: [...formData.goals, goalId]
      });
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'websites', label: 'Websites', icon: Globe },
    { id: 'competitors', label: 'Competitors', icon: Target },
    { id: 'goals', label: 'Goals', icon: Target }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar (desktop) */}
          <div className="hidden sm:block w-64 border-r border-gray-200 p-6">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <IconComponent className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
            {/* Mobile tabs */}
            <div className="sm:hidden mb-4 -mx-4 px-4">
              <div className="flex gap-2 overflow-x-auto">
                {tabs.map((tab) => {
                  const IconComponent = tab.icon;
                  const active = activeTab === (tab.id as any);
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap border ${active ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-200'}`}
                    >
                      <IconComponent className="w-4 h-4" />
                      <span className="text-sm">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={user?.user_metadata?.full_name || ''}
                        disabled
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Name cannot be changed</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Industry <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="">Select your industry</option>
                        {industries.map((industry) => (
                          <option key={industry} value={industry}>{industry}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Business Description
                      </label>
                      <textarea
                        value={formData.businessDescription}
                        onChange={(e) => setFormData({ ...formData, businessDescription: e.target.value })}
                        placeholder="Describe your business, target audience, and key services..."
                        rows={4}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'websites' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Your Websites</h3>
                  <button
                    onClick={addWebsite}
                    className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Website</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.websites.map((website, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Website {index + 1}</h4>
                        {formData.websites.length > 1 && (
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
              </div>
            )}

            {activeTab === 'competitors' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Competitor Tracking</h3>
                  <button
                    onClick={addCompetitor}
                    className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Competitor</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.competitors.map((competitor, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Competitor {index + 1}</h4>
                        {formData.competitors.length > 1 && (
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
              </div>
            )}

            {activeTab === 'goals' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Your AI Visibility Goals</h3>
                  <p className="text-gray-600 mb-4">
                    Select the primary goals you want to achieve with SEOGENIX. This helps us tailor recommendations and track your progress.
                  </p>
                  
                  <div className="space-y-3">
                    {availableGoals.map((goal) => (
                      <div 
                        key={goal.id}
                        onClick={() => toggleGoal(goal.id)}
                        className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                          formData.goals.includes(goal.id) 
                            ? 'border-purple-500 bg-purple-50' 
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <div className="flex items-start">
                          <div className={`w-5 h-5 rounded-full flex-shrink-0 mt-0.5 border ${
                            formData.goals.includes(goal.id) 
                              ? 'bg-purple-600 border-purple-600' 
                              : 'border-gray-300'
                          }`}>
                            {formData.goals.includes(goal.id) && (
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
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-4 sm:p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 sm:px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm sm:text-base"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-4 sm:px-6 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center space-x-2 text-sm sm:text-base"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
