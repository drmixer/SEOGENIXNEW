import React, { useState } from 'react';
import DashboardHeader from './DashboardHeader';
import Sidebar from './Sidebar';
import VisibilityScore from './VisibilityScore';
import ToolsGrid from './ToolsGrid';
import ChatbotPopup from './ChatbotPopup';

interface DashboardProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  onNavigateToLanding: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ userPlan, onNavigateToLanding }) => {
  const [showChatbot, setShowChatbot] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');

  // Enable chatbot for all users during development
  const isDevelopment = true; // Set to false for production
  const canAccessChatbot = isDevelopment || userPlan !== 'free';

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader 
        userPlan={userPlan}
        onNavigateToLanding={onNavigateToLanding}
      />
      
      <div className="flex">
        <Sidebar 
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          userPlan={userPlan}
        />
        
        <main className="flex-1 p-8">
          {activeSection === 'overview' && (
            <div className="space-y-8">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard Overview</h1>
                <p className="text-gray-600">Monitor your AI visibility performance and access optimization tools.</p>
              </div>
              
              <VisibilityScore userPlan={userPlan} />
              <ToolsGrid userPlan={userPlan} />
            </div>
          )}
          
          {activeSection !== 'overview' && (
            <div className="bg-white rounded-xl shadow-sm p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {activeSection.charAt(0).toUpperCase() + activeSection.slice(1).replace('-', ' ')}
              </h2>
              <p className="text-gray-600">
                This section is under development. Advanced {activeSection.replace('-', ' ')} features will be available soon.
              </p>
            </div>
          )}
        </main>
      </div>
      
      {/* Floating chatbot button */}
      {canAccessChatbot && (
        <button
          onClick={() => setShowChatbot(true)}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 z-40"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}

      {showChatbot && canAccessChatbot && (
        <ChatbotPopup 
          onClose={() => setShowChatbot(false)}
          type="dashboard"
          userPlan={userPlan}
        />
      )}
    </div>
  );
};

export default Dashboard;