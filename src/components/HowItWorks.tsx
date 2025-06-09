import React from 'react';
import { Search, Zap, TrendingUp } from 'lucide-react';

const HowItWorks = () => {
  const steps = [
    {
      icon: Search,
      title: 'Analyze',
      description: 'Scan your content and get detailed AI visibility scores with actionable insights.'
    },
    {
      icon: Zap,
      title: 'Optimize',
      description: 'Use our AI-powered tools to enhance content structure, schema, and readability.'
    },
    {
      icon: TrendingUp,
      title: 'Track',
      description: 'Monitor citations, mentions, and visibility improvements across AI platforms.'
    }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            How SEOGENIX Works
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Simple, powerful workflow to transform your SEO strategy for the AI era.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {steps.map((step, index) => {
            const IconComponent = step.icon;
            return (
              <div key={index} className="text-center relative">
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-teal-500 to-purple-600 transform -translate-x-1/2"></div>
                )}
                
                <div className="relative">
                  <div className="bg-gradient-to-r from-teal-500 to-purple-600 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                    <IconComponent className="w-12 h-12 text-white" />
                  </div>
                  <div className="absolute top-2 right-2 bg-white text-purple-600 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                </div>
                
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;