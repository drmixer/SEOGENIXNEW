import React from 'react';
import { Target, TrendingUp, MessageSquare, FileText, Zap, ArrowRight } from 'lucide-react';

interface GoalTrackerProps {
  goals: string[];
  progress: Record<string, number>;
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  onPlaybookStart: () => void;
}

const GoalTracker: React.FC<GoalTrackerProps> = ({ goals, progress, userPlan, onPlaybookStart }) => {
  // Skip rendering if no goals are set
  if (!goals || goals.length === 0) {
    return null;
  }

  const goalInfo: Record<string, {
    name: string;
    description: string;
    icon: React.ComponentType<any>;
    color: string;
    targetScore: number;
  }> = {
    increase_citations: {
      name: 'Increase AI Citations',
      description: 'Get your content cited more frequently by AI systems',
      icon: MessageSquare,
      color: 'from-blue-500 to-blue-600',
      targetScore: 85
    },
    improve_understanding: {
      name: 'Improve AI Understanding',
      description: 'Make your content more comprehensible to AI systems',
      icon: Target,
      color: 'from-purple-500 to-purple-600',
      targetScore: 85
    },
    voice_search: {
      name: 'Optimize for Voice Search',
      description: 'Make your content more discoverable through voice assistants',
      icon: Zap,
      color: 'from-yellow-500 to-yellow-600',
      targetScore: 80
    },
    competitive_edge: {
      name: 'Gain Competitive Edge',
      description: 'Outperform competitors in AI visibility metrics',
      icon: TrendingUp,
      color: 'from-green-500 to-green-600',
      targetScore: 90
    },
    content_structure: {
      name: 'Improve Content Structure',
      description: 'Enhance how your content is organized for better AI comprehension',
      icon: FileText,
      color: 'from-teal-500 to-teal-600',
      targetScore: 85
    }
  };

  const getProgressColor = (score: number, targetScore: number) => {
    const percentage = (score / targetScore) * 100;
    if (percentage >= 90) return 'bg-green-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getProgressText = (score: number, targetScore: number) => {
    const percentage = (score / targetScore) * 100;
    if (percentage >= 90) return 'Excellent';
    if (percentage >= 70) return 'Good';
    if (percentage >= 50) return 'Needs Work';
    return 'Poor';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Your AI Visibility Goals</h3>
        {['core', 'pro', 'agency'].includes(userPlan) && (
          <button
            onClick={onPlaybookStart}
            className="text-sm text-purple-600 hover:text-purple-800 flex items-center space-x-1"
          >
            <span>View Playbooks</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {goals.map(goalId => {
          if (!goalInfo[goalId]) return null;
          
          const goal = goalInfo[goalId];
          const currentScore = progress[goalId] || 0;
          const IconComponent = goal.icon;
          const progressPercentage = Math.min(100, Math.round((currentScore / goal.targetScore) * 100));
          
          return (
            <div key={goalId} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex items-start space-x-3 mb-3">
                <div className={`p-2 rounded-lg bg-gradient-to-r ${goal.color} flex-shrink-0`}>
                  <IconComponent className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{goal.name}</h4>
                  <p className="text-xs text-gray-600 mt-1">{goal.description}</p>
                </div>
              </div>
              
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Progress to Target ({goal.targetScore})</span>
                  <span className={`font-medium ${
                    progressPercentage >= 90 ? 'text-green-600' :
                    progressPercentage >= 70 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {currentScore ? `${currentScore}/100` : 'No data yet'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${getProgressColor(currentScore, goal.targetScore)}`}
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
                {currentScore > 0 && (
                  <div className="text-right text-xs mt-1 font-medium">
                    <span className={
                      progressPercentage >= 90 ? 'text-green-600' :
                      progressPercentage >= 70 ? 'text-yellow-600' :
                      'text-red-600'
                    }>
                      {getProgressText(currentScore, goal.targetScore)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {Object.keys(progress).length === 0 && (
        <div className="bg-blue-50 p-4 rounded-lg mt-4">
          <p className="text-blue-800 text-sm">
            Run an AI visibility audit to start tracking your progress toward these goals.
          </p>
        </div>
      )}
    </div>
  );
};

export default GoalTracker;