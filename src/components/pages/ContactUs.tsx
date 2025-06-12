import React, { useState } from 'react';
import { Mail, Phone, MapPin, MessageSquare, Send, CheckCircle } from 'lucide-react';

const ContactUs = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    company: '',
    website: ''
  });
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate form submission
    setTimeout(() => {
      setLoading(false);
      setFormSubmitted(true);
      // Reset form after submission
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: '',
        company: '',
        website: ''
      });
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 py-20 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-6">
              Contact Us
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Have questions about SEOGENIX? Our team is here to help you optimize your AI visibility.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Get in Touch</h2>
            
            {formSubmitted ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-green-800 mb-2">Message Sent!</h3>
                <p className="text-green-700 mb-4">
                  Thank you for contacting us. We've received your message and will get back to you within 24 hours.
                </p>
                <button 
                  onClick={() => setFormSubmitted(false)}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name
                    </label>
                    <input
                      type="text"
                      id="company"
                      name="company"
                      value={formData.company}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1">
                      Website URL
                    </label>
                    <input
                      type="url"
                      id="website"
                      name="website"
                      value={formData.website}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select a subject</option>
                    <option value="general">General Inquiry</option>
                    <option value="sales">Sales Question</option>
                    <option value="support">Technical Support</option>
                    <option value="billing">Billing & Subscription</option>
                    <option value="partnership">Partnership Opportunity</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  ></textarea>
                </div>
                
                <div className="flex items-center">
                  <input
                    id="privacy"
                    type="checkbox"
                    required
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  />
                  <label htmlFor="privacy" className="ml-2 block text-sm text-gray-700">
                    I agree to the <a href="#" className="text-purple-600 hover:text-purple-700">Privacy Policy</a> and consent to being contacted about my inquiry.
                  </label>
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-70 flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Message
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
          
          {/* Contact Information */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Contact Information</h2>
            
            <div className="space-y-6 mb-8">
              <div className="flex items-start">
                <div className="flex-shrink-0 bg-purple-100 p-3 rounded-lg">
                  <Mail className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Email</h3>
                  <p className="text-gray-600 mt-1">
                    <a href="mailto:info@seogenix.com" className="hover:text-purple-600">info@seogenix.com</a>
                  </p>
                  <p className="text-gray-500 text-sm mt-1">For general inquiries</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0 bg-teal-100 p-3 rounded-lg">
                  <MessageSquare className="w-6 h-6 text-teal-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Live Chat</h3>
                  <p className="text-gray-600 mt-1">Available Monday-Friday</p>
                  <p className="text-gray-500 text-sm mt-1">9am-5pm ET / 6am-2pm PT</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0 bg-blue-100 p-3 rounded-lg">
                  <Phone className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Phone</h3>
                  <p className="text-gray-600 mt-1">
                    <a href="tel:+18005551234" className="hover:text-purple-600">+1 (800) 555-1234</a>
                  </p>
                  <p className="text-gray-500 text-sm mt-1">For Pro and Agency plans</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0 bg-indigo-100 p-3 rounded-lg">
                  <MapPin className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Office</h3>
                  <p className="text-gray-600 mt-1">
                    123 AI Avenue, Suite 500<br />
                    San Francisco, CA 94103
                  </p>
                  <p className="text-gray-500 text-sm mt-1">By appointment only</p>
                </div>
              </div>
            </div>
            
            {/* Office Hours */}
            <div className="bg-gray-50 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Business Hours</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Monday - Friday</span>
                  <span className="text-gray-900 font-medium">9:00 AM - 6:00 PM ET</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Saturday</span>
                  <span className="text-gray-900 font-medium">10:00 AM - 2:00 PM ET</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Sunday</span>
                  <span className="text-gray-900 font-medium">Closed</span>
                </div>
              </div>
            </div>
            
            {/* FAQ */}
            <div className="bg-gradient-to-r from-teal-50 to-purple-50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Frequently Asked Questions</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900">What is the typical response time?</h4>
                  <p className="text-gray-600 text-sm mt-1">We respond to all inquiries within 24 hours during business days.</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Do you offer custom solutions?</h4>
                  <p className="text-gray-600 text-sm mt-1">Yes, our team can develop custom solutions for enterprise clients. Contact our sales team for details.</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">How do I upgrade my plan?</h4>
                  <p className="text-gray-600 text-sm mt-1">You can upgrade your plan directly from your account dashboard or contact our sales team for assistance.</p>
                </div>
              </div>
              <div className="mt-4">
                <a href="/help-center" className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center">
                  View all FAQs
                  <ArrowRight className="w-4 h-4 ml-1" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;