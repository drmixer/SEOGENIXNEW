import React, { useState } from 'react';
import Modal from 'react-modal'; // Assuming you're using react-modal or similar
import { supabase } from '../lib/supabase'; // Adjust this path to your Supabase client instance

// Ensure your root element for the modal is set for react-modal
Modal.setAppElement('#root'); // Replace '#root' with your app's root element ID, if using react-modal

interface AuthModalProps {
  onClose: () => void;
  // MODIFIED: onSuccess now includes the selectedPlan from the LandingPage
  onSuccess: (user: any, selectedPlan: 'free' | 'core' | 'pro' | 'agency') => void;
  initialMode: 'login' | 'signup';
  selectedPlan: 'free' | 'core' | 'pro' | 'agency'; // The plan the user chose on the landing page
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess, initialMode, selectedPlan }) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      let data;
      let error;

      if (mode === 'signup') {
        ({ data, error } = await supabase.auth.signUp({
          email,
          password,
          // You can add `options` here for user_metadata or email redirect
          // options: {
          //   data: {
          //     selected_plan: selectedPlan // Optionally store selected plan in user metadata
          //   }
          // }
        }));
      } else { // mode === 'login'
        ({ data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        }));
      }

      if (error) {
        console.error('Auth error:', error);
        setErrorMessage(error.message);
      } else if (data.user) {
        console.log('Auth success:', data.user.id);
        // On success, call the App.tsx's handler, passing the user and the selected plan
        onSuccess(data.user, selectedPlan);
      } else {
        // This case can happen with email confirmation flows (e.g., signUp but no user returned yet)
        setErrorMessage('Please check your email for a confirmation link.');
      }
    } catch (err: any) {
      console.error('Unexpected auth error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onRequestClose={onClose}
      className="fixed inset-0 flex items-center justify-center p-4"
      overlayClassName="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center"
      contentLabel="Authentication Modal"
    >
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl"
          aria-label="Close"
        >
          &times;
        </button>
        <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">
          {mode === 'login' ? 'Login' : 'Sign Up'}
        </h2>

        {errorMessage && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleAuth}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="your@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="mb-6">
            <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg w-full transition duration-200 flex items-center justify-center"
            disabled={loading}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              mode === 'login' ? 'Login' : 'Sign Up'
            )}
          </button>
        </form>

        <p className="text-center text-gray-600 text-sm mt-6">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button
                onClick={() => setMode('signup')}
                className="text-purple-600 hover:text-purple-800 font-bold"
                disabled={loading}
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => setMode('login')}
                className="text-purple-600 hover:text-purple-800 font-bold"
                disabled={loading}
              >
                Login
              </button>
            </>
          )}
        </p>
        {/* Optional: Password reset link */}
        {mode === 'login' && (
          <p className="text-center text-gray-600 text-sm mt-2">
            <a href="#" className="text-purple-600 hover:text-purple-800 font-bold"
               onClick={() => { /* Implement password reset flow */ alert("Password reset not implemented yet."); }}>
              Forgot password?
            </a>
          </p>
        )}
      </div>
    </Modal>
  );
};

export default AuthModal;
