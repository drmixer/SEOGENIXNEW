import React from 'react';

interface HeaderProps {
  onNavigateToDashboard: () => void;
}

const Header: React.FC<HeaderProps> = ({ onNavigateToDashboard }) => {
  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center space-x-4">
            <img 
              src="https://i.imgur.com/Zpdxdyj.png" 
              alt="SEOGENIX" 
              className="h-16 w-auto"
            />
            <span className="text-3xl font-bold text-gray-900">SEOGENIX</span>
          </div>
          
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Features</a>
            <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
            <a href="#faq" className="text-gray-600 hover:text-gray-900 transition-colors">FAQ</a>
            <button 
              onClick={onNavigateToDashboard}
              className="bg-gradient-to-r from-teal-500 to-blue-600 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all duration-300"
            >
              Dashboard
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;