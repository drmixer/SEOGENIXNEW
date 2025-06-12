import React from 'react';
import { Link } from 'react-router-dom';

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
              <li><Link to="/features" className="text-gray-600 hover:text-gray-900 transition-colors">Features</Link></li>
              <li><Link to="/pricing" className="text-gray-600 hover:text-gray-900 transition-colors">Pricing</Link></li>
              <li><Link to="/integrations" className="text-gray-600 hover:text-gray-900 transition-colors">Integrations</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Support</h3>
            <ul className="space-y-2">
              <li><Link to="/help-center" className="text-gray-600 hover:text-gray-900 transition-colors">Help Center</Link></li>
              <li><Link to="/documentation" className="text-gray-600 hover:text-gray-900 transition-colors">Documentation</Link></li>
              <li><Link to="/contact-us" className="text-gray-600 hover:text-gray-900 transition-colors">Contact Us</Link></li>
              <li><Link to="/status" className="text-gray-600 hover:text-gray-900 transition-colors">Status</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-300 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-600 text-sm">
            © 2025 SEOGENIX. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <Link to="/privacy-policy" className="text-gray-600 hover:text-gray-900 text-sm transition-colors">Privacy Policy</Link>
            <Link to="/terms-of-service" className="text-gray-600 hover:text-gray-900 text-sm transition-colors">Terms of Service</Link>
            <Link to="/cookie-policy" className="text-gray-600 hover:text-gray-900 text-sm transition-colors">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;