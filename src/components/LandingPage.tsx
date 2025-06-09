import React, { useState } from 'react';
import Header from './Header';
import Hero from './Hero';
import Features from './Features';
import HowItWorks from './HowItWorks';
import Pricing from './Pricing';
import FAQ from './FAQ';
import Footer from './Footer';
import ChatbotPopup from './ChatbotPopup';

interface LandingPageProps {
  onNavigateToDashboard: () => void;
  onPlanSelect: (plan: 'free' | 'core' | 'pro' | 'agency') => void;
  user?: any;
  onShowSignup: () => void;
  onShowLogin: () => void;
  onSignOut: () => void;
  initialView?: 'landing' | 'pricing';
  onNavigateToLanding: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ 
  onNavigateToDashboard, 
  onPlanSelect, 
  user, 
  onShowSignup,
  onShowLogin,
  onSignOut,
  initialView = 'landing',
  onNavigateToLanding
}) => {
  const [showChatbot, setShowChatbot] = useState(false);
  const [currentSection, setCurrentSection] = useState(initialView);

  useEffect(() => {
    setCurrentSection(initialView);
  }, [initialView]);

  useEffect(() => {
    if (initialView === 'pricing') {
      // Scroll to pricing section
      setTimeout(() => {
        const pricingElement = document.getElementById('pricing');
        if (pricingElement) {
          pricingElement.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }, [initialView]);

  return (
    <div className="min-h-screen bg-white">
      <Header 
        onNavigateToDashboard={onNavigateToDashboard}
        user={user}
        onShowSignup={onShowSignup}
        onShowLogin={onShowLogin}
        onSignOut={onSignOut}
        onNavigateToLanding={onNavigateToLanding}
      />
      {currentSection === 'landing' && (
        <>
          <Hero 
            onNavigateToDashboard={onNavigateToDashboard}
            user={user}
            onShowSignup={onShowSignup}
          />
          <Features />
          <HowItWorks />
        </>
      )}
      <Pricing onPlanSelect={onPlanSelect} />
      {currentSection === 'landing' && (
        <>
          <FAQ />
          <Footer />
        </>
      )}
      
      {/* Floating chatbot button */}
      <button
        onClick={() => setShowChatbot(true)}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 z-40"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>

      {showChatbot && (
        <ChatbotPopup 
          onClose={() => setShowChatbot(false)}
          type="landing"
        />
      )}
    </div>
  );
};

export default LandingPage;