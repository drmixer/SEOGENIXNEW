import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

interface HeroProps {
  onNavigateToDashboard: () => void;
}

const Hero: React.FC<HeroProps> = ({ onNavigateToDashboard }) => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-gray-50 to-white py-20 lg:py-32">
      <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 to-purple-600/5"></div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="flex items-center space-x-2 bg-gradient-to-r from-teal-500 to-purple-600 text-white px-4 py-2 rounded-full text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              <span>AI-Powered SEO Platform</span>
            </div>
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-bold text-gray-900 mb-6">
            Smart SEO.{' '}
            <span className="bg-gradient-to-r from-teal-500 to-purple-600 bg-clip-text text-transparent">
              AI Visibility.
            </span>{' '}
            Elevated.
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            Built for a world where AI generates answers. Optimize your content for LLMs, chatbots, 
            and voice assistants with our comprehensive AI visibility platform.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={onNavigateToDashboard}
              className="bg-gradient-to-r from-teal-500 to-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:shadow-xl transition-all duration-300 flex items-center justify-center space-x-2"
            >
              <span>Start for Free</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <a 
              href="#pricing"
              className="border-2 border-purple-600 text-purple-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-purple-600 hover:text-white transition-all duration-300"
            >
              See Plans
            </a>
          </div>
          
          <div className="mt-12 flex justify-center">
            <div className="bg-white p-2 rounded-xl shadow-2xl">
              <img 
                src="https://images.pexels.com/photos/265087/pexels-photo-265087.jpeg?auto=compress&cs=tinysrgb&w=800" 
                alt="SEOGENIX Dashboard Preview" 
                className="rounded-lg w-full max-w-4xl h-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;