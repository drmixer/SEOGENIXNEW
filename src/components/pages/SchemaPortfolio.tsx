import React, { useEffect, useState } from 'react';
import { Shield, CheckCircle, AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';
import { apiService } from '../../services/api';
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
  const [validating, setValidating] = useState<boolean>(false);
  const [coverage, setCoverage] = useState<{ total: number; applied: number; valid: number; invalid: number }>({ total: 0, applied: 0, valid: 0, invalid: 0 });

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
        const arr = Array.from(byUrl.values());
        setRows(arr);
        const total = arr.length;
        const applied = arr.filter(r => r.schemaApplied).length;
        const valid = arr.filter(r => r.schemaValid === true).length;
        const invalid = arr.filter(r => r.schemaValid === false).length;
        setCoverage({ total, applied, valid, invalid });
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
          onClick={async () => {
            if (!selectedProjectId) return;
            setValidating(true);
            try {
              const resp = await apiService.batchValidateSchemas(selectedProjectId);
              const map = new Map(resp.results.map(r => [r.url, r]));
              const updated = rows.map(r => {
                const hit = map.get(r.url);
                return hit ? { ...r, schemaValid: !!hit.valid, issues: Array.isArray(hit.issues) ? hit.issues.length : r.issues } : r;
              });
              setRows(updated);
              const total = updated.length;
              const applied = updated.filter(x => x.schemaApplied).length;
              const valid = updated.filter(x => x.schemaValid === true).length;
              const invalid = updated.filter(x => x.schemaValid === false).length;
              setCoverage({ total, applied, valid, invalid });
            } catch (e: any) {
              setError(e?.message || 'Batch validation failed');
            } finally {
              setValidating(false);
            }
          }}
          className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded border text-sm ${validating ? 'border-gray-200 text-gray-400' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          disabled={validating}
          title="Validate schema for pages with saved drafts"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Batch Validate</span>
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-50 p-3 rounded border text-center">
          <div className="text-xl font-bold text-gray-900">{coverage.total}</div>
          <div className="text-xs text-gray-600">Pages</div>
        </div>
        <div className="bg-blue-50 p-3 rounded border border-blue-200 text-center">
          <div className="text-xl font-bold text-blue-700">{coverage.applied}</div>
          <div className="text-xs text-blue-700">With Schema</div>
        </div>
        <div className="bg-green-50 p-3 rounded border border-green-200 text-center">
          <div className="text-xl font-bold text-green-700">{coverage.valid}</div>
          <div className="text-xs text-green-700">Valid</div>
        </div>
        <div className="bg-red-50 p-3 rounded border border-red-200 text-center">
          <div className="text-xl font-bold text-red-700">{coverage.invalid}</div>
          <div className="text-xs text-red-700">Invalid</div>
        </div>
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
