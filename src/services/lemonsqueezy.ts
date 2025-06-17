import { LemonSqueezy } from '@lemonsqueezy/lemonsqueezy.js';
import { supabase } from '../lib/supabase';

// Get API key and validate it exists
const apiKey = import.meta.env.VITE_LEMONSQUEEZY_API_KEY;
const storeId = import.meta.env.VITE_LEMONSQUEEZY_STORE_ID;

// Log configuration status for debugging
console.log('LemonSqueezy Configuration Status:');
console.log(`- API Key present: ${!!apiKey}`);
console.log(`- API Key is not placeholder: ${apiKey !== 'your_lemonsqueezy_api_key_here'}`);
console.log(`- Store ID present: ${!!storeId}`);
console.log(`- Store ID is not placeholder: ${storeId !== 'your_lemonsqueezy_store_id_here'}`);

// Check if API key is properly configured (not placeholder or empty)
const isApiKeyConfigured = apiKey && apiKey !== 'your_lemonsqueezy_api_key_here' && apiKey.trim() !== '';
const isStoreIdConfigured = storeId && storeId !== 'your_lemonsqueezy_store_id_here' && storeId.trim() !== '';

console.log(`LemonSqueezy fully configured: ${isApiKeyConfigured && isStoreIdConfigured}`);

if (!isApiKeyConfigured) {
  console.warn('VITE_LEMONSQUEEZY_API_KEY is not properly configured. Payment processing will be unavailable.');
}

if (!isStoreIdConfigured) {
  console.warn('VITE_LEMONSQUEEZY_STORE_ID is not properly configured. Payment processing will be unavailable.');
}

// Initialize LemonSqueezy with your API key - only if API key is properly configured
let lemonSqueezy: LemonSqueezy | null = null;

if (isApiKeyConfigured) {
  try {
    lemonSqueezy = new LemonSqueezy(apiKey);
    console.log('LemonSqueezy client initialized successfully');
  } catch (error) {
    console.error('Failed to initialize LemonSqueezy:', error);
    lemonSqueezy = null;
  }
}

// Plan IDs from LemonSqueezy
export const PLAN_IDS = {
  free: 'free', // Not a real LemonSqueezy plan, just for reference
  core: import.meta.env.VITE_LEMONSQUEEZY_CORE_PLAN_ID || '',
  pro: import.meta.env.VITE_LEMONSQUEEZY_PRO_PLAN_ID || '',
  agency: import.meta.env.VITE_LEMONSQUEEZY_AGENCY_PLAN_ID || ''
};

// Store IDs from LemonSqueezy
export const STORE_ID = import.meta.env.VITE_LEMONSQUEEZY_STORE_ID || '';

// Checkout options
export interface CheckoutOptions {
  name?: string;
  email?: string;
  planId: string;
  variantId: string;
  successUrl?: string;
  cancelUrl?: string;
}

