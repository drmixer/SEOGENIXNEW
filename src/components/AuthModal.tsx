import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, Loader } from 'lucide-react';
import { supabase, resetAuth } from '../lib/supabase';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialMode?: 'login' | 'signup';
  selectedPlan?: 'free' | 'core' | 'pro' | 'agency';
}

const AuthModal: React.FC<AuthModalProps> = ({ 
  onClose, 
  onSuccess, 
  initialMode = 'login',
  selectedPlan = 'free'
}) => {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use the selected plan from props directly
  // No need for a separate state since we don't want users to change it here

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        console.log('Attempting login for:', email);
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;
        
        console.log('Login successful:', data.user?.id);
        
        // For login, session should be immediately available
        if (data.session && data.user) {
          console.log('Login session established, proceeding...');
          onSuccess();
        } else {
          throw new Error('Login successful but no session established');
        }
        
      } else {
        console.log('Attempting signup for:', email, 'with name:', name);
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              plan: selectedPlan // Store the selected plan in user metadata
            },
          },
        });
        
        if (error) throw error;
        
        console.log('Signup response:', data.user?.id);
        
        // Check if email confirmation is required
        if (data.user && !data.session) {
          // Email confirmation required
          setError('Please check your email and click the confirmation link to complete your account setup, then try logging in.');
          setIsLogin(true); // Switch to login mode
          return;
        } else if (data.user && data.session) {
          // Auto-confirm is enabled, session is immediately available
          console.log('Signup with immediate session, proceeding...');
          onSuccess();
        } else {
          throw new Error('Signup failed - no user created');
        }
      }
      
    } catch (error: any) {
      console.error('Auth error:', error);
      
      // Handle specific error cases
      if (error.message?.includes('email rate limit exceeded') || 
          error.code === 'over_email_send_rate_limit') {
        setError('Too many signup attempts. Please wait a few minutes before trying again.');
      } else if (error.message?.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please check your credentials and try again.');
      } else if (error.message?.includes('Email not confirmed')) {
        setError('Please check your email and click the confirmation link before signing in.');
      } else if (error.message?.includes('User already registered')) {
        setError('An account with this email already exists. Please try logging in instead.');
        setIsLogin(true);
      } else {
        setError(error.message || 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // For debugging - only in development
  const handleResetAuth = async () => {
    await resetAuth();
    setError('Auth state has been reset. You can try again now.');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-8">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {isLogin ? 'Sign In' : 'Create Account'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={!isLogin}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter your full name"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selected Plan
                </label>
                <div className="bg-gray-100 p-3 rounded-lg">
                  <div className="font-medium text-purple-600">
                    {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} Plan
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    You selected this plan on the pricing page
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-teal-500 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>{isLogin ? 'Signing In...' : 'Creating Account...'}</span>
                </>
              ) : (
                <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
              )}
            </button>

            {process.env.NODE_ENV === 'development' && (
              <button
                type="button"
                onClick={handleResetAuth}
                className="w-full mt-2 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg text-sm"
              >
                Reset Auth State (Debug)
              </button>
            )}
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError(null);
                }}
                className="ml-2 text-purple-600 hover:text-purple-700 font-medium"
              >
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>

          {!isLogin && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-blue-800 text-sm">
                By creating an account, you'll start with our {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} plan. You can upgrade or downgrade anytime.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;