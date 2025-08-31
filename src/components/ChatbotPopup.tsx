import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Loader, ExternalLink, LogIn } from 'lucide-react';
import { apiService } from '../services/api';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';

interface ChatbotPopupProps {
  onClose: () => void;
  type: 'landing' | 'dashboard';
  userPlan?: 'free' | 'core' | 'pro' | 'agency';
  onToolLaunch?: (toolId: string) => void;
  user?: any;
}

interface Message {
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  actionSuggestions?: Array<{
    type: string;
    toolId?: string;
    label: string;
  }>;
}

const ChatbotPopup: React.FC<ChatbotPopupProps> = ({ onClose, type, userPlan, onToolLaunch, user }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      type: 'bot',
      content: type === 'landing' 
        ? "Hi! I'm Genie, your AI assistant. I can help you understand SEOGENIX features, pricing plans, and how AI visibility works. What would you like to know?"
        : "Hi! I'm Genie, your AI guide. I can help explain your audit results, suggest optimizations, and answer questions about your AI visibility performance. How can I assist you today?",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load user data for personalization
  useEffect(() => {
    const loadUserData = async () => {
      if (type === 'dashboard' && user) {
        try {
          const profile = await userDataService.getUserProfile(user.id);
          const recentActivity = await userDataService.getRecentActivity(user.id, 10);
          const auditHistory = await userDataService.getAuditHistory(user.id, 3);
          
          setUserData({
            websites: profile?.websites || [],
            industry: profile?.industry,
            recentActivity,
            lastAuditScore: auditHistory[0]?.overall_score,
            lastAuditRecommendations: auditHistory[0]?.recommendations || []
          });
        } catch (error) {
          console.error('Error loading user data:', error);
        }
      }
    };

    loadUserData();
  }, [type, user]);

  // Scroll to bottom of messages when new messages are added
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    // For dashboard chatbot, authentication is required
    if (type === 'dashboard' && !user) {
      const authMessage: Message = {
        type: 'bot',
        content: "You need to be logged in to use the dashboard assistant. Please log in and try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, authMessage]);
      setInputValue('');
      return;
    }

    const userMessage: Message = {
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    scrollToBottom();

    // Track user activity for authenticated users
    if (user) {
      try {
        await userDataService.trackActivity({
          user_id: user.id,
          activity_type: 'genie_chat',
          activity_data: { message: inputValue, context: type }
        });
      } catch (error) {
        console.error('Error tracking activity:', error);
      }
    }

    try {
      // Prepare conversation history for API
      const conversationHistory = messages.map(msg => ({
        role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      const response = await apiService.chatWithGenie(
        inputValue,
        type,
        userPlan,
        conversationHistory,
        userData
      );

      const botMessage: Message = {
        type: 'bot',
        content: response.data.responseText,
        timestamp: new Date(),
        actionSuggestions: response.data.suggestedFollowUps?.map((suggestion: string) => ({
          type: 'suggestion',
          label: suggestion,
        })) || []
      };

      setMessages(prev => [...prev, botMessage]);
      scrollToBottom();

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        type: 'bot',
        content: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      scrollToBottom();
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (action: any) => {
    if (action.type === 'launchTool' && action.toolId && onToolLaunch) {
      onToolLaunch(action.toolId);
      onClose();
    } else if (action.type === 'suggestion' && action.label) {
      setInputValue(action.label);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-end p-0 sm:p-6 z-50">
      <div className="bg-white w-full h-[80vh] sm:h-96 sm:max-w-md sm:rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-2 rounded-full">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Genie</h3>
              <p className="text-sm text-gray-500">
                AI Assistant {userData && type === 'dashboard' ? '(Personalized)' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div key={index}>
              <div
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs p-3 rounded-2xl ${
                    message.type === 'user'
                      ? 'bg-gradient-to-r from-teal-500 to-purple-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              
              {/* Action suggestions */}
              {message.actionSuggestions && message.actionSuggestions.length > 0 && (
                <div className="flex justify-start mt-2">
                  <div className="space-y-2">
                    {message.actionSuggestions.map((action, actionIndex) => (
                      <button
                        key={actionIndex}
                        onClick={() => handleActionClick(action)}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1"
                      >
                        <span>{action.label}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-900 p-3 rounded-2xl">
                <Loader className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="p-4 border-t border-gray-200">
          {type === 'dashboard' && !user ? (
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 text-gray-500 mb-2">
                <LogIn className="w-4 h-4" />
                <span className="text-sm">Please log in to use the dashboard assistant</span>
              </div>
            </div>
          ) : (
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask me anything..."
                disabled={isLoading}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !inputValue.trim()}
                className="bg-gradient-to-r from-teal-500 to-purple-600 text-white p-2 rounded-lg hover:shadow-lg transition-all duration-300 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatbotPopup;
