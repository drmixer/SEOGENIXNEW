import React, { useState } from 'react';
import { X, Send, Star, ThumbsUp, ThumbsDown, Smile, Frown, Loader } from 'lucide-react';
import { userDataService } from '../services/userDataService';
import Modal from './ui/Modal';

interface FeedbackModalProps {
  onClose: () => void;
  user: any;
  userPlan: 'free' | 'core' | 'pro' | 'agency';
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ onClose, user, userPlan }) => {
  const [feedbackType, setFeedbackType] = useState<'feature' | 'improvement' | 'bug' | 'general'>('general');
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [valueRating, setValueRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Track feedback submission
      await userDataService.trackActivity({
        user_id: user.id,
        activity_type: 'feedback_submitted',
        activity_data: {
          feedbackType,
          satisfaction,
          valueRating,
          feedbackText,
          userPlan
        }
      });
      
      // In a real implementation, you might want to store this in a dedicated feedback table
      // For now, we'll just use the activity tracking
      
      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const header = (<h2 className="text-2xl font-bold text-gray-900">Share Your Feedback</h2>);
  return (
    <Modal isOpen={true} onClose={onClose} header={header} size="lg">
        {submitted ? (
          <div className="p-2 sm:p-4 text-center">
            <div className="bg-green-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <ThumbsUp className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Thank You for Your Feedback!</h3>
            <p className="text-gray-600 mb-6">
              Your input helps us improve SEOGENIX and deliver more value to our users.
            </p>
            <button
              onClick={onClose}
              className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-300"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-2 sm:p-4 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What type of feedback do you have?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFeedbackType('feature')}
                  className={`p-3 border rounded-lg text-center transition-colors ${
                    feedbackType === 'feature' 
                      ? 'border-purple-500 bg-purple-50 text-purple-700' 
                      : 'border-gray-300 hover:border-purple-300'
                  }`}
                >
                  Feature Request
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackType('improvement')}
                  className={`p-3 border rounded-lg text-center transition-colors ${
                    feedbackType === 'improvement' 
                      ? 'border-purple-500 bg-purple-50 text-purple-700' 
                      : 'border-gray-300 hover:border-purple-300'
                  }`}
                >
                  Improvement Idea
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackType('bug')}
                  className={`p-3 border rounded-lg text-center transition-colors ${
                    feedbackType === 'bug' 
                      ? 'border-purple-500 bg-purple-50 text-purple-700' 
                      : 'border-gray-300 hover:border-purple-300'
                  }`}
                >
                  Bug Report
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackType('general')}
                  className={`p-3 border rounded-lg text-center transition-colors ${
                    feedbackType === 'general' 
                      ? 'border-purple-500 bg-purple-50 text-purple-700' 
                      : 'border-gray-300 hover:border-purple-300'
                  }`}
                >
                  General Feedback
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                How satisfied are you with SEOGENIX?
              </label>
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <Frown className="w-5 h-5 text-gray-400" />
                </div>
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setSatisfaction(rating)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      satisfaction === rating
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {rating}
                  </button>
                ))}
                <div className="flex items-center">
                  <Smile className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                How valuable is SEOGENIX for your business?
              </label>
              <div className="flex space-x-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setValueRating(star)}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        valueRating !== null && star <= valueRating
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Feedback
              </label>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Please share your thoughts, suggestions, or report issues..."
                rows={5}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !feedbackText.trim()}
                className="bg-gradient-to-r from-teal-500 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Feedback</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
    </Modal>
  );
};

export default FeedbackModal;
