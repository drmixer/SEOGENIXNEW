// components/BillingModal.tsx

import React, { useState, useEffect, useCallback } from 'react';
import Modal from 'react-modal';
import { supabase } from '../lib/supabase'; // Adjust this path to your Supabase client instance
import { User } from '@supabase/supabase-js';

// Ensure your root element for the modal is set for react-modal
Modal.setAppElement('#root'); // Replace '#root' with your app's root element ID, if using react-modal

interface LemonSqueezyProductDetails {
  core: { monthly: string; annual: string; productId: string };
  pro: { monthly: string; annual: string; productId: string };
  agency: { monthly: string; annual: string; productId: string };
}

// --- UPDATED WITH YOUR LEMON SQUEEZY IDs ---
const LEMON_SQUEEZY_PRODUCT_INFO: LemonSqueezyProductDetails = {
  core: { monthly: '852312', annual: '852309', productId: '549772' },
  pro: { monthly: '852315', annual: '852316', productId: '549775' },
  agency: { monthly: '852328', annual: '852331', productId: '549780' },
};
// ------------------------------------------


interface BillingModalProps {
  user: User; // Supabase User object
  userPlan: 'free' | 'core' | 'pro' | 'agency'; // Current plan from DB (App.tsx state)
  initialSelectedPlan: 'free' | 'core' | 'pro' | 'agency'; // The plan chosen on landing page
  purpose: 'signup_upsell' | 'upgrade' | 'manage'; // Controls modal content/CTA
  onClose: () => void; // Function to call when modal is explicitly closed by user
  onSuccess: () => void; // Function to call when payment is confirmed (e.g., after webhook update)
}

