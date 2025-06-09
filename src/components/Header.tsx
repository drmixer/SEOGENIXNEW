import React from 'react';
import { LogIn, LogOut, User } from 'lucide-react';

interface HeaderProps {
  onNavigateToDashboard: () => void;
  user?: any;
  onShowSignup: () => void;
  onShowLogin: () => void;
  onSignOut: () => void;
  onNavigateToLanding?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onNavigateToDashboard, user, onShowSignup, onShowLogin, onSignOut, onNavigateToLanding }) => {
  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-32">
          <div className="flex items-center cursor-pointer\" onClick={onNavigateToLanding}>
            <img 
              src="https://i.imgur.com/Zpdxdyj.png" 
              alt="SEOGENIX" 
              className="h-28 w-auto"
            />
          </div>
          
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Features</a>
            <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
            <a href="#faq" className="text-gray-600 hover:text-gray-900 transition-colors">FAQ</a>
            
            {user ? (
              <div className="flex items-center space-x-4">
                <button 
                  onClick={onNavigateToDashboard}
                  className="bg-gradient-to-r from-teal-500 to-blue-600 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all duration-300"
                >
                  Dashboard
                </button>
                <div className="flex items-center space-x-2">
                  <div className="bg-gray-100 p-2 rounded-full">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                  <span className="text-sm text-gray-600">{user.email}</span>
                  <button
                    onClick={onSignOut}
                    className="text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <button
                  onClick={onShowLogin}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </button>
                <button 
                  onClick={onShowSignup}
                  className="bg-gradient-to-r from-teal-500 to-blue-600 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all duration-300"
                >
                  Get Started
                </button>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header