import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: 'What is AI visibility and why does it matter?',
      answer: 'AI visibility refers to how well your content is structured and optimized for AI systems like ChatGPT, Google Bard, and voice assistants. As more people use AI to find information, traditional SEO isn\'t enough. Your content needs to be easily understood and cited by AI systems.'
    },
    {
      question: 'How is SEOGENIX different from traditional SEO tools?',
      answer: 'While traditional SEO tools focus on search engines, SEOGENIX is built for the AI era. We analyze how LLMs understand your content, track AI citations, optimize for voice assistants, and provide tools specifically designed for AI-driven search and discovery.'
    },
    {
      question: 'What is the AI Visibility Score?',
      answer: 'Our proprietary 0-100 score that measures how well your content is structured for AI systems. It includes subscores for AI Understanding, Citation Likelihood, Conversational Readiness, and Content Structure Quality, giving you actionable insights to improve your AI presence.'
    },
    {
      question: 'Can I track when AI systems mention my content?',
      answer: 'Yes! Our Citation Tracker monitors mentions across LLMs, Google\'s AI features, Reddit discussions, and other platforms. You\'ll get alerts when your content is cited, helping you understand your AI reach and impact.'
    },
    {
      question: 'What is Genie and how does it help?',
      answer: 'Genie is our AI assistant that guides you through the platform. Depending on your plan, Genie can explain tool functions, analyze audit results, suggest improvements, and proactively surface insights about your AI visibility performance.'
    },
    {
      question: 'Do you offer team and agency features?',
      answer: 'Yes! Our Agency plan includes multi-site management, team collaboration, client reporting, white-label options, and dedicated support. Perfect for agencies managing multiple clients\' AI visibility strategies.'
    },
    {
      question: 'How quickly will I see results?',
      answer: 'You can start improving immediately with our audit insights and optimization tools. AI citation tracking and visibility improvements typically show results within 2-4 weeks, as AI systems update their knowledge bases.'
    },
    {
      question: 'Is there a free trial?',
      answer: 'Yes! Our Free plan lets you explore core features and get basic AI visibility scores. You can upgrade anytime to access advanced tools, detailed analytics, and full Genie chatbot support.'
    }
  ];

  return (
    <section id="faq" className="py-20 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-600">
            Everything you need to know about AI visibility and SEOGENIX.
          </p>
        </div>
        
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div 
              key={index}
              className="bg-gray-50 rounded-lg border border-gray-100 overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <h3 className="text-lg font-semibold text-gray-900">{faq.question}</h3>
                {openIndex === index ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>
              
              {openIndex === index && (
                <div className="px-6 pb-4">
                  <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;