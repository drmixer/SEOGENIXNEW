import React from 'react';
import { TrendingUp, AlertTriangle, Target, Zap, Users, BarChart3, CheckCircle, ArrowRight, MessageSquare } from 'lucide-react';

export interface ActionableInsight {
  id: string;
  type: 'urgent' | 'opportunity' | 'suggestion';
  title: string;
  description: string;
  action: string;
  actionUrl?: string;
  icon: React.ComponentType<any>;
  color: string;
  contextualTip?: string;
  learnMoreLink?: string;
}

interface ActionableInsightsProps {
  insights: ActionableInsight[];
  onInsightAction: (insight: ActionableInsight) => void;
}

const ActionableInsights: React.FC<ActionableInsightsProps> = ({ insights, onInsightAction }) => {
  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Actionable Insights</h3>
        <span className="text-sm text-gray-500">{insights.length} recommendations</span>
      </div>

      <div className="space-y-4">
        {insights.map((insight) => {
          const IconComponent = insight.icon;
          return (
            <div
              key={insight.id}
              className={`p-4 rounded-lg border-l-4 ${
                insight.type === 'urgent' ? 'border-red-500 bg-red-50' :
                insight.type === 'opportunity' ? 'border-yellow-500 bg-yellow-50' :
                'border-blue-500 bg-blue-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-r ${insight.color}`}>
                    <IconComponent className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">{insight.title}</h4>
                    <p className="text-sm text-gray-600 mb-2">{insight.description}</p>

                    {insight.contextualTip && (
                      <div className="bg-white bg-opacity-50 rounded-lg p-3 mb-3 border border-gray-200">
                        <p className="text-xs text-gray-700 leading-relaxed">
                          💡 <strong>Why this matters:</strong> {insight.contextualTip}
                        </p>
                        {insight.learnMoreLink && (
                          <a
                            href={insight.learnMoreLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-700 mt-1 inline-block"
                          >
                            Learn more →
                          </a>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => onInsightAction(insight)}
                      className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                        insight.type === 'urgent' ? 'bg-red-600 text-white hover:bg-red-700' :
                        insight.type === 'opportunity' ? 'bg-yellow-600 text-white hover:bg-yellow-700' :
                        'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      <span>{insight.action}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  insight.type === 'urgent' ? 'bg-red-100 text-red-800' :
                  insight.type === 'opportunity' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {insight.type}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActionableInsights;
