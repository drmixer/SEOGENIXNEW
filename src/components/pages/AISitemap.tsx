import React, { useState } from 'react';
import { Globe, Download, Loader, Copy, UploadCloud } from 'lucide-react';
import { apiService } from '../../services/api';
import { supabase } from '../../lib/supabase';

interface AISitemapProps {
  selectedProjectId?: string;
}

const AISitemap: React.FC<AISitemapProps> = ({ selectedProjectId }) => {
  const [json, setJson] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchContent, setFetchContent] = useState<boolean>(false);

  const run = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.generateAISitemap(selectedProjectId, undefined, fetchContent);
      setJson(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to generate AI Sitemap');
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(json, null, 2));
    } catch {}
  };

  const download = () => {
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ai.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const uploadToStorage = async () => {
    if (!selectedProjectId || !json) return;
    try {
      const content = JSON.stringify(json, null, 2);
      const path = `${selectedProjectId}/ai.json`;
      const { error } = await supabase.storage.from('ai-sitemaps').upload(path, new Blob([content], { type: 'application/json' }), { upsert: true, contentType: 'application/json' as any });
      if (error) throw error;
      const { data } = supabase.storage.from('ai-sitemaps').getPublicUrl(path);
      alert(`Uploaded to storage. Public URL: ${data.publicUrl}`);
    } catch (e: any) {
      alert(`Upload failed: ${e?.message || 'Storage bucket missing? Create bucket ai-sitemaps.'}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Globe className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">AI Sitemap</h2>
        </div>
        <div className="flex items-center space-x-3">
          <label className="text-sm text-gray-700 flex items-center space-x-2">
            <input type="checkbox" checked={fetchContent} onChange={(e)=> setFetchContent(e.target.checked)} />
            <span>Fetch summaries</span>
          </label>
          <button onClick={run} disabled={!selectedProjectId || loading} className="px-3 py-1.5 rounded bg-purple-600 text-white text-sm hover:bg-purple-700 inline-flex items-center space-x-2">
            {loading ? <Loader className="w-4 h-4 animate-spin"/> : null}
            <span>Generate</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded border border-red-200 bg-red-50 text-red-800 text-sm">{error}</div>
      )}

      {json && (
        <div className="bg-gray-900 text-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-300">ai.json preview</div>
          <div className="space-x-2">
            <button onClick={copy} className="text-xs inline-flex items-center space-x-1 px-2 py-1 rounded bg-gray-800 text-gray-100"><Copy className="w-4 h-4"/> <span>Copy</span></button>
            <button onClick={download} className="text-xs inline-flex items-center space-x-1 px-2 py-1 rounded bg-gray-800 text-gray-100"><Download className="w-4 h-4"/> <span>Download</span></button>
            <button onClick={uploadToStorage} className="text-xs inline-flex items-center space-x-1 px-2 py-1 rounded bg-gray-800 text-gray-100"><UploadCloud className="w-4 h-4"/> <span>Upload</span></button>
          </div>
          </div>
          <pre className="text-xs overflow-auto max-h-[420px]">{JSON.stringify(json, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default AISitemap;
