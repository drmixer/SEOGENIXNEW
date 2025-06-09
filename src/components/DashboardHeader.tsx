import React from 'react';
import { ArrowLeft, Settings, User, LogOut } from 'lucide-react';

interface DashboardHeaderProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  onNavigateToLanding: () => void;
  user: any;
  onSignOut: () => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ userPlan, onNavigateToLanding, user, onSignOut }) => {
  const planColors = {
    free: 'bg-gray-100 text-gray-700',
    core: 'bg-blue-100 text-blue-700',
    pro: 'bg-purple-100 text-purple-700',
    agency: 'bg-gradient-to-r from-teal-500 to-purple-600 text-white'
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onNavigateToLanding}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </button>
            
            <div className="h-6 w-px bg-gray-300"></div>
            
            <div className="flex items-center">
              <img 
                src="https://i.imgur.com/Zpdxdyj.png" 
                alt="SEOGENIX" 
                className="h-12 w-auto"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${planColors[userPlan]}`}>
              {userPlan.charAt(0).toUpperCase() + userPlan.slice(1)} Plan
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <User className="w-4 h-4" />
              <span>{user?.user_metadata?.full_name || user?.email}</span>
            </div>
            
            <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            
            <button 
              onClick={onSignOut}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;