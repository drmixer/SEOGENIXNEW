import React, { useState } from 'react';
import { 
  FileText, 
  Shield,
  Search, 
  Mic, 
  Globe, 
  Users, 
  Zap, 
  TrendingUp,
  Lightbulb,
  BarChart3,
  Lock,
  ExternalLink,
  Loader,
  X,
  ChevronDown,
  Radar,
  Plus,
  Trash2,
  Save
} from 'lucide-react';
import { apiService } from '../services/api';
import { userDataService } from '../services/userDataService';
import { supabase } from '../lib/supabase';

interface ToolsGridProps {
  userPlan: 'free' | 'core' | 'pro' | 'agency';
  onToolRun?: () => void;
  showPreview?: boolean;
  selectedTool?: string;
  selectedWebsite?: string;
  userProfile?: any;
  onToolComplete?: (toolName: string, success: boolean, message?: string) => void;
}

interface ToolModalProps {
  tool: any;
  onClose: () => void;
  userPlan: string;
  onToolRun?: () => void;
  selectedWebsite?: string;
  userProfile?: any;
  onToolComplete?: (toolName: string, success: boolean, message?: string) => void;
}

const ToolModal: React.FC<ToolModalProps> = ({ 
  tool, 
  onClose, 
  userPlan, 
  onToolRun, 
  selectedWebsite, 
  userProfile,
  onToolComplete 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [formData, setFormData] = useState<any>({
    url: selectedWebsite || (userProfile?.websites?.[0]?.url || ''),
    // Pre-populate with user data where applicable
    industry: userProfile?.industry || '',
    competitors: userProfile?.competitors?.map((c: any) => c.url).join(', ') || ''
  });

  // Citation tracking specific state
  const [savedPrompts, setSavedPrompts] = useState<any[]>([]);
  const [fingerprintPhrases, setFingerprintPhrases] = useState<any[]>([]);
  const [showSavedPrompts, setShowSavedPrompts] = useState(false);
  const [showFingerprintManager, setShowFingerprintManager] = useState(false);
  const [newFingerprintPhrase, setNewFingerprintPhrase] = useState('');
  const [newFingerprintDescription, setNewFingerprintDescription] = useState('');

  // Load citation tracking data
  React.useEffect(() => {
    if (tool.id === 'citations') {
      loadCitationData();
    }
  }, [tool.id]);

  const loadCitationData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const [prompts, phrases] = await Promise.all([
          userDataService.getSavedCitationPrompts(user.id),
          userDataService.getFingerprintPhrases(user.id)
        ]);
        setSavedPrompts(prompts);
        setFingerprintPhrases(phrases);
      }
    } catch (error) {
      console.error('Error loading citation data:', error);
    }
  };

  const saveFingerprintPhrase = async () => {
    if (!newFingerprintPhrase.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await userDataService.saveFingerprintPhrase({
          user_id: user.id,
          phrase: newFingerprintPhrase,
          description: newFingerprintDescription
        });
        setNewFingerprintPhrase('');
        setNewFingerprintDescription('');
        await loadCitationData();
      }
    } catch (error) {
      console.error('Error saving fingerprint phrase:', error);
    }
  };

  const deleteFingerprintPhrase = async (phraseId: string) => {
    try {
      await userDataService.deleteFingerprintPhrase(phraseId);
      await loadCitationData();
    } catch (error) {
      console.error('Error deleting fingerprint phrase:', error);
    }
  };

  const rerunSavedPrompt = async (prompt: any) => {
    setFormData({
      ...formData,
      url: prompt.domain,
      keywords: prompt.keywords.join(', ')
    });
    setShowSavedPrompts(false);
    // Trigger the citation tracking
    handleSubmit(new Event('submit') as any);
  };

  // Get available websites from user profile
  const availableWebsites = userProfile?.websites || [];
  const availableCompetitors = userProfile?.competitors || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);

    try {
      let response;
      
      // Use selected website from dropdown
      const urlToUse = formData.url || availableWebsites[0]?.url || 'https://example.com';
      
      switch (tool.id) {
        case 'audit':
          response = await apiService.runAudit(urlToUse, formData.content);
          break;
        case 'schema':
          response = await apiService.generateSchema(urlToUse, formData.contentType || 'article');
          break;
        case 'citations':
          const domain = urlToUse.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
          const keywords = formData.keywords?.split(',').map((k: string) => k.trim()) || ['AI', 'SEO'];
          const selectedFingerprints = fingerprintPhrases
            .filter(fp => formData[`fingerprint_${fp.id}`])
            .map(fp => fp.phrase);
          
          response = await apiService.trackCitations(domain, keywords, selectedFingerprints, formData.savePrompt);
          break;
        case 'voice':
          response = await apiService.testVoiceAssistants(formData.query || 'What is AI SEO?', ['siri', 'alexa', 'google']);
          break;
        case 'optimizer':
          response = await apiService.optimizeContent(
            formData.content || 'Sample content to optimize',
            formData.keywords?.split(',') || ['AI', 'SEO'],
            formData.contentType || 'article'
          );
          break;
        case 'summaries':
          response = await apiService.generateLLMSummary(
            urlToUse,
            formData.summaryType || 'overview',
            formData.content
          );
          break;
        case 'entities':
          response = await apiService.analyzeEntityCoverage(
            urlToUse,
            formData.content,
            formData.industry || userProfile?.industry,
            formData.competitors?.split(',').map((c: string) => c.trim()).filter((c: string) => c) || 
            userProfile?.competitors?.map((c: any) => c.url) || []
          );
          break;
        case 'generator':
          response = await apiService.generateAIContent(
            formData.contentType || 'faq',
            formData.topic || 'AI SEO',
            formData.keywords?.split(',') || ['AI', 'SEO'],
            formData.tone,
            formData.industry || userProfile?.industry,
            formData.targetAudience,
            formData.contentLength
          );
          break;
        case 'prompts':
          response = await apiService.generatePromptSuggestions(
            formData.topic || 'AI SEO',
            formData.industry || userProfile?.industry,
            formData.targetAudience,
            formData.contentType,
            formData.userIntent
          );
          break;
        case 'competitive':
          const competitorUrls = formData.competitorUrls?.split(',').map((url: string) => url.trim()).filter((url: string) => url) || 
                                userProfile?.competitors?.map((c: any) => c.url) || 
                                ['https://competitor1.com'];
          response = await apiService.performCompetitiveAnalysis(
            urlToUse,
            competitorUrls,
            formData.industry || userProfile?.industry,
            formData.analysisType
          );
          break;
        case 'discovery':
          response = await apiService.discoverCompetitors(
            urlToUse,
            formData.industry || userProfile?.industry,
            userProfile?.business_description,
            userProfile?.competitors?.map((c: any) => c.url) || [],
            formData.analysisDepth || 'basic'
          );
          break;
        default:
          response = { message: 'Tool functionality coming soon!' };
      }
      
      setResult(response);
      
      // Mark that user has run a tool
      if (onToolRun) {
        localStorage.setItem('seogenix_tools_run', 'true');
        onToolRun();
      }

      // Notify parent of successful completion
      if (onToolComplete) {
        onToolComplete(tool.name, true, 'Tool executed successfully');
      }
    } catch (error) {
      console.error('Tool error:', error);
      const errorResult = { 
        error: `Failed to execute ${tool.name}. Please check your internet connection and try again.`,
        details: error.message 
      };
      setResult(errorResult);

      // Notify parent of failed completion
      if (onToolComplete) {
        onToolComplete(tool.name, false, errorResult.error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderWebsiteSelector = () => {
    if (availableWebsites.length === 0) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 text-sm">
            No websites found in your profile. Please complete onboarding to add your websites.
          </p>
        </div>
      );
    }

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
        <div className="relative">
          <select
            value={formData.url}
            onChange={(e) => setFormData({...formData, url: e.target.value})}
            className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            {availableWebsites.map((website: any, index: number) => (
              <option key={index} value={website.url}>
                {website.name} ({website.url})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Select from your registered websites
        </p>
      </div>
    );
  };

  const renderCitationTrackingForm = () => {
    return (
      <div className="space-y-4">
        {renderWebsiteSelector()}
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Keywords (comma-separated)</label>
          <input
            type="text"
            value={formData.keywords || ''}
            onChange={(e) => setFormData({...formData, keywords: e.target.value})}
            placeholder="AI, SEO, optimization"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Fingerprint Phrases Selection */}
        {fingerprintPhrases.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fingerprint Phrases</label>
            <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-3">
              {fingerprintPhrases.map((phrase) => (
                <label key={phrase.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData[`fingerprint_${phrase.id}`] || false}
                    onChange={(e) => setFormData({
                      ...formData,
                      [`fingerprint_${phrase.id}`]: e.target.checked
                    })}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">{phrase.phrase}</span>
                  {phrase.description && (
                    <span className="text-xs text-gray-500">({phrase.description})</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Save Prompt Option */}
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={formData.savePrompt || false}
            onChange={(e) => setFormData({...formData, savePrompt: e.target.checked})}
            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <span className="text-sm text-gray-700">Save this search for future use</span>
        </label>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowSavedPrompts(true)}
            className="text-blue-600 hover:text-blue-700 text-sm flex items-center space-x-1"
          >
            <Search className="w-4 h-4" />
            <span>Saved Searches</span>
          </button>
          <button
            type="button"
            onClick={() => setShowFingerprintManager(true)}
            className="text-purple-600 hover:text-purple-700 text-sm flex items-center space-x-1"
          >
            <Plus className="w-4 h-4" />
            <span>Manage Phrases</span>
          </button>
        </div>
      </div>
    );
  };

  const renderForm = () => {
    switch (tool.id) {
      case 'audit':
        return (
          <div className="space-y-4">
            {renderWebsiteSelector()}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content (optional)</label>
              <textarea
                value={formData.content || ''}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
                placeholder="Paste content to analyze..."
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        );
      
      case 'schema':
        return (
          <div className="space-y-4">
            {renderWebsiteSelector()}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
              <select
                value={formData.contentType || 'article'}
                onChange={(e) => setFormData({...formData, contentType: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="article">Article</option>
                <option value="product">Product</option>
                <option value="organization">Organization</option>
                <option value="person">Person</option>
                <option value="faq">FAQ</option>
                <option value="howto">How-To</option>
              </select>
            </div>
          </div>
        );
      
      case 'citations':
        return renderCitationTrackingForm();
      
      case 'voice':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Voice Query</label>
              <input
                type="text"
                value={formData.query || ''}
                onChange={(e) => setFormData({...formData, query: e.target.value})}
                placeholder="What is AI SEO?"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        );
      
      case 'optimizer':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content to Optimize</label>
              <textarea
                value={formData.content || ''}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
                placeholder="Enter content to optimize for AI visibility..."
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Keywords</label>
              <input
                type="text"
                value={formData.keywords || ''}
                onChange={(e) => setFormData({...formData, keywords: e.target.value})}
                placeholder="AI, SEO, optimization"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        );
      
      case 'summaries':
        return (
          <div className="space-y-4">
            {renderWebsiteSelector()}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Summary Type</label>
              <select
                value={formData.summaryType || 'overview'}
                onChange={(e) => setFormData({...formData, summaryType: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="overview">Overview</option>
                <option value="technical">Technical</option>
                <option value="business">Business</option>
                <option value="audience">Audience</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content (optional)</label>
              <textarea
                value={formData.content || ''}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
                placeholder="Paste content to analyze..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        );
      
      case 'entities':
        return (
          <div className="space-y-4">
            {renderWebsiteSelector()}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
              <input
                type="text"
                value={formData.industry}
                onChange={(e) => setFormData({...formData, industry: e.target.value})}
                placeholder="Technology, Healthcare, Finance..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              {userProfile?.industry && (
                <p className="text-xs text-gray-500 mt-1">From your profile: {userProfile.industry}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Competitors</label>
              <input
                type="text"
                value={formData.competitors}
                onChange={(e) => setFormData({...formData, competitors: e.target.value})}
                placeholder="competitor1.com, competitor2.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              {userProfile?.competitors?.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  From your profile: {userProfile.competitors.map((c: any) => c.name).join(', ')}
                </p>
              )}
            </div>
          </div>
        );
      
      case 'generator':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
              <select
                value={formData.contentType || 'faq'}
                onChange={(e) => setFormData({...formData, contentType: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="faq">FAQ</option>
                <option value="meta-tags">Meta Tags</option>
                <option value="snippets">Featured Snippets</option>
                <option value="headings">Headings</option>
                <option value="descriptions">Descriptions</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
              <input
                type="text"
                value={formData.topic || ''}
                onChange={(e) => setFormData({...formData, topic: e.target.value})}
                placeholder="AI SEO, Machine Learning, etc."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Keywords</label>
              <input
                type="text"
                value={formData.keywords || ''}
                onChange={(e) => setFormData({...formData, keywords: e.target.value})}
                placeholder="AI, SEO, optimization"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                <select
                  value={formData.tone || 'professional'}
                  onChange={(e) => setFormData({...formData, tone: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="technical">Technical</option>
                  <option value="friendly">Friendly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Length</label>
                <select
                  value={formData.contentLength || 'medium'}
                  onChange={(e) => setFormData({...formData, contentLength: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  <option value="long">Long</option>
                </select>
              </div>
            </div>
            {userProfile?.industry && (
              <p className="text-xs text-gray-500">Industry from profile: {userProfile.industry}</p>
            )}
          </div>
        );
      
      case 'prompts':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
              <input
                type="text"
                value={formData.topic || ''}
                onChange={(e) => setFormData({...formData, topic: e.target.value})}
                placeholder="AI SEO, Machine Learning, etc."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
              <input
                type="text"
                value={formData.industry}
                onChange={(e) => setFormData({...formData, industry: e.target.value})}
                placeholder="Technology, Healthcare, Finance..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
                <select
                  value={formData.contentType || 'article'}
                  onChange={(e) => setFormData({...formData, contentType: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="article">Article</option>
                  <option value="product">Product</option>
                  <option value="service">Service</option>
                  <option value="faq">FAQ</option>
                  <option value="guide">Guide</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User Intent</label>
                <select
                  value={formData.userIntent || 'informational'}
                  onChange={(e) => setFormData({...formData, userIntent: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="informational">Informational</option>
                  <option value="transactional">Transactional</option>
                  <option value="navigational">Navigational</option>
                  <option value="commercial">Commercial</option>
                </select>
              </div>
            </div>
          </div>
        );
      
      case 'competitive':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Website</label>
              <div className="relative">
                <select
                  value={formData.url}
                  onChange={(e) => setFormData({...formData, url: e.target.value, primaryUrl: e.target.value})}
                  className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {availableWebsites.map((website: any, index: number) => (
                    <option key={index} value={website.url}>
                      {website.name} ({website.url})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Competitor URLs</label>
              <textarea
                value={formData.competitorUrls || formData.competitors}
                onChange={(e) => setFormData({...formData, competitorUrls: e.target.value})}
                placeholder="https://competitor1.com, https://competitor2.com"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              {userProfile?.competitors?.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  From your profile: {userProfile.competitors.map((c: any) => c.url).join(', ')}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                <input
                  type="text"
                  value={formData.industry}
                  onChange={(e) => setFormData({...formData, industry: e.target.value})}
                  placeholder="Technology, Healthcare..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Analysis Type</label>
                <select
                  value={formData.analysisType || 'basic'}
                  onChange={(e) => setFormData({...formData, analysisType: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="basic">Basic</option>
                  <option value="detailed">Detailed</option>
                  <option value="comprehensive">Comprehensive</option>
                </select>
              </div>
            </div>
          </div>
        );
      
      case 'discovery':
        return (
          <div className="space-y-4">
            {renderWebsiteSelector()}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
              <input
                type="text"
                value={formData.industry}
                onChange={(e) => setFormData({...formData, industry: e.target.value})}
                placeholder="Technology, Healthcare, Finance..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              {userProfile?.industry && (
                <p className="text-xs text-gray-500 mt-1">From your profile: {userProfile.industry}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Analysis Depth</label>
              <select
                value={formData.analysisDepth || 'basic'}
                onChange={(e) => setFormData({...formData, analysisDepth: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="basic">Basic Discovery</option>
                <option value="comprehensive">Comprehensive Analysis</option>
              </select>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="text-center py-8">
            <p className="text-gray-600">This tool is coming soon!</p>
          </div>
        );
    }
  };

  const renderResult = () => {
    if (!result) return null;

    if (result.error) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{result.error}</p>
        </div>
      );
    }

    switch (tool.id) {
      case 'audit':
        return (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-900 mb-2">Audit Results</h4>
              <p className="text-green-800">Overall Score: <strong>{result.overallScore}/100</strong></p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>AI Understanding: {result.subscores.aiUnderstanding}</div>
                <div>Citation Likelihood: {result.subscores.citationLikelihood}</div>
                <div>Conversational: {result.subscores.conversationalReadiness}</div>
                <div>Structure: {result.subscores.contentStructure}</div>
              </div>
            </div>
            <div>
              <h5 className="font-medium text-gray-900 mb-2">Recommendations:</h5>
              <ul className="text-sm text-gray-600 space-y-1">
                {result.recommendations.map((rec: string, i: number) => (
                  <li key={i}>• {rec}</li>
                ))}
              </ul>
            </div>
          </div>
        );
      
      case 'schema':
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Generated Schema</h4>
              <p className="text-blue-800 text-sm mb-3">{result.instructions}</p>
              <pre className="bg-white p-3 rounded border text-xs overflow-x-auto">
                {result.implementation}
              </pre>
            </div>
          </div>
        );
      
      case 'citations':
        return (
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-medium text-purple-900 mb-2">Citation Results</h4>
              <p className="text-purple-800">Found {result.total} mentions across platforms</p>
              {result.confidenceBreakdown && (
                <div className="mt-2 text-sm text-purple-700">
                  High confidence: {result.confidenceBreakdown.high} | 
                  Medium: {result.confidenceBreakdown.medium} | 
                  Low: {result.confidenceBreakdown.low}
                </div>
              )}
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {result.citations.slice(0, 10).map((citation: any, i: number) => (
                <div key={i} className="border border-gray-200 rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{citation.source}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">{citation.type}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        citation.confidence_score >= 80 ? 'bg-green-100 text-green-800' :
                        citation.confidence_score >= 50 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {citation.confidence_score}% confidence
                      </span>
                      {citation.match_type === 'fingerprint' && (
                        <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800">
                          Fingerprint Match
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{citation.snippet}</p>
                  <a href={citation.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center mt-1">
                    View source <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        );
      
      case 'voice':
        return (
          <div className="space-y-4">
            {result.results.map((test: any, i: number) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium">{test.assistant}</h5>
                  <span className={`text-sm px-2 py-1 rounded ${test.mentioned ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {test.mentioned ? 'Mentioned' : 'Not Mentioned'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{test.response}</p>
                {test.mentioned && (
                  <p className="text-xs text-gray-500">Ranking: #{test.ranking} | Confidence: {test.confidence}%</p>
                )}
              </div>
            ))}
          </div>
        );
      
      case 'optimizer':
        return (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-900 mb-2">Optimization Results</h4>
              <p className="text-green-800">Score improved from {result.originalScore} to {result.optimizedScore} (+{result.improvement} points)</p>
            </div>
            <div>
              <h5 className="font-medium text-gray-900 mb-2">Optimized Content:</h5>
              <div className="bg-gray-50 p-3 rounded border text-sm max-h-40 overflow-y-auto">
                {result.optimizedContent}
              </div>
            </div>
          </div>
        );
      
      case 'summaries':
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">LLM Summary ({result.summaryType})</h4>
              <p className="text-blue-800 text-sm">{result.summary}</p>
              <p className="text-xs text-blue-600 mt-2">Word count: {result.wordCount}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Key Entities:</h5>
                <ul className="text-sm text-gray-600 space-y-1">
                  {result.entities.slice(0, 5).map((entity: string, i: number) => (
                    <li key={i}>• {entity}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Main Topics:</h5>
                <ul className="text-sm text-gray-600 space-y-1">
                  {result.topics.slice(0, 5).map((topic: string, i: number) => (
                    <li key={i}>• {topic}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );
      
      case 'entities':
        return (
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h4 className="font-medium text-orange-900 mb-2">Entity Coverage Analysis</h4>
              <p className="text-orange-800">Coverage Score: {result.coverageScore}% ({result.mentionedCount}/{result.totalEntities} entities)</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Missing Entities:</h5>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {result.missingEntities.slice(0, 5).map((entity: any, i: number) => (
                    <div key={i} className="text-sm border-l-2 border-red-300 pl-2">
                      <span className="font-medium">{entity.name}</span> ({entity.type})
                      <p className="text-gray-600 text-xs">{entity.description}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Recommendations:</h5>
                <ul className="text-sm text-gray-600 space-y-1">
                  {result.recommendations.slice(0, 3).map((rec: string, i: number) => (
                    <li key={i}>• {rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );
      
      case 'generator':
        return (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-900 mb-2">Generated {result.contentType} Content</h4>
              <p className="text-green-800 text-sm">Word count: {result.wordCount}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded border max-h-60 overflow-y-auto">
              {result.generatedContent.faqs ? (
                <div className="space-y-3">
                  {result.generatedContent.faqs.map((faq: any, i: number) => (
                    <div key={i} className="border-b border-gray-200 pb-2">
                      <p className="font-medium text-sm">{faq.question}</p>
                      <p className="text-sm text-gray-600 mt-1">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              ) : result.generatedContent.metaTags ? (
                <div className="space-y-2 text-sm">
                  <div><strong>Title:</strong> {result.generatedContent.metaTags.title}</div>
                  <div><strong>Description:</strong> {result.generatedContent.metaTags.description}</div>
                  <div><strong>Keywords:</strong> {result.generatedContent.metaTags.keywords}</div>
                </div>
              ) : (
                <pre className="text-sm whitespace-pre-wrap">{result.generatedContent.raw}</pre>
              )}
            </div>
          </div>
        );
      
      case 'prompts':
        return (
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-medium text-purple-900 mb-2">Prompt Suggestions</h4>
              <p className="text-purple-800">Generated {result.totalPrompts} prompts with {result.averageLikelihood}% average likelihood</p>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {result.promptSuggestions.slice(0, 8).map((prompt: any, i: number) => (
                <div key={i} className="border border-gray-200 rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">{prompt.category}</span>
                    <span className="text-xs text-gray-500">{prompt.likelihood}% likely</span>
                  </div>
                  <p className="text-sm font-medium">{prompt.prompt}</p>
                  <p className="text-xs text-gray-600 mt-1">{prompt.optimization}</p>
                </div>
              ))}
            </div>
          </div>
        );
      
      case 'competitive':
        return (
          <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <h4 className="font-medium text-indigo-900 mb-2">Competitive Analysis</h4>
              <p className="text-indigo-800">Your ranking: #{result.summary.ranking} | Your score: {result.summary.primarySiteScore}</p>
              <p className="text-indigo-800 text-sm">Position: {result.summary.competitivePosition}</p>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {result.competitorAnalyses.slice(0, 3).map((comp: any, i: number) => (
                <div key={i} className="border border-gray-200 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{comp.name}</span>
                    <span className="text-sm font-bold">{comp.overallScore}/100</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>AI Understanding: {comp.subscores.aiUnderstanding}</div>
                    <div>Citation: {comp.subscores.citationLikelihood}</div>
                    <div>Conversational: {comp.subscores.conversationalReadiness}</div>
                    <div>Structure: {comp.subscores.contentStructure}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      
      case 'discovery':
        return (
          <div className="space-y-4">
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
              <h4 className="font-medium text-teal-900 mb-2">Competitor Discovery Results</h4>
              <p className="text-teal-800">Found {result.totalSuggestions} potential competitors</p>
              <p className="text-teal-800 text-sm">Competitive intensity: {result.competitiveIntensity}</p>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {result.competitorSuggestions.slice(0, 8).map((comp: any, i: number) => (
                <div key={i} className="border border-gray-200 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{comp.name}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">{comp.type}</span>
                      <span className="text-xs text-gray-500">{comp.relevanceScore}% relevant</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{comp.reason}</p>
                  <a href={comp.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center">
                    Visit website <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        );
      
      default:
        return (
          <div className="bg-gray-50 p-4 rounded">
            <pre className="text-sm">{JSON.stringify(result, null, 2)}</pre>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">{tool.name}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex h-[calc(90vh-80px)]">
          {/* Form Section */}
          <div className="w-1/2 p-6 border-r border-gray-200 overflow-y-auto">
            <p className="text-gray-600 mb-6">{tool.description}</p>
            
            {availableWebsites.length === 0 && ['audit', 'schema', 'summaries', 'entities', 'competitive', 'discovery'].includes(tool.id) ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <div className="text-yellow-600 mb-2">
                  <Globe className="w-8 h-8 mx-auto" />
                </div>
                <h4 className="font-medium text-yellow-900 mb-2">No Websites Configured</h4>
                <p className="text-yellow-800 text-sm mb-4">
                  You need to complete onboarding and add your websites before using this tool.
                </p>
                <button
                  onClick={onClose}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-yellow-700 transition-colors"
                >
                  Complete Onboarding First
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {renderForm()}
                
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-teal-500 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>Run {tool.name}</span>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Results Section */}
          <div className="w-1/2 p-6 overflow-y-auto bg-gray-50">
            {result ? (
              <div>
                <h4 className="font-medium text-gray-900 mb-4 flex items-center space-x-2">
                  <span>Results</span>
                  {!result.error && (
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                      Success
                    </span>
                  )}
                </h4>
                {renderResult()}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <div className="text-gray-400 mb-4">
                    <FileText className="w-16 h-16 mx-auto" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Ready to Run</h4>
                  <p className="text-gray-600">
                    Fill out the form and click "Run {tool.name}" to see your results here.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Saved Prompts Modal */}
      {showSavedPrompts && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Saved Citation Searches</h3>
              <button
                onClick={() => setShowSavedPrompts(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
              {savedPrompts.length === 0 ? (
                <p className="text-gray-500 text-center">No saved searches yet.</p>
              ) : (
                <div className="space-y-3">
                  {savedPrompts.map((prompt) => (
                    <div key={prompt.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{prompt.domain}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(prompt.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        Keywords: {prompt.keywords.join(', ')}
                      </p>
                      <button
                        onClick={() => rerunSavedPrompt(prompt)}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        Re-run Search
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fingerprint Phrases Manager Modal */}
      {showFingerprintManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Manage Fingerprint Phrases</h3>
              <button
                onClick={() => setShowFingerprintManager(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
              {/* Add New Phrase */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Add New Fingerprint Phrase</h4>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newFingerprintPhrase}
                    onChange={(e) => setNewFingerprintPhrase(e.target.value)}
                    placeholder="Enter unique phrase to track"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    value={newFingerprintDescription}
                    onChange={(e) => setNewFingerprintDescription(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <button
                    onClick={saveFingerprintPhrase}
                    disabled={!newFingerprintPhrase.trim()}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Phrase</span>
                  </button>
                </div>
              </div>

              {/* Existing Phrases */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Your Fingerprint Phrases</h4>
                {fingerprintPhrases.length === 0 ? (
                  <p className="text-gray-500 text-center">No fingerprint phrases yet.</p>
                ) : (
                  <div className="space-y-3">
                    {fingerprintPhrases.map((phrase) => (
                      <div key={phrase.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-gray-900">{phrase.phrase}</span>
                            {phrase.description && (
                              <p className="text-sm text-gray-600 mt-1">{phrase.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => deleteFingerprintPhrase(phrase.id)}
                            className="text-red-600 hover:text-red-700 p-1 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ToolsGrid: React.FC<ToolsGridProps> = ({ 
  userPlan, 
  onToolRun, 
  showPreview = false, 
  selectedTool: selectedToolProp, 
  selectedWebsite, 
  userProfile,
  onToolComplete 
}) => {
  const [selectedTool, setSelectedTool] = useState<any>(null);

  // Auto-open tool if selectedTool prop is provided
  React.useEffect(() => {
    if (selectedToolProp && !showPreview) {
      const tool = tools.find(t => t.id === selectedToolProp);
      if (tool && tool.available) {
        setSelectedTool(tool);
      }
    }
  }, [selectedToolProp, showPreview]);

  // Enable all tools for development/testing
  const isDevelopment = true; // Set to false for production

  const tools = [
    {
      id: 'audit',
      name: 'AI Visibility Audit',
      description: 'Full report analyzing content structure for AI visibility',
      icon: FileText,
      available: true, // Always available
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'schema',
      name: 'Schema Generator', 
      description: 'Generate Schema.org markup for better AI comprehension',
      icon: Shield,
      available: isDevelopment || userPlan !== 'free',
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'citations',
      name: 'Citation Tracker',
      description: 'Monitor mentions from LLMs, Google, and other platforms',
      icon: Search,
      available: isDevelopment || userPlan !== 'free',
      color: 'from-purple-500 to-purple-600'
    },
    {
      id: 'voice',
      name: 'Voice Assistant Tester',
      description: 'Simulate queries via Siri, Alexa, and Google Assistant',
      icon: Mic,
      available: isDevelopment || userPlan !== 'free',
      color: 'from-indigo-500 to-indigo-600'
    },
    {
      id: 'summaries',
      name: 'LLM Site Summaries',
      description: 'Generate summaries for language model understanding',
      icon: Globe,
      available: isDevelopment || userPlan !== 'free',
      color: 'from-teal-500 to-teal-600'
    },
    {
      id: 'optimizer',
      name: 'AI Content Optimizer',
      description: 'Score and rewrite content for maximum AI visibility',
      icon: TrendingUp,
      available: isDevelopment || userPlan !== 'free',
      color: 'from-orange-500 to-orange-600'
    },
    {
      id: 'entities',
      name: 'Entity Coverage Analyzer',
      description: 'Identify missing people, places, and topics',
      icon: Users,
      available: isDevelopment || ['pro', 'agency'].includes(userPlan),
      color: 'from-pink-500 to-pink-600'
    },
    {
      id: 'generator',
      name: 'AI Content Generator',
      description: 'Create optimized FAQs, snippets, and meta tags',
      icon: Zap,
      available: isDevelopment || ['pro', 'agency'].includes(userPlan),
      color: 'from-yellow-500 to-yellow-600'
    },
    {
      id: 'prompts',
      name: 'Prompt Match Suggestions',
      description: 'Generate prompts aligned with user AI queries',
      icon: Lightbulb,
      available: isDevelopment || ['pro', 'agency'].includes(userPlan),
      color: 'from-cyan-500 to-cyan-600'
    },
    {
      id: 'competitive',
      name: 'Competitive Analysis',
      description: 'Compare visibility scores against competitors',
      icon: BarChart3,
      available: isDevelopment || ['pro', 'agency'].includes(userPlan),
      color: 'from-red-500 to-red-600'
    },
    {
      id: 'discovery',
      name: 'Competitor Discovery',
      description: 'Find new competitors you should be tracking',
      icon: Radar,
      available: isDevelopment || ['core', 'pro', 'agency'].includes(userPlan),
      color: 'from-emerald-500 to-emerald-600'
    }
  ];

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">AI Optimization Tools</h2>
          <p className="text-gray-600">
            {showPreview ? 'Preview of available tools - run your first audit to unlock full dashboard' : 'Click any available tool to get started'}
          </p>
        </div>
        
        {isDevelopment && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">
              <strong>Development Mode:</strong> All tools are enabled for testing with real API data.
            </p>
          </div>
        )}

        {selectedWebsite && !showPreview && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              <strong>Active Website:</strong> {selectedWebsite} - All tools will use this website by default.
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(showPreview ? tools.slice(0, 6) : tools).map((tool, index) => {
            const IconComponent = tool.icon;
            
            return (
              <div 
                key={index}
                data-walkthrough={tool.id === 'audit' ? 'audit-tool' : undefined}
                className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 ${
                  tool.available && !showPreview
                    ? 'hover:shadow-lg hover:border-purple-200 cursor-pointer' 
                    : 'opacity-60'
                }`}
                onClick={() => tool.available && !showPreview && setSelectedTool(tool)}
              >
                <div className={`h-2 bg-gradient-to-r ${tool.color}`}></div>
                
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg bg-gradient-to-r ${tool.color}`}>
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                    {!tool.available && !isDevelopment && (
                      <div className="bg-gray-100 p-1 rounded-full">
                        <Lock className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{tool.name}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">{tool.description}</p>
                  
                  {tool.available && !showPreview ? (
                    <button className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium transition-colors">
                      {tool.id === 'audit' ? 'Run Audit' : 'Launch Tool'}
                    </button>
                  ) : showPreview ? (
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-2">Available after first audit</p>
                      <div className="bg-gray-100 text-gray-500 py-2 px-4 rounded-lg text-xs">
                        Preview Mode
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-2">
                        Available with {userPlan === 'free' ? 'Core' : 'Pro'} plan
                      </p>
                      <button className="bg-gradient-to-r from-teal-500 to-purple-600 text-white py-2 px-4 rounded-lg text-xs hover:shadow-lg transition-all duration-300">
                        Upgrade Plan
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {showPreview && (
          <div className="text-center mt-8">
            <p className="text-gray-500 text-sm">
              And {tools.length - 6} more tools available after running your first audit...
            </p>
          </div>
        )}
      </div>

      {selectedTool && (
        <ToolModal
          tool={selectedTool}
          onClose={() => setSelectedTool(null)}
          userPlan={userPlan}
          onToolRun={onToolRun}
          selectedWebsite={selectedWebsite}
          userProfile={userProfile}
          onToolComplete={onToolComplete}
        />
      )}
    </>
  );
};

export default ToolsGrid;