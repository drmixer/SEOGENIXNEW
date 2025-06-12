import React from 'react';
import { Cookie, Info, Shield, Clock, CheckCircle } from 'lucide-react';

const CookiePolicy = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 py-16 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Cookie Policy
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
            <Cookie className="w-8 h-8 text-purple-600 mr-4" />
            <p className="text-gray-700 italic">
              This Cookie Policy explains how SEOGENIX uses cookies and similar technologies to recognize you when you visit our platform. It explains what these technologies are and why we use them, as well as your rights to control our use of them.
            </p>
          </div>

          <h2>1. What Are Cookies?</h2>
          <p>
            Cookies are small data files that are placed on your computer or mobile device when you visit a website. Cookies are widely used by website owners to make their websites work, or to work more efficiently, as well as to provide reporting information.
          </p>
          <p>
            Cookies set by the website owner (in this case, SEOGENIX) are called "first-party cookies." Cookies set by parties other than the website owner are called "third-party cookies." Third-party cookies enable third-party features or functionality to be provided on or through the website (e.g., advertising, interactive content, and analytics). The parties that set these third-party cookies can recognize your computer both when it visits the website in question and also when it visits certain other websites.
          </p>

          <h2>2. Why Do We Use Cookies?</h2>
          <p>
            We use first-party and third-party cookies for several reasons. Some cookies are required for technical reasons in order for our platform to operate, and we refer to these as "essential" or "strictly necessary" cookies. Other cookies also enable us to track and target the interests of our users to enhance the experience on our platform. Third parties serve cookies through our platform for analytics, personalization, and advertising purposes.
          </p>

          <h3>The specific types of cookies we use include:</h3>
          <ul>
            <li>
              <strong>Essential cookies:</strong> These cookies are strictly necessary to provide you with services available through our platform and to use some of its features, such as access to secure areas. Because these cookies are strictly necessary to deliver the platform, you cannot refuse them without impacting how our platform functions.
            </li>
            <li>
              <strong>Performance and functionality cookies:</strong> These cookies are used to enhance the performance and functionality of our platform but are non-essential to their use. However, without these cookies, certain functionality may become unavailable.
            </li>
            <li>
              <strong>Analytics and customization cookies:</strong> These cookies collect information that is used either in aggregate form to help us understand how our platform is being used or how effective our marketing campaigns are, or to help us customize our platform for you.
            </li>
            <li>
              <strong>Advertising cookies:</strong> These cookies are used to make advertising messages more relevant to you. They perform functions like preventing the same ad from continuously reappearing, ensuring that ads are properly displayed, and in some cases selecting advertisements that are based on your interests.
            </li>
            <li>
              <strong>Social networking cookies:</strong> These cookies are used to enable you to share pages and content that you find interesting on our platform through third-party social networking and other websites. These cookies may also be used for advertising purposes.
            </li>
          </ul>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 my-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <Info className="h-5 w-5 text-blue-500" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Cookie Usage</h3>
                <div className="text-sm text-blue-700">
                  <p>
                    Our platform uses cookies primarily to enhance your experience, analyze platform usage, and optimize our services. We do not use cookies to collect personally identifiable information without your consent.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <h2>3. Cookies We Use</h2>
          <p>The following table provides more information about the cookies we use and why:</p>

          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 mt-4 mb-8">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Provider</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Purpose</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Expiry</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Type</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">_seogenix_session</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">SEOGENIX</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Used to maintain your authenticated session</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Session</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Essential</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">_seogenix_preferences</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">SEOGENIX</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Stores your preferences and settings</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">1 year</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Functionality</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">_ga</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Google Analytics</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Used to distinguish users for analytics</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">2 years</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Analytics</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">_gid</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Google Analytics</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Used to distinguish users for analytics</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">24 hours</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Analytics</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">_fbp</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Facebook</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Used by Facebook for advertising purposes</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">3 months</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Marketing</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>4. How Can You Control Cookies?</h2>
          <p>
            You have the right to decide whether to accept or reject cookies. You can exercise your cookie preferences by clicking on the appropriate opt-out links provided in the cookie table above.
          </p>
          <p>
            You can also set or amend your web browser controls to accept or refuse cookies. If you choose to reject cookies, you may still use our platform though your access to some functionality and areas may be restricted. As the means by which you can refuse cookies through your web browser controls vary from browser-to-browser, you should visit your browser's help menu for more information.
          </p>
          <p>
            In addition, most advertising networks offer you a way to opt out of targeted advertising. If you would like to find out more information, please visit <a href="http://www.aboutads.info/choices/" className="text-purple-600 hover:text-purple-700">http://www.aboutads.info/choices/</a> or <a href="http://www.youronlinechoices.com" className="text-purple-600 hover:text-purple-700">http://www.youronlinechoices.com</a>.
          </p>

          <h2>5. Do Not Track</h2>
          <p>
            Some browsers have a "Do Not Track" feature that lets you tell websites that you do not want to have your online activities tracked. At this time, we do not respond to browser "Do Not Track" signals.
          </p>

          <h2>6. How Often Will We Update This Cookie Policy?</h2>
          <p>
            We may update this Cookie Policy from time to time in order to reflect, for example, changes to the cookies we use or for other operational, legal, or regulatory reasons. Please therefore re-visit this Cookie Policy regularly to stay informed about our use of cookies and related technologies.
          </p>
          <p>
            The date at the top of this Cookie Policy indicates when it was last updated.
          </p>

          <h2>7. Where Can You Get Further Information?</h2>
          <p>
            If you have any questions about our use of cookies or other technologies, please email us at <a href="mailto:privacy@seogenix.com" className="text-purple-600 hover:text-purple-700">privacy@seogenix.com</a>.
          </p>

          <div className="flex items-center mt-12 pt-8 border-t border-gray-200">
            <CheckCircle className="w-8 h-8 text-green-600 mr-4" />
            <p className="text-gray-700">
              By continuing to use our platform, you consent to our use of cookies as described in this Cookie Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookiePolicy;