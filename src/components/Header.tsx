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
  const handleSignOut = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Sign out button clicked in Header');
    onSignOut();
  };

  // Safely extract user display info
  const getUserDisplayName = () => {
    if (!user) return 'Guest';
    
    if (user.user_metadata?.full_name) {
      return user.user_metadata.full_name;
    }
    
    if (user.email) {
      return user.email;
    }
    
    return 'User';
  };

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-32">
          <div className="flex items-center cursor-pointer" onClick={onNavigateToLanding}>
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
                  <span className="text-sm text-gray-600">{getUserDisplayName()}</span>
                  <button
                    onClick={handleSignOut}
                    className="text-gray-600 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
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
                <a 
                  href="#pricing"
                  className="bg-gradient-to-r from-teal-500 to-blue-600 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all duration-300"
                >
                  Get Started
                </a>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;