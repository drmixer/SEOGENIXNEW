// components/BillingModal.tsx

import React, { useState, useEffect, useCallback } from 'react';
import Modal from 'react-modal'; // Assuming you use react-modal or similar
import { supabase } from '../lib/supabase'; // Adjust path as needed
import { User } from '@supabase/supabase-js'; // For Supabase user type

// You will need to implement this service or functions to interact with Lemon Squeezy
// This might be a separate utility file or API endpoint on your backend.
// For now, these are placeholders:
interface LemonSqueezyProductDetails {
  core: { monthly: string; annual: string; productId: string };
  pro: { monthly: string; annual: string; productId: string };
  agency: { monthly: string; annual: string; productId: string };
}

// Placeholder for your Lemon Squeezy Product/Variant IDs
// YOU NEED TO REPLACE THESE WITH YOUR ACTUAL LEMON SQUEEZY IDs
const LEMON_SQUEEZY_PRODUCT_INFO: LemonSqueezyProductDetails = {
  core: { monthly: 'YOUR_CORE_MONTHLY_VARIANT_ID', annual: 'YOUR_CORE_ANNUAL_VARIANT_ID', productId: 'YOUR_CORE_PRODUCT_ID' },
  pro: { monthly: 'YOUR_PRO_MONTHLY_VARIANT_ID', annual: 'YOUR_PRO_ANNUAL_VARIANT_ID', productId: 'YOUR_PRO_PRODUCT_ID' },
  agency: { monthly: 'YOUR_AGENCY_MONTHLY_VARIANT_ID', annual: 'YOUR_AGENCY_ANNUAL_VARIANT_ID', productId: 'YOUR_AGENCY_PRODUCT_ID' },
};

// This function needs to generate a Lemon Squeezy checkout URL.
// It could call a backend API route that generates a signed URL or use client-side SDK.
// For now, it's a placeholder.
async function getLemonSqueezyCheckoutUrl(
  plan: 'core' | 'pro' | 'agency',
  billingCycle: 'monthly' | 'annual',
  userId: string
): Promise<string> {
  // --- IMPORTANT: IMPLEMENT YOUR ACTUAL LEMON SQUEEZY CHECKOUT URL GENERATION HERE ---
  // This might involve:
  // 1. Calling your backend API: `/api/lemon-squeezy-checkout?plan=${plan}&cycle=${billingCycle}&userId=${userId}`
  // 2. Using a Lemon Squeezy client-side library (less common for secure checkouts)
  // 3. Directly forming the URL if you're using simple product URLs and not needing custom data.

  // Example (replace with your actual logic):
  console.log(`Generating checkout URL for ${plan} ${billingCycle} for user ${userId}`);
  const variantId = LEMON_SQUEEZY_PRODUCT_INFO[plan][billingCycle];

  // This is a basic example. Lemon Squeezy often recommends generating URLs
  // via your backend to include security hashes and custom data.
  // Replace `YOUR_STORE_URL` with your actual Lemon Squeezy store URL.
  // The `checkout` parameter indicates a direct checkout.
  // The `embed=1` parameter is for embedding if you use their JS SDK, otherwise remove.
  // The `passthrough` parameter is crucial for webhooks to identify the user/session.
  const baseUrl = `https://your-store-name.lemonsqueezy.com/checkout/buy/`;
  return `${baseUrl}${variantId}?embed=1&passthrough=${JSON.stringify({ user_id: userId, plan: plan, billing_cycle: billingCycle })}`;
}
// -------------------------------------------------------------------------------------

// Ensure your root element for the modal is set for react-modal
Modal.setAppElement('#root'); // Replace '#root' with your app's root element ID

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

  useEffect(() => {
    // If the purpose is 'manage', we don't necessarily want to select a plan immediately,
    // but rather provide a link to the Lemon Squeezy billing portal.
    if (purpose === 'manage') {
      // You might open the portal directly here or provide a button
      // const portalUrl = await getLemonSqueezyBillingPortalUrl(user.id); // You'd need to implement this
      // window.open(portalUrl, '_blank');
      // onClose(); // Close the modal if redirecting
    }
  }, [purpose, user.id, onClose]);


  const handleCheckout = useCallback(async () => {
    if (!user || currentPlanSelection === 'free') {
      setError('Please select a paid plan to proceed.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get the checkout URL from your service/function
      const checkoutUrl = await getLemonSqueezyCheckoutUrl(
        currentPlanSelection as 'core' | 'pro' | 'agency', // Cast because 'free' is handled
        selectedBillingCycle,
        user.id
      );

      // Redirect the user to the Lemon Squeezy checkout page
      window.location.href = checkoutUrl;

      // Note: onSuccess() is NOT called here immediately.
      // It should be called when your backend confirms payment via webhook
      // and updates the user's plan in Supabase. App.tsx will then re-fetch
      // the profile and determine the next step.
      // This modal might stay open briefly until the redirect, or you can close it.
      // onClose(); // You might want to close the modal immediately on redirect
    } catch (err) {
      console.error('Error generating checkout URL:', err);
      setError('Failed to initiate checkout. Please try again.');
      setLoading(false);
    }
  }, [user, currentPlanSelection, selectedBillingCycle, onClose]);

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
        return 'Unlock full features by selecting a plan below. You can start with a free trial on paid plans.';
      case 'upgrade':
        return `You are currently on the ${userPlan.toUpperCase()} plan. Upgrade to unlock more power!`;
      case 'manage':
        return 'Access your Lemon Squeezy billing portal to view invoices, update payment methods, or change your subscription.';
      default:
        return '';
    }
  };

  // If the purpose is 'manage', the UI should be different (e.g., a button to open portal)
  if (purpose === 'manage') {
    return (
      <Modal
        isOpen={true}
        onRequestClose={onClose}
        className="fixed inset-0 flex items-center justify-center p-4"
        overlayClassName="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center"
        contentLabel="Manage Subscription"
      >
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">{getModalTitle()}</h2>
          <p className="text-gray-600 mb-6">{getModalDescription()}</p>
          <button
            onClick={async () => {
              setLoading(true);
              setError(null);
              try {
                // You will need a backend endpoint or service to securely get the billing portal URL
                const response = await fetch(`/api/get-lemon-squeezy-portal-url?userId=${user.id}`);
                const data = await response.json();
                if (response.ok && data.portalUrl) {
                  window.open(data.portalUrl, '_blank');
                  onClose(); // Close modal after opening portal
                } else {
                  throw new Error(data.error || 'Failed to get billing portal URL.');
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

  // UI for signup_upsell and upgrade purposes
  return (
    <Modal
      isOpen={true}
      onRequestClose={onClose}
      className="fixed inset-0 flex items-center justify-center p-4"
      overlayClassName="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center"
      contentLabel="Billing Information"
    >
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full">
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
            purpose === 'signup_upsell' ? `Start Free Trial & Pay for ${currentPlanSelection}` :
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
