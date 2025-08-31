import React, { useEffect, useState } from 'react';
import { Shield, CheckCircle, AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SchemaPortfolioProps {
  selectedProjectId?: string;
}

type Row = {
  url: string;
  lastChecked?: string;
  schemaApplied?: boolean;
  schemaValid?: boolean | null;
  issues?: number;
  permalink?: string;
};

const SchemaPortfolio: React.FC<SchemaPortfolioProps> = ({ selectedProjectId }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!selectedProjectId) return;
      setLoading(true);
      setError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from('user_activity')
          .select('website_url, activity_type, activity_data, created_at')
          .eq('tool_id', selectedProjectId)
          .in('activity_type', ['schema_draft', 'post_publish_validation'])
          .order('created_at', { ascending: false })
          .limit(500);
        if (error) throw error;
        const byUrl = new Map<string, Row>();
        for (const a of data || []) {
          const url = a.website_url || a.activity_data?.permalink;
          if (!url) continue;
          const prev = byUrl.get(url) || { url } as Row;
          if (a.activity_type === 'schema_draft') {
            prev.schemaApplied = !!a.activity_data?.applied;
            if (typeof a.activity_data?.valid === 'boolean') prev.schemaValid = a.activity_data.valid;
            if (Array.isArray(a.activity_data?.issues)) prev.issues = a.activity_data.issues.length;
          } else if (a.activity_type === 'post_publish_validation') {
            if (typeof a.activity_data?.schemaValid === 'boolean') prev.schemaValid = a.activity_data.schemaValid;
            if (typeof a.activity_data?.issueCount === 'number') prev.issues = a.activity_data.issueCount;
            if (a.activity_data?.permalink) prev.permalink = a.activity_data.permalink;
          }
          prev.lastChecked = prev.lastChecked || a.created_at;
          byUrl.set(url, prev);
        }
        setRows(Array.from(byUrl.values()));
      } catch (e: any) {
        setError(e?.message || 'Failed to load schema portfolio');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedProjectId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">Schema Portfolio</h2>
        </div>
        <button
          onClick={() => {
            // Placeholder for future: batch validate
          }}
          className="inline-flex items-center space-x-2 px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
          title="Batch validation coming soon"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Batch Validate</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded border border-red-200 bg-red-50 text-red-800 text-sm">{error}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">URL</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Applied</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Valid</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Issues</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Last Checked</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={6}>Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={6}>No schema activity yet.</td></tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-800 truncate max-w-xs" title={r.url}>{r.url}</td>
                  <td className="px-4 py-2 text-sm">{r.schemaApplied ? <span className="inline-flex items-center text-green-700"><CheckCircle className="w-4 h-4 mr-1"/>Yes</span> : <span className="text-gray-500">No</span>}</td>
                  <td className="px-4 py-2 text-sm">{typeof r.schemaValid === 'boolean' ? (r.schemaValid ? <span className="text-green-700">Valid</span> : <span className="inline-flex items-center text-red-700"><AlertTriangle className="w-4 h-4 mr-1"/>Invalid</span>) : <span className="text-gray-500">—</span>}</td>
                  <td className="px-4 py-2 text-sm">{typeof r.issues === 'number' ? r.issues : '—'}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{r.lastChecked ? new Date(r.lastChecked).toLocaleString() : '—'}</td>
                  <td className="px-4 py-2 text-sm">
                    {r.permalink ? (
                      <a href={r.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center text-blue-600 hover:text-blue-800">
                        <ExternalLink className="w-4 h-4 mr-1"/>Open
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SchemaPortfolio;

