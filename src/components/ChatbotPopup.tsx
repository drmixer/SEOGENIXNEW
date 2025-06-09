import React, { useState, useEffect } from 'react';
import { X, Send, Sparkles, Loader } from 'lucide-react';
import { apiService } from '../services/api';

interface ChatbotPopupProps {
  onClose: () => void;
  type: 'landing' | 'dashboard';
  userPlan?: 'free' | 'core' | 'pro' | 'agency';
}

interface Message {
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

const ChatbotPopup: React.FC<ChatbotPopupProps> = ({ onClose, type, userPlan }) => {
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

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

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
        conversationHistory
      );

      const botMessage: Message = {
        type: 'bot',
        content: response.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);

      // Add proactive suggestions if any
      if (response.proactiveSuggestions && response.proactiveSuggestions.length > 0) {
        setTimeout(() => {
          const suggestionMessage: Message = {
            type: 'bot',
            content: `💡 Suggestion: ${response.proactiveSuggestions[0]}`,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, suggestionMessage]);
        }, 2000);
      }

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        type: 'bot',
        content: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-end p-6 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md h-96 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-2 rounded-full">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Genie</h3>
              <p className="text-sm text-gray-500">AI Assistant</p>
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
            <div
              key={index}
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
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-900 p-3 rounded-2xl">
                <Loader className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200">
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
        </div>
      </div>
    </div>
  );
};

export default ChatbotPopup;