import React from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-gray-50 text-gray-800 py-16 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center mb-6">
              <img 
                src="https://i.imgur.com/Zpdxdyj.png" 
                alt="SEOGENIX" 
                className="h-16 w-auto"
              />
            </div>
            <p className="text-gray-600 mb-6 max-w-md">
              The world's first comprehensive AI visibility platform. Optimize your content 
              for the future of search and discovery.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Product</h3>
            <ul className="space-y-2">
              <li><a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Features</a></li>
              <li><a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">Pricing</a></li>
              <li><a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">Integrations</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Support</h3>
            <ul className="space-y-2">
              <li><a href="/help" className="text-gray-600 hover:text-gray-900 transition-colors">Help Center</a></li>
              <li><a href="/docs" className="text-gray-600 hover:text-gray-900 transition-colors">Documentation</a></li>
              <li><a href="/contact" className="text-gray-600 hover:text-gray-900 transition-colors">Contact Us</a></li>
              <li><a href="/status" className="text-gray-600 hover:text-gray-900 transition-colors">Status</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-300 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-600 text-sm">
            © 2025 SEOGENIX. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="/privacy" className="text-gray-600 hover:text-gray-900 text-sm transition-colors">Privacy Policy</a>
            <a href="/terms" className="text-gray-600 hover:text-gray-900 text-sm transition-colors">Terms of Service</a>
            <a href="/cookies" className="text-gray-600 hover:text-gray-900 text-sm transition-colors">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;