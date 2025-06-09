import React, { useState } from 'react';
import { X, Send, Sparkles } from 'lucide-react';

interface ChatbotPopupProps {
  onClose: () => void;
  type: 'landing' | 'dashboard';
}

const ChatbotPopup: React.FC<ChatbotPopupProps> = ({ onClose, type }) => {
  const [messages, setMessages] = useState([
    {
      type: 'bot',
      content: type === 'landing' 
        ? "Hi! I'm Genie, your AI assistant. I can help you understand SEOGENIX features, pricing plans, and how AI visibility works. What would you like to know?"
        : "Hi! I'm Genie, your AI guide. I can help explain your audit results, suggest optimizations, and answer questions about your AI visibility performance. How can I assist you today?"
    }
  ]);
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (!inputValue.trim()) return;

    setMessages(prev => [...prev, { type: 'user', content: inputValue }]);
    
    // Simulate AI response
    setTimeout(() => {
      let response = '';
      const lower = inputValue.toLowerCase();
      
      if (type === 'landing') {
        if (lower.includes('pricing') || lower.includes('plan')) {
          response = "We have 4 plans: Free (try basic tools), Core ($29/mo - full audits), Pro ($79/mo - advanced optimization with full chatbot), and Agency ($199/mo - team access). Annual billing saves 25%. Which plan interests you?";
        } else if (lower.includes('ai visibility')) {
          response = "AI visibility is how well your content is structured for AI systems like ChatGPT and voice assistants. It's measured 0-100 with subscores for AI Understanding, Citation Likelihood, and Content Structure Quality. Want to learn about specific tools?";
        } else if (lower.includes('difference') || lower.includes('compare')) {
          response = "SEOGENIX is built for the AI era, not just traditional search engines. We optimize for LLMs, track AI citations, test voice assistants, and provide tools specifically for AI-driven discovery. Traditional SEO tools don't address these new challenges.";
        } else {
          response = "I can help with questions about our pricing plans, AI visibility features, how SEOGENIX works, or specific tools. What would you like to explore?";
        }
      } else {
        if (lower.includes('score') || lower.includes('visibility')) {
          response = "Your AI Visibility Score shows how well AI systems understand your content. Check the subscores for specific areas to improve: AI Understanding, Citation Likelihood, Conversational Readiness, and Content Structure Quality.";
        } else if (lower.includes('improve') || lower.includes('optimize')) {
          response = "Based on your audit, I recommend starting with Schema Generator for better structure, then use AI Content Optimizer for key pages. The Citation Tracker will help monitor your progress. Need help with a specific tool?";
        } else {
          response = "I can help explain your audit results, suggest improvements, or guide you through any of our tools. What specific area would you like to work on?";
        }
      }
      
      setMessages(prev => [...prev, { type: 'bot', content: response }]);
    }, 1000);
    
    setInputValue('');
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
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-4 border-t border-gray-200">
          <div className="flex space-x-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask me anything..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={handleSend}
              className="bg-gradient-to-r from-teal-500 to-purple-600 text-white p-2 rounded-lg hover:shadow-lg transition-all duration-300"
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