export const lemonsqueezyService = {
  /**
   * Check if LemonSqueezy is properly configured
   */
  isConfigured() {
    // Debug the configuration check
    console.log('--- lemonsqueezyService.isConfigured() Debug ---');
    console.log('isApiKeyConfigured:', isApiKeyConfigured);
    console.log('isStoreIdConfigured:', isStoreIdConfigured);
    console.log('lemonSqueezy is null?', lemonSqueezy === null);
    
    // The issue is here - in the current version of the SDK, the structure might be different
    // Let's check if the client exists at all first
    const isClientValid = lemonSqueezy !== null;
    console.log('LemonSqueezy client is valid?', isClientValid);
    
    // Final result
    const result = isApiKeyConfigured && isStoreIdConfigured && isClientValid;
    console.log('Final result:', result);
    console.log('----------------------------------------');
    
    return result;
  },

  /**
   * Get the current user's subscription
   */
  async getUserSubscription(userId: string) {
    try {
      if (!this.isConfigured()) {
        console.error('LemonSqueezy is not configured');
        return null;
      }

      // Get user's customer ID from Supabase
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('lemonsqueezy_customer_id, plan')
        .eq('user_id', userId)
        .single();
      
      if (!profile?.lemonsqueezy_customer_id) {
        return null;
      }
      
      // Get subscriptions for this customer
      if (!lemonSqueezy) {
        console.error('LemonSqueezy client is not initialized');
        return null;
      }
      
      try {
        const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions?filter[customer_id]=${profile.lemonsqueezy_customer_id}`, {
          headers: {
            'Accept': 'application/vnd.api+json',
            'Content-Type': 'application/vnd.api+json',
            'Authorization': `Bearer ${apiKey}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch subscriptions: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.data[0] || null;
      } catch (apiError) {
        console.error('Error calling LemonSqueezy API:', apiError);
        return null;
      }
    } catch (error) {
      console.error('Error getting user subscription:', error);
      return null;
    }
  },
  
  /**
   * Create a checkout for a specific plan
   */
  async createCheckout(options: CheckoutOptions) {
    try {
      if (!this.isConfigured()) {
        throw new Error('LemonSqueezy is not configured');
      }

      const { name, email, planId, variantId, successUrl, cancelUrl } = options;
      
      if (!variantId || variantId.includes('your_') || variantId.includes('_here')) {
        throw new Error(`Product variant ID is not properly configured for plan: ${planId}. Please configure the variant IDs in your .env file.`);
      }
      
      console.log(`Creating checkout for plan ${planId} with variant ID ${variantId}`);
      console.log(`Store ID: ${STORE_ID}`);
      
      // Create a checkout using the REST API directly
      const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          data: {
            type: 'checkouts',
            attributes: {
              store_id: parseInt(STORE_ID),
              variant_id: parseInt(variantId),
              custom_price: null,
              product_options: {
                name: name || undefined,
                email: email || undefined,
                redirect_url: successUrl || undefined,
                receipt_link_url: successUrl || undefined,
                receipt_button_text: 'Return to Dashboard',
                receipt_thank_you_note: 'Thank you for your purchase!',
                enabled_variants: [parseInt(variantId)]
              },
              checkout_options: {
                embed: false,
                media: true,
                logo: true,
                desc: true,
                discount: true,
                dark: false,
                subscription_preview: true,
                button_color: '#8B5CF6'
              },
              checkout_data: {
                custom: {
                  plan: planId
                }
              },
              expires_at: null
            }
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to create checkout: ${errorData}`);
      }
      
      const checkout = await response.json();
      return checkout;
    } catch (error) {
      console.error('Error creating checkout:', error);
      throw error;
    }
  },
  
  /**
   * Update a user's plan in Supabase based on subscription data
   */
  async updateUserPlan(userId: string, subscriptionData: any) {
    try {
      const planId = subscriptionData.attributes?.custom_data?.plan || 'free';
      const customerId = subscriptionData.attributes?.customer_id;
      const subscriptionId = subscriptionData.id;
      
      // Update user profile with subscription info
      await supabase
        .from('user_profiles')
        .update({
          plan: planId,
          lemonsqueezy_customer_id: customerId,
          lemonsqueezy_subscription_id: subscriptionId,
          subscription_status: subscriptionData.attributes?.status || 'active',
          subscription_updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      // Also update user metadata
      await supabase.auth.updateUser({
        data: {
          plan: planId
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error updating user plan:', error);
      return false;
    }
  },
  
  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string) {
    try {
      if (!this.isConfigured()) {
        throw new Error('LemonSqueezy is not configured');
      }

      // Use the REST API to cancel the subscription
      const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`, {
        method: 'PATCH',
        headers: {
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          data: {
            type: 'subscriptions',
            id: subscriptionId,
            attributes: {
              cancelled: true
            }
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to cancel subscription: ${response.statusText}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return false;
    }
  },
  
  /**
   * Get checkout URL for a specific plan
   */
  async getCheckoutUrl(plan: 'core' | 'pro' | 'agency', user: any, billingCycle: 'monthly' | 'annual' = 'monthly') {
    try {
      // Check if LemonSqueezy is configured before proceeding
      if (!this.isConfigured()) {
        throw new Error('Payment processing is not available. LemonSqueezy integration is not properly configured.');
      }

      // Map plans to variant IDs based on billing cycle
      const variantMap: Record<string, Record<string, string>> = {
        monthly: {
          core: import.meta.env.VITE_LEMONSQUEEZY_CORE_MONTHLY_VARIANT_ID || '',
          pro: import.meta.env.VITE_LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID || '',
          agency: import.meta.env.VITE_LEMONSQUEEZY_AGENCY_MONTHLY_VARIANT_ID || ''
        },
        annual: {
          core: import.meta.env.VITE_LEMONSQUEEZY_CORE_ANNUAL_VARIANT_ID || '',
          pro: import.meta.env.VITE_LEMONSQUEEZY_PRO_ANNUAL_VARIANT_ID || '',
          agency: import.meta.env.VITE_LEMONSQUEEZY_AGENCY_ANNUAL_VARIANT_ID || ''
        }
      };
      
      const variantId = variantMap[billingCycle][plan];
      if (!variantId) {
        throw new Error(`No variant ID found for plan: ${plan} (${billingCycle}). Please configure VITE_LEMONSQUEEZY_${plan.toUpperCase()}_${billingCycle.toUpperCase()}_VARIANT_ID in your .env file.`);
      }
      
      console.log(`Creating checkout for ${plan} plan (${billingCycle} billing):`);
      console.log(`- User: ${user?.email}`);
      console.log(`- Variant ID: ${variantId}`);
      console.log(`- Store ID: ${STORE_ID}`);
      
      // Create checkout
      const checkout = await this.createCheckout({
        name: user?.user_metadata?.full_name,
        email: user?.email,
        planId: plan,
        variantId,
        successUrl: `${window.location.origin}/dashboard?checkout_success=true&plan=${plan}`,
        cancelUrl: `${window.location.origin}/?checkout_cancelled=true`
      });
      
      if (checkout?.data?.attributes?.url) {
        console.log(`Checkout URL generated successfully: ${checkout.data.attributes.url.substring(0, 50)}...`);
      } else {
        console.error('Failed to generate checkout URL - checkout response:', checkout);
      }
      
      return checkout?.data?.attributes?.url;
    } catch (error) {
      console.error('Error getting checkout URL:', error);
      throw error;
    }
  },
  
  /**
   * Process webhook from LemonSqueezy
   */
  async processWebhook(payload: any) {
    try {
      if (!this.isConfigured()) {
        throw new Error('LemonSqueezy is not configured');
      }

      const eventName = payload.meta?.event_name;
      const eventData = payload.data;
      
      if (!eventName || !eventData) {
        throw new Error('Invalid webhook payload');
      }

      console.log(`Processing LemonSqueezy webhook: ${eventName}`);
      
      switch (eventName) {
        case 'subscription_created':
        case 'subscription_updated':
          // Find user by customer ID
          const customerId = eventData.attributes?.customer_id;
          if (!customerId) break;
          
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('user_id')
            .eq('lemonsqueezy_customer_id', customerId);
          
          if (profiles && profiles.length > 0) {
            await this.updateUserPlan(profiles[0].user_id, eventData);
          } else {
            console.log('No user found for customer ID:', customerId);
          }
          break;
          
        case 'subscription_cancelled':
          // Update subscription status
          const subscriptionId = eventData.id;
          if (!subscriptionId) break;
          
          const { data: cancelledProfiles, error: cancelledError } = await supabase
            .from('user_profiles')
            .select('user_id')
            .eq('lemonsqueezy_subscription_id', subscriptionId);
          
          if (cancelledError) {
            throw cancelledError;
          }
          
          if (cancelledProfiles && cancelledProfiles.length > 0) {
            const { error: updateError } = await supabase
              .from('user_profiles')
              .update({
                subscription_status: 'cancelled',
                subscription_updated_at: new Date().toISOString()
              })
              .eq('lemonsqueezy_subscription_id', subscriptionId);
            
            if (updateError) {
              throw updateError;
            }
            
            console.log(`Marked subscription ${subscriptionId} as cancelled`);
          }
          break;
          
        case 'subscription_expired':
          // Downgrade to free plan
          const expiredSubId = eventData.id;
          if (!expiredSubId) break;
          
          const { data: expiredProfiles, error: expiredError } = await supabase
            .from('user_profiles')
            .select('user_id')
            .eq('lemonsqueezy_subscription_id', expiredSubId);
          
          if (expiredError) {
            throw expiredError;
          }
          
          if (expiredProfiles && expiredProfiles.length > 0) {
            for (const profile of expiredProfiles) {
              await this.updateUserPlan(profile.user_id, {
                id: expiredSubId,
                attributes: {
                  custom_data: { plan: 'free' },
                  status: 'expired'
                }
              });
            }
          }
          break;
      }
      
      return true;
    } catch (error) {
      console.error('Error processing webhook:', error);
      return false;
    }
  }
};