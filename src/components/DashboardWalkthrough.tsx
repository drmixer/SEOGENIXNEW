import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Target, FileText, BarChart3, MessageSquare } from 'lucide-react';

interface DashboardWalkthroughProps {
  onComplete: () => void;
  onSkip: () => void;
}

const DashboardWalkthrough: React.FC<DashboardWalkthroughProps> = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: 'Welcome to Your Dashboard!',
      description: 'Let\'s take a quick tour of the key features that will help you optimize your content for AI visibility.',
      icon: Target,
      target: null,
      position: 'center'
    },
    {
      title: 'AI Visibility Audit',
      description: 'Start here! Run comprehensive audits to see how well your content is structured for AI systems like ChatGPT and voice assistants.',
      icon: FileText,
      target: '[data-walkthrough="audit-tool"]',
      position: 'right'
    },
    {
      title: 'Sidebar Navigation',
      description: 'Access all your optimization tools from the sidebar. Each tool helps improve different aspects of your AI visibility.',
      icon: BarChart3,
      target: '[data-walkthrough="sidebar"]',
      position: 'right'
    },
    {
      title: 'AI Assistant - Genie',
      description: 'Need help? Click the chat button to talk with Genie, your AI assistant who can explain results and provide optimization tips.',
      icon: MessageSquare,
      target: '[data-walkthrough="chatbot"]',
      position: 'left'
    }
  ];

  const currentStepData = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Position the tooltip based on target element
  const getTooltipPosition = () => {
    if (!currentStepData.target) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    
    const element = document.querySelector(currentStepData.target);
    if (!element) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    
    const rect = element.getBoundingClientRect();
    const tooltipWidth = 400;
    const tooltipHeight = 200;
    
    let top = rect.top + rect.height / 2;
    let left = rect.right + 20;
    
    if (currentStepData.position === 'left') {
      left = rect.left - tooltipWidth - 20;
    } else if (currentStepData.position === 'center') {
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      top = rect.bottom + 20;
    }
    
    // Ensure tooltip stays within viewport
    if (left + tooltipWidth > window.innerWidth) {
      left = window.innerWidth - tooltipWidth - 20;
    }
    if (left < 20) {
      left = 20;
    }
    if (top + tooltipHeight > window.innerHeight) {
      top = rect.top - tooltipHeight - 20;
    }
    
    return { top: `${top}px`, left: `${left}px` };
  };

  // Add highlight to target element
  useEffect(() => {
    const removeHighlights = () => {
      document.querySelectorAll('.walkthrough-highlight').forEach(el => {
        el.classList.remove('walkthrough-highlight');
      });
    };

    removeHighlights();

    if (currentStepData.target) {
      const element = document.querySelector(currentStepData.target);
      if (element) {
        element.classList.add('walkthrough-highlight');
      }
    }

    return removeHighlights;
  }, [currentStep]);

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" />
      
      {/* Tooltip */}
      <div 
        className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-6 max-w-sm"
        style={currentStepData.position === 'center' ? 
          { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' } : 
          getTooltipPosition()
        }
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-teal-500 to-purple-600 p-2 rounded-lg">
              <currentStepData.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{currentStepData.title}</h3>
              <p className="text-sm text-gray-500">Step {currentStep + 1} of {steps.length}</p>
            </div>
          </div>
          <button
            onClick={onSkip}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-gray-600 mb-6 leading-relaxed">
          {currentStepData.description}
        </p>
        
        <div className="flex items-center justify-between">
          <div className="flex space-x-1">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index === currentStep ? 'bg-purple-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
          
          <div className="flex items-center space-x-3">
            {currentStep > 0 && (
              <button
                onClick={handlePrevious}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                Previous
              </button>
            )}
            <button
              onClick={handleNext}
              className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 flex items-center space-x-2"
            >
              <span>{currentStep === steps.length - 1 ? 'Get Started' : 'Next'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {currentStep === 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={onSkip}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Skip tour and explore on my own
            </button>
          </div>
        )}
      </div>
      
      {/* CSS for highlighting */}
      <style jsx>{`
        .walkthrough-highlight {
          position: relative;
          z-index: 51;
          box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.3), 0 0 20px rgba(139, 92, 246, 0.2);
          border-radius: 8px;
        }
      `}</style>
    </>
  );
};

export default DashboardWalkthrough;