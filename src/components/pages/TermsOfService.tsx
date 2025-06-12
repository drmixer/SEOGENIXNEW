import React from 'react';
import { FileText, AlertTriangle, CheckCircle, Shield, Clock } from 'lucide-react';

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 py-16 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Terms of Service
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Last updated: June 1, 2025
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="prose prose-lg max-w-none">
          <div className="flex items-center mb-8">
            <FileText className="w-8 h-8 text-purple-600 mr-4" />
            <p className="text-gray-700 italic">
              Please read these Terms of Service ("Terms") carefully before using the SEOGENIX platform. These Terms govern your access to and use of our services.
            </p>
          </div>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using SEOGENIX, you agree to be bound by these Terms and our Privacy Policy. If you do not agree to these Terms, you may not access or use our services.
          </p>

          <h2>2. Description of Services</h2>
          <p>
            SEOGENIX provides AI-powered SEO tools and services designed to optimize content for AI visibility, including but not limited to:
          </p>
          <ul>
            <li>AI Visibility Audits</li>
            <li>Schema Generation</li>
            <li>Citation Tracking</li>
            <li>Voice Assistant Testing</li>
            <li>Content Optimization</li>
            <li>Competitive Analysis</li>
            <li>Reporting and Analytics</li>
          </ul>

          <h2>3. Account Registration and Security</h2>
          <p>
            To use certain features of our services, you must register for an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete.
          </p>
          <p>
            You are responsible for safeguarding your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account or any other breach of security.
          </p>

          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 my-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Account Security</h3>
                <div className="text-sm text-yellow-700">
                  <p>
                    You are responsible for maintaining the confidentiality of your account credentials. We recommend using strong, unique passwords and enabling two-factor authentication when available.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <h2>4. Subscription and Payments</h2>
          <p>
            SEOGENIX offers various subscription plans with different features and limitations. By selecting a paid subscription, you agree to pay the applicable fees as they become due.
          </p>
          <p>
            Subscription fees are billed in advance on a monthly or annual basis, depending on your selected billing cycle. Unless otherwise stated, subscriptions automatically renew at the end of each billing period.
          </p>
          <p>
            You may cancel your subscription at any time through your account settings or by contacting our support team. Upon cancellation, your subscription will remain active until the end of your current billing period.
          </p>

          <h2>5. User Content and Licenses</h2>
          <p>
            Our services may allow you to upload, submit, store, send, or receive content ("User Content"). You retain ownership of any intellectual property rights that you hold in that User Content.
          </p>
          <p>
            By uploading User Content to our services, you grant SEOGENIX a worldwide, non-exclusive, royalty-free license to use, host, store, reproduce, modify, create derivative works, communicate, publish, publicly perform, publicly display, and distribute such User Content for the limited purpose of operating, promoting, and improving our services.
          </p>

          <h2>6. Acceptable Use</h2>
          <p>
            You agree not to misuse our services. You may use our services only as permitted by law and these Terms. You agree not to:
          </p>
          <ul>
            <li>Use our services for any illegal purpose or in violation of any laws</li>
            <li>Violate or infringe other people's intellectual property, privacy, or other rights</li>
            <li>Engage in any activity that interferes with or disrupts our services</li>
            <li>Attempt to bypass or break any security mechanism on our services</li>
            <li>Use automated methods to access or use our services without our permission</li>
            <li>Impersonate any person or entity, or falsely state or misrepresent your affiliation</li>
            <li>Collect or harvest any information from our services</li>
            <li>Transmit any viruses, malware, or other types of malicious code</li>
          </ul>

          <h2>7. Intellectual Property Rights</h2>
          <p>
            SEOGENIX and its licensors exclusively own all right, title, and interest in and to the services, including all associated intellectual property rights. You may not remove, alter, or obscure any copyright, trademark, service mark, or other proprietary rights notices incorporated in or accompanying the services.
          </p>

          <h2>8. Termination</h2>
          <p>
            We may suspend or terminate your access to all or part of our services, with or without notice, for conduct that we believe violates these Terms or is harmful to other users of our services, our business, or third parties, or for any other reason.
          </p>
          <p>
            Upon termination, your right to use our services will immediately cease. All provisions of these Terms which by their nature should survive termination shall survive, including ownership provisions, warranty disclaimers, indemnity, and limitations of liability.
          </p>

          <h2>9. Disclaimers</h2>
          <p>
            THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
          </p>
          <p>
            SEOGENIX DOES NOT WARRANT THAT THE SERVICES ARE ERROR-FREE OR THAT ACCESS THERETO WILL BE UNINTERRUPTED. YOU UNDERSTAND THAT YOU DOWNLOAD FROM, OR OTHERWISE OBTAIN CONTENT OR SERVICES THROUGH, OUR SERVICES AT YOUR OWN DISCRETION AND RISK.
          </p>

          <h2>10. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL SEOGENIX, ITS AFFILIATES, DIRECTORS, EMPLOYEES, AGENTS, SUPPLIERS OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE SERVICES.
          </p>

          <h2>11. Indemnification</h2>
          <p>
            You agree to defend, indemnify, and hold harmless SEOGENIX, its affiliates, licensors, and service providers, and its and their respective officers, directors, employees, contractors, agents, licensors, suppliers, successors, and assigns from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, or fees (including reasonable attorneys' fees) arising out of or relating to your violation of these Terms or your use of the services.
          </p>

          <h2>12. Governing Law and Jurisdiction</h2>
          <p>
            These Terms and your use of the services shall be governed by and construed in accordance with the laws of the State of California, without giving effect to any choice or conflict of law provision or rule.
          </p>
          <p>
            Any legal suit, action, or proceeding arising out of, or related to, these Terms or the services shall be instituted exclusively in the federal courts of the United States or the courts of the State of California, in each case located in San Francisco County. You waive any and all objections to the exercise of jurisdiction over you by such courts and to venue in such courts.
          </p>

          <h2>13. Changes to Terms</h2>
          <p>
            We may revise these Terms from time to time. The most current version will always be posted on our website. If a revision, in our sole discretion, is material, we will notify you via email to the email address associated with your account or through the services. By continuing to access or use the services after revisions become effective, you agree to be bound by the revised Terms.
          </p>

          <h2>14. Contact Information</h2>
          <p>
            If you have any questions about these Terms, please contact us at:
          </p>
          <ul>
            <li>Email: <a href="mailto:legal@seogenix.com">legal@seogenix.com</a></li>
            <li>Address: 123 AI Avenue, Suite 500, San Francisco, CA 94103</li>
            <li>Phone: +1 (800) 555-1234</li>
          </ul>

          <div className="flex items-center mt-12 pt-8 border-t border-gray-200">
            <CheckCircle className="w-8 h-8 text-green-600 mr-4" />
            <p className="text-gray-700">
              By using SEOGENIX, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;