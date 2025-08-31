import React, { useState, useEffect } from 'react';
import { BookOpen, Target, TrendingUp, Users, Zap, CheckCircle, ArrowRight, Clock, Star, RefreshCw, AlertTriangle, Brain, FileText, Lightbulb } from 'lucide-react';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';
import { apiService } from '../services/api';

interface OptimizationPlaybooksProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  onSectionChange: (section: string) => void;
  userGoals?: string[];
  userProfile?: any;
}

interface PlaybookStep {
  id: string;
  title: string;
  description: string;
  action: string;
  toolId?: string;
  estimatedTime: string;
  priority: number;
  dependsOn?: string[];
}

interface Playbook {
  playbookTitle: string;
  playbookDescription: string;
  steps: PlaybookStep[];
}

const OptimizationPlaybooks: React.FC<OptimizationPlaybooksProps> = ({ 
  userPlan, 
  onSectionChange,
  userProfile
}) => {
  const [generatedPlaybook, setGeneratedPlaybook] = useState<Playbook | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customPlaybookGoal, setCustomPlaybookGoal] = useState<string>('');
  const [customFocusArea, setCustomFocusArea] = useState<'overall' | 'ai_understanding' | 'citation_likelihood' | 'conversational_readiness' | 'content_structure'>('overall');

  // Pre-fill goal based on user profile if available
  useEffect(() => {
    if (userProfile?.goals && userProfile.goals.length > 0) {
      setCustomPlaybookGoal(`Achieve my goal of: ${userProfile.goals.join(', ')}`);
    }
  }, [userProfile]);


  const generatePlaybook = async () => {
    setIsLoading(true);
    setError(null);
    setGeneratedPlaybook(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated.");

      const playbookData = await apiService.generateAdaptivePlaybook(
        user.id,
        customPlaybookGoal,
        customFocusArea
      );
      
      setGeneratedPlaybook(playbookData);
      
    } catch (err: any) {
      console.error('Error generating custom playbook:', err);
      setError(err.message || "An unknown error occurred while generating the playbook.");
    } finally {
      setIsLoading(false);
    }
  };


  const handleStepAction = async (step: PlaybookStep) => {
    if (step.toolId) {
      onSectionChange(step.toolId);
    }
    setCompletedSteps(prev => new Set(prev).add(step.id));
  };

  const getPlaybookProgress = () => {
    if (!generatedPlaybook) return 0;
    const completedCount = generatedPlaybook.steps.filter(step => completedSteps.has(step.id)).length;
    return Math.round((completedCount / generatedPlaybook.steps.length) * 100);
  };

  const canGenerate = customPlaybookGoal.trim() !== '' && !isLoading;

  if (userPlan === 'free') {
      return (
        <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Adaptive Playbooks</h3>
          <p className="text-gray-600 mb-4">
            Generate personalized, AI-driven strategies to achieve your goals. Available with Core plan and above.
          </p>
          <button
            onClick={() => onSectionChange('billing')}
            className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-300"
          >
            Upgrade to Core Plan
          </button>
        </div>
      );
  }

  if (generatedPlaybook) {
    const progress = getPlaybookProgress();
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setGeneratedPlaybook(null)}
            className="text-purple-600 hover:text-purple-700 flex items-center space-x-2"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            <span>Create New Playbook</span>
          </button>
          <span className="text-sm text-gray-500">{progress}% Complete</span>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{generatedPlaybook.playbookTitle}</h1>
          <p className="text-gray-600 mb-4">{generatedPlaybook.playbookDescription}</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-teal-500 to-purple-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Your Step-by-Step Guide</h3>
          <div className="space-y-4">
            {generatedPlaybook.steps.map((step, index) => {
              const isCompleted = completedSteps.has(step.id);
              return (
                <div key={step.id} className={`p-4 rounded-lg border-2 transition-all duration-300 ${isCompleted ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}>
                        {isCompleted ? <CheckCircle className="w-4 h-4" /> : index + 1}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-1">{step.title}</h4>
                        <p className="text-sm text-gray-600 mb-3">{step.description}</p>
                        
                        <div className="mt-2 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
                          <div className="flex items-start space-x-2">
                            <Lightbulb className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <h6 className="font-semibold text-sm text-yellow-800">Rationale</h6>
                              <p className="text-sm text-yellow-700 mt-1">{step.rationale}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleStepAction(step)}
                      disabled={isCompleted}
                      className={`ml-4 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${isCompleted ? 'bg-green-100 text-green-700 cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                    >
                      {isCompleted ? 'Done' : 'Launch Tool'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
       <div>
          <h2 className="text-2xl font-bold text-gray-900">Adaptive Playbooks</h2>
          <p className="text-gray-600 mt-1">Generate a personalized, AI-driven strategy to achieve your specific goals.</p>
        </div>
      <div className="bg-white rounded-xl shadow-sm p-6 border border-purple-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Your Custom Playbook</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">What's your primary optimization goal?</label>
            <input
              type="text"
              value={customPlaybookGoal}
              onChange={(e) => setCustomPlaybookGoal(e.target.value)}
              placeholder="e.g., Increase organic traffic by 20% in Q3"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Focus Area</label>
            <select
              value={customFocusArea}
              onChange={(e) => setCustomFocusArea(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="overall">Overall AI Visibility</option>
              <option value="ai_understanding">AI Understanding</option>
              <option value="citation_likelihood">Citation Likelihood</option>
              <option value="conversational_readiness">Conversational Readiness</option>
              <option value="content_structure">Content Structure</option>
            </select>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                    <p className="text-red-800 text-sm">{error}</p>
                </div>
            </div>
          )}
          <div className="flex justify-end pt-4">
            <button
              onClick={generatePlaybook}
              disabled={!canGenerate}
              className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center space-x-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4" />
                  <span>Generate Playbook</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptimizationPlaybooks;