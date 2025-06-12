import React from 'react';
import { Shield, Eye, Database, Lock, FileText } from 'lucide-react';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 py-16 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Privacy Policy
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
            <Shield className="w-8 h-8 text-purple-600 mr-4" />
            <p className="text-gray-700 italic">
              At SEOGENIX, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.
            </p>
          </div>

          <h2>1. Information We Collect</h2>
          <p>We collect information that you provide directly to us when you:</p>
          <ul>
            <li>Create an account and use our platform</li>
            <li>Submit website URLs for analysis</li>
            <li>Integrate with third-party services</li>
            <li>Contact our support team</li>
            <li>Subscribe to our newsletter</li>
            <li>Respond to surveys or fill out forms</li>
          </ul>

          <p>This information may include:</p>
          <ul>
            <li>Personal identifiers (name, email address, phone number)</li>
            <li>Account credentials</li>
            <li>Billing information</li>
            <li>Website URLs and content</li>
            <li>Business information</li>
            <li>Communication preferences</li>
          </ul>

          <h3>Automatically Collected Information</h3>
          <p>When you use our platform, we automatically collect certain information, including:</p>
          <ul>
            <li>Device information (browser type, operating system, device type)</li>
            <li>IP address and location information</li>
            <li>Usage data (pages visited, features used, time spent)</li>
            <li>Referral sources</li>
            <li>Performance data and crash reports</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide, maintain, and improve our services</li>
            <li>Process transactions and manage your account</li>
            <li>Analyze website content for AI visibility optimization</li>
            <li>Send you technical notices, updates, and support messages</li>
            <li>Respond to your comments and questions</li>
            <li>Understand how users interact with our platform</li>
            <li>Develop new features and services</li>
            <li>Prevent fraud and abuse</li>
            <li>Comply with legal obligations</li>
          </ul>

          <h2>3. How We Share Your Information</h2>
          <p>We may share your information with:</p>
          <ul>
            <li><strong>Service Providers:</strong> Third-party vendors who perform services on our behalf (e.g., cloud hosting, payment processing)</li>
            <li><strong>Business Partners:</strong> When you integrate with partner services</li>
            <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
            <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
          </ul>

          <p>We do not sell your personal information to third parties.</p>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 my-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <Eye className="h-5 w-5 text-blue-500" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Content Analysis</h3>
                <div className="text-sm text-blue-700">
                  <p>
                    When you submit website URLs for analysis, our AI systems process the content to provide optimization recommendations. This content is used solely for the purpose of providing our services and is not shared with third parties except as described in this policy.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <h2>4. Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, accidental loss, alteration, or disclosure. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
          </p>

          <h2>5. Data Retention</h2>
          <p>
            We retain your information for as long as your account is active or as needed to provide you services. We will retain and use your information as necessary to comply with our legal obligations, resolve disputes, and enforce our agreements.
          </p>

          <h2>6. Your Rights and Choices</h2>
          <p>Depending on your location, you may have certain rights regarding your personal information, including:</p>
          <ul>
            <li>Access to your personal information</li>
            <li>Correction of inaccurate or incomplete information</li>
            <li>Deletion of your personal information</li>
            <li>Restriction or objection to processing</li>
            <li>Data portability</li>
            <li>Withdrawal of consent</li>
          </ul>

          <p>
            To exercise these rights, please contact us at <a href="mailto:privacy@seogenix.com">privacy@seogenix.com</a>.
          </p>

          <h2>7. International Data Transfers</h2>
          <p>
            Your information may be transferred to, and processed in, countries other than the country in which you reside. These countries may have data protection laws that are different from the laws of your country. We have implemented appropriate safeguards to protect your information when transferred internationally.
          </p>

          <h2>8. Children's Privacy</h2>
          <p>
            Our services are not directed to children under 16. We do not knowingly collect personal information from children under 16. If we learn that we have collected personal information from a child under 16, we will take steps to delete such information.
          </p>

          <h2>9. Changes to This Privacy Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
          </p>

          <h2>10. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at:
          </p>
          <ul>
            <li>Email: <a href="mailto:privacy@seogenix.com">privacy@seogenix.com</a></li>
            <li>Address: 123 AI Avenue, Suite 500, San Francisco, CA 94103</li>
            <li>Phone: +1 (800) 555-1234</li>
          </ul>

          <div className="flex items-center mt-12 pt-8 border-t border-gray-200">
            <Lock className="w-8 h-8 text-purple-600 mr-4" />
            <p className="text-gray-700">
              By using SEOGENIX, you agree to the collection and use of information in accordance with this Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;