const BillingModal: React.FC<BillingModalProps> = ({
  user,
  userPlan,
  initialSelectedPlan,
  purpose,
  onClose,
  onSuccess,
}) => {
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine the default plan to show based on purpose and initialSelectedPlan
  const [currentPlanSelection, setCurrentPlanSelection] = useState<'free' | 'core' | 'pro' | 'agency'>(
    initialSelectedPlan !== 'free' ? initialSelectedPlan : 'core' // Default to core if free was selected or no specific initial plan
  );

  // --- IMPORTANT: Function to get Lemon Squeezy Checkout URL from your NEW Backend Edge Function ---
  const getLemonSqueezyCheckoutUrl = useCallback(async (
    plan: 'core' | 'pro' | 'agency',
    billingCycle: 'monthly' | 'annual',
    userId: string
  ): Promise<string> => {
    try {
      // UPDATED WITH YOUR CHECKOUT EDGE FUNCTION URL
      const CHECKOUT_EDGE_FUNCTION_URL = 'https://anuexdfqfiibzzmspewa.supabase.co/functions/v1/generate-checkout-url';

      const response = await fetch(CHECKOUT_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}` // Use user.id or a proper JWT from Supabase auth.getSession()
        },
        body: JSON.stringify({
          plan,
          billingCycle,
          userId,
          variantId: LEMON_SQUEEZY_PRODUCT_INFO[plan][billingCycle], // Pass the specific variant ID
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get checkout URL from backend.');
      }

      const data = await response.json();
      if (!data.checkoutUrl) {
        throw new Error('Backend did not return a checkout URL.');
      }
      return data.checkoutUrl;
    } catch (err: any) {
      console.error('Error fetching checkout URL from backend:', err);
      throw err; // Re-throw to be caught by handleCheckout
    }
  }, [user.id]); // Dependency: user.id for the Authorization header


  const handleCheckout = useCallback(async () => {
    if (!user || currentPlanSelection === 'free') {
      setError('Please select a paid plan to proceed.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use your backend Edge Function to get the checkout URL
      const checkoutUrl = await getLemonSqueezyCheckoutUrl(
        currentPlanSelection as 'core' | 'pro' | 'agency',
        selectedBillingCycle,
        user.id
      );

      // Redirect the user to the Lemon Squeezy checkout page
      window.location.href = checkoutUrl;

    } catch (err: any) {
      console.error('Error initiating checkout:', err);
      setError(err.message || 'Failed to initiate checkout. Please try again.');
      setLoading(false);
    }
  }, [user, currentPlanSelection, selectedBillingCycle, getLemonSqueezyCheckoutUrl]);


  // Determine modal title and description based on purpose
  const getModalTitle = () => {
    switch (purpose) {
      case 'signup_upsell':
        return 'Choose Your Plan';
      case 'upgrade':
        return 'Upgrade Your Plan';
      case 'manage':
        return 'Manage Your Subscription';
      default:
        return 'Select a Plan';
    }
  };

  const getModalDescription = () => {
    switch (purpose) {
      case 'signup_upsell':
        return 'Unlock full features by selecting a plan below.';
      case 'upgrade':
        return `You are currently on the ${userPlan.toUpperCase()} plan. Upgrade to unlock more power!`;
      case 'manage':
        return 'Access your Lemon Squeezy billing portal to view invoices, update payment methods, or change your subscription.';
      default:
        return '';
    }
  };

  // UI for 'manage' purpose (Opens Lemon Squeezy billing portal)
  if (purpose === 'manage') {
    return (
      <Modal
        isOpen={true}
        onRequestClose={onClose}
        className="fixed inset-0 flex items-center justify-center p-4"
        overlayClassName="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center"
        contentLabel="Manage Subscription"
      >
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl"
            aria-label="Close"
          >
            &times;
          </button>
          <h2 className="text-2xl font-bold mb-4 text-gray-800">{getModalTitle()}</h2>
          <p className="text-gray-600 mb-6">{getModalDescription()}</p>
          <button
            onClick={async () => {
              setLoading(true);
              setError(null);
              try {
                // UPDATED WITH YOUR BILLING PORTAL EDGE FUNCTION URL
                const BILLING_PORTAL_EDGE_FUNCTION_URL = 'https://anuexdfqfiibzzmspewa.supabase.co/functions/v1/generate-portal-url';

                const response = await fetch(`${BILLING_PORTAL_EDGE_FUNCTION_URL}?userId=${user.id}`);
                const data = await response.json();
                if (response.ok && data.portalUrl) {
                  window.open(data.portalUrl, '_blank');
                  onClose(); // Close modal after opening portal
                } else {
                  throw new Error(data.error || 'Failed to get billing portal URL from backend.');
                }
              } catch (err: any) {
                console.error('Error opening billing portal:', err);
                setError(err.message || 'Could not open billing portal. Please try again.');
              } finally {
                setLoading(false);
              }
            }}
            className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg hover:bg-purple-700 transition-colors duration-200 text-lg font-semibold flex items-center justify-center"
            disabled={loading}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              'Open Billing Portal'
            )}
          </button>
          {error && <p className="text-red-500 text-sm mt-3 text-center">{error}</p>}
          <button
            onClick={onClose}
            className="mt-4 w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors duration-200"
          >
            Close
          </button>
        </div>
      </Modal>
    );
  }

  // UI for 'signup_upsell' and 'upgrade' purposes
  return (
    <Modal
      isOpen={true}
      onRequestClose={onClose}
      className="fixed inset-0 flex items-center justify-center p-4"
      overlayClassName="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center"
      contentLabel="Billing Information"
    >
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl"
          aria-label="Close"
        >
          &times;
        </button>
        <h2 className="text-2xl font-bold mb-2 text-gray-800">{getModalTitle()}</h2>
        <p className="text-gray-600 mb-6">{getModalDescription()}</p>

        {error && <p className="text-red-500 mb-4 text-center">{error}</p>}

        {/* Plan Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {['core', 'pro', 'agency'].map((plan: any) => (
            <div
              key={plan}
              onClick={() => setCurrentPlanSelection(plan)}
              className={`border rounded-lg p-4 cursor-pointer transition-all duration-200
                ${currentPlanSelection === plan ? 'border-purple-600 ring-2 ring-purple-500' : 'border-gray-300 hover:border-purple-400'}
                ${userPlan === plan && purpose !== 'signup_upsell' ? 'bg-purple-50 bg-opacity-50' : ''}
              `}
            >
              <h3 className="text-xl font-semibold capitalize mb-1">{plan}</h3>
              <p className="text-sm text-gray-500 mb-2">
                {plan === 'core' && 'Essential features for small teams.'}
                {plan === 'pro' && 'Advanced tools for growing businesses.'}
                {plan === 'agency' && 'Comprehensive suite for agencies.'}
              </p>
              {/* Display price based on cycle - YOU'll NEED TO DEFINE THESE PRICES */}
              <p className="text-3xl font-bold text-gray-900">
                 {/* Replace with your actual pricing logic and display */}
                 {plan === 'core' && `$${selectedBillingCycle === 'monthly' ? '29' : '299'}`}
                 {plan === 'pro' && `$${selectedBillingCycle === 'monthly' ? '99' : '999'}`}
                 {plan === 'agency' && `$${selectedBillingCycle === 'monthly' ? '299' : '2999'}`}
                 <span className="text-base font-normal text-gray-500">/{selectedBillingCycle === 'monthly' ? 'mo' : 'yr'}</span>
              </p>
              {userPlan === plan && purpose !== 'signup_upsell' && (
                  <span className="text-xs text-purple-600 font-medium mt-2 block">Current Plan</span>
              )}
            </div>
          ))}
        </div>

        {/* Billing Cycle Selection */}
        <div className="flex justify-center mb-6">
          <button
            onClick={() => setSelectedBillingCycle('monthly')}
            className={`py-2 px-4 rounded-l-lg ${selectedBillingCycle === 'monthly' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-800'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setSelectedBillingCycle('annual')}
            className={`py-2 px-4 rounded-r-lg ${selectedBillingCycle === 'annual' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-800'}`}
          >
            Annual (Save X%)
          </button>
        </div>

        {/* Checkout Button */}
        <button
          onClick={handleCheckout}
          disabled={loading || currentPlanSelection === 'free'}
          className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg hover:bg-purple-700 transition-colors duration-200 text-lg font-semibold flex items-center justify-center"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            currentPlanSelection === 'free' ? 'Select a Paid Plan' :
            `Proceed to Checkout for ${currentPlanSelection}`
          )}
        </button>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="mt-4 w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors duration-200"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
};

export default BillingModal;
