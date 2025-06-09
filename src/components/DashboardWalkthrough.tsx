import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowRight, Target, FileText, BarChart3, MessageSquare } from 'lucide-react';

interface DashboardWalkthroughProps {
  onComplete: () => void;
  onSkip: () => void;
}

const DashboardWalkthrough: React.FC<DashboardWalkthroughProps> = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipPosition, setTooltipPosition] = useState({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
  const tooltipRef = useRef<HTMLDivElement>(null);

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

  const calculateTooltipPosition = () => {
    if (!currentStepData.target || currentStepData.position === 'center') {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
    
    const element = document.querySelector(currentStepData.target);
    if (!element || !tooltipRef.current) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
    
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const tooltipWidth = 400; // Fixed width for consistency
    const tooltipHeight = tooltipRect.height || 250; // Use actual height or fallback
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 20;
    
    let top = rect.top + rect.height / 2 - tooltipHeight / 2;
    let left = rect.right + padding;
    let transform = 'none';
    
    // Adjust based on preferred position
    if (currentStepData.position === 'left') {
      left = rect.left - tooltipWidth - padding;
    } else if (currentStepData.position === 'top') {
      top = rect.top - tooltipHeight - padding;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
    } else if (currentStepData.position === 'bottom') {
      top = rect.bottom + padding;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
    }
    
    // Ensure tooltip stays within viewport bounds
    if (left < padding) {
      left = padding;
    } else if (left + tooltipWidth > viewportWidth - padding) {
      left = viewportWidth - tooltipWidth - padding;
    }
    
    if (top < padding) {
      top = padding;
    } else if (top + tooltipHeight > viewportHeight - padding) {
      top = viewportHeight - tooltipHeight - padding;
    }
    
    // If still doesn't fit, center it
    if (left < padding || left + tooltipWidth > viewportWidth - padding || 
        top < padding || top + tooltipHeight > viewportHeight - padding) {
      return { 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)',
        maxHeight: `${viewportHeight - 100}px`,
        overflow: 'auto'
      };
    }
    
    return { 
      top: `${Math.max(padding, top)}px`, 
      left: `${Math.max(padding, left)}px`,
      transform: 'none'
    };
  };

  const updateTooltipPosition = () => {
    const newPosition = calculateTooltipPosition();
    setTooltipPosition(newPosition);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      console.log('Walkthrough completed - calling onComplete');
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Update position when step changes or window resizes
  useEffect(() => {
    const updatePosition = () => {
      // Small delay to ensure DOM is updated
      setTimeout(updateTooltipPosition, 50);
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [currentStep]);

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
        // Scroll element into view if needed
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'center'
        });
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
        ref={tooltipRef}
        className="fixed z-[60] bg-white rounded-xl shadow-2xl border border-gray-200 p-6 w-96 max-w-[calc(100vw-40px)]"
        style={tooltipPosition}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-teal-500 to-purple-600 p-2 rounded-lg flex-shrink-0">
              <currentStepData.icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{currentStepData.title}</h3>
              <p className="text-sm text-gray-500">Step {currentStep + 1} of {steps.length}</p>
            </div>
          </div>
          <button
            onClick={onSkip}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-gray-600 mb-6 leading-relaxed text-sm">
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
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Previous
              </button>
            )}
            <button
              onClick={handleNext}
              className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 flex items-center space-x-2 text-sm"
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
          z-index: 51 !important;
          box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.3), 0 0 20px rgba(139, 92, 246, 0.2) !important;
          border-radius: 8px !important;
        }
      `}</style>
    </>
  );
};

export default DashboardWalkthrough;