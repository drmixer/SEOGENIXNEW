import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart2, Loader2, Download, Repeat, Eye } from 'lucide-react';

interface VisibilityScoreProps {
  userPlan: string;
  selectedWebsite?: string;
}

type ToolRun = {
  id: string
  started_at: string
  completed_at: string | null
  status: string
  output: any
  provenance: any
  params: any
}

const TOOL_NAME = 'ai-visibility-audit';

const VisibilityScore: React.FC<VisibilityScoreProps> = ({
  userPlan,
  selectedWebsite
}) => {
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [outputFormat, setOutputFormat] = useState<string[]>(['json']);
  const [lastRun, setLastRun] = useState<ToolRun | null>(null);
  const [history, setHistory] = useState<ToolRun[]>([]);
  const [showEvidence, setShowEvidence] = useState(false);

  // Fetch latest audit result from tool_runs
  const fetchLatestAudit = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tool_runs')
        .select('*')
        .eq('tool_name', TOOL_NAME)
        .order('started_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setLastRun(data[0]);
        setScore(data[0].output?.overall_score ?? null);
      } else {
        setLastRun(null);
        setScore(null);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch history
  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('tool_runs')
      .select('*')
      .eq('tool_name', TOOL_NAME)
      .order('started_at', { ascending: false })
      .limit(10);
    if (data) setHistory(data);
  };

  useEffect(() => {
    if (selectedWebsite) {
      fetchLatestAudit();
      fetchHistory();
    }
  }, [selectedWebsite]);

  // Run new audit
  const runAudit = async () => {
    setLoading(true);
    try {
      // Replace with your own projectId logic as needed
      const projectId = localStorage.getItem('current_project_id') || 'demo-project-id';

      const { data, error } = await supabase.functions.invoke('ai-visibility-audit', {
        body: {
          projectId,
          outputFormats: outputFormat,
          domain: selectedWebsite
        }
      });

      if (error) throw new Error(error.message);
      setLastRun(data);
      setScore(data?.output?.overall_score ?? null);
      fetchHistory();
    } catch (err) {
      setScore(null);
    }
    setLoading(false);
  };

  // Download helpers
  const download = (content: string, type: string, filename: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl shadow border p-6 mb-8 flex flex-col items-center justify-center w-full max-w-xl mx-auto">
      <div className="flex items-center space-x-3">
        <BarChart2 className="w-6 h-6 text-purple-600" />
        <span className="font-bold text-xl text-gray-900">AI Visibility Score</span>
      </div>
      <div className="mt-4 mb-2">
        {loading ? (
          <Loader2 className="animate-spin w-8 h-8 text-purple-400" />
        ) : (
          <span className="text-4xl font-semibold text-purple-700">{score !== null ? score : '--'}</span>
        )}
      </div>

      <div className="flex items-center mt-2 space-x-3">
        <label className="flex items-center text-sm">
          <input
            type="checkbox"
            checked={outputFormat.includes('json')}
            onChange={e => {
              if (e.target.checked) setOutputFormat([...outputFormat, 'json']);
              else setOutputFormat(outputFormat.filter(f => f !== 'json'));
            }}
            className="mr-1"
          />
          JSON
        </label>
        <label className="flex items-center text-sm">
          <input
            type="checkbox"
            checked={outputFormat.includes('csv')}
            onChange={e => {
              if (e.target.checked) setOutputFormat([...outputFormat, 'csv']);
              else setOutputFormat(outputFormat.filter(f => f !== 'csv'));
            }}
            className="mr-1"
          />
          CSV
        </label>
      </div>

      <button
        onClick={runAudit}
        className="mt-4 px-6 py-2 bg-gradient-to-r from-teal-500 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all duration-300"
        disabled={loading}
      >
        Run Audit
      </button>

      {lastRun && lastRun.output && (
        <div className="w-full mt-6 bg-gray-50 rounded-lg p-4 flex flex-col items-center">
          <div className="font-semibold text-gray-900 mb-2">Last Audit</div>
          <div className="text-xs text-gray-500 mb-2">Run ID: {lastRun.id}</div>
          <div className="flex space-x-3">
            {lastRun.output && lastRun.output.csv && (
              <button
                className="flex items-center px-3 py-1 rounded bg-yellow-100 text-yellow-800 text-xs font-semibold"
                onClick={() => download(lastRun.output.csv, 'text/csv', `audit_${lastRun.id}.csv`)}
              >
                <Download className="w-4 h-4 mr-1" /> Download CSV
              </button>
            )}
            <button
              className="flex items-center px-3 py-1 rounded bg-blue-100 text-blue-800 text-xs font-semibold"
              onClick={() => download(JSON.stringify(lastRun.output, null, 2), 'application/json', `audit_${lastRun.id}.json`)}
            >
              <Download className="w-4 h-4 mr-1" /> Download JSON
            </button>
            <button
              className="flex items-center px-3 py-1 rounded bg-purple-100 text-purple-800 text-xs font-semibold"
              onClick={() => setShowEvidence(v => !v)}
            >
              <Eye className="w-4 h-4 mr-1" /> {showEvidence ? 'Hide' : 'View'} Evidence
            </button>
          </div>
          {showEvidence && (
            <pre className="mt-2 w-full text-xs bg-white border border-gray-100 rounded p-2 overflow-x-auto">
              {JSON.stringify(lastRun.provenance, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Audit History Table */}
      {history.length > 0 && (
        <div className="w-full mt-6">
          <div className="font-semibold text-gray-900 mb-2">Audit History</div>
          <table className="w-full text-xs bg-white rounded-lg border">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left">Run ID</th>
                <th className="px-2 py-1 text-left">Started</th>
                <th className="px-2 py-1 text-left">Status</th>
                <th className="px-2 py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map(run => (
                <tr key={run.id} className="border-t">
                  <td className="px-2 py-1">{run.id.slice(0, 8)}…</td>
                  <td className="px-2 py-1">{new Date(run.started_at).toLocaleString()}</td>
                  <td className="px-2 py-1">{run.status}</td>
                  <td className="px-2 py-1">
                    <button
                      className="flex items-center text-xs text-blue-600 hover:underline"
                      onClick={() => {
                        // Re-run with same params
                        supabase.functions.invoke('ai-visibility-audit', {
                          body: {
                            ...run.params,
                            projectId: run.params.projectId,
                            outputFormats: outputFormat
                          }
                        }).then(() => {
                          fetchLatestAudit();
                          fetchHistory();
                        });
                      }}
                    >
                      <Repeat className="w-4 h-4 mr-1" /> Re-run
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default VisibilityScore;