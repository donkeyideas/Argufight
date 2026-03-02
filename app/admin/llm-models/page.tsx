'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminStatCard } from '@/components/features/admin/admin-stat-card';
import { Download } from 'lucide-react';

type BadgeColor = 'green' | 'muted' | 'blue' | 'amber' | 'accent';

interface AppealAnalytics {
  totalAppeals: number;
  successfulAppeals: number;
  failedAppeals: number;
  successRate: number;
  averageAppealLength: number;
  topAppealReasons: Array<{ keyword: string; count: number }>;
  appealsByCategory: Array<{ category: string; count: number; successRate: number }>;
  recentAppeals: Array<{
    id: string;
    debateTopic: string;
    category: string;
    appealReason: string;
    originalWinner: string;
    newWinner: string | null;
    success: boolean | null;
    createdAt: string;
  }>;
}

interface ModelVersion {
  id: string;
  name: string;
  provider?: string | null;
  modelId?: string | null;
  isActive?: boolean | null;
  costPerToken?: number | null;
  description?: string | null;
}

function providerColor(provider: string): BadgeColor {
  const p = provider.toUpperCase();
  if (p.includes('OPENAI') || p.includes('GPT')) return 'green';
  if (p.includes('ANTHROPIC') || p.includes('CLAUDE')) return 'accent';
  if (p.includes('GOOGLE') || p.includes('GEMINI')) return 'blue';
  if (p.includes('MISTRAL') || p.includes('COHERE')) return 'amber';
  return 'muted';
}

const TABS = [
  { key: 'overview',   label: 'Appeal Analytics' },
  { key: 'models',     label: 'Model Versions' },
  { key: 'recent',     label: 'Recent Appeals' },
];

export default function AdminLlmModelsPage() {
  const [tab, setTab] = useState('overview');

  const { data: analytics, isLoading: analyticsLoading } = useQuery<AppealAnalytics>({
    queryKey: ['admin-llm-analytics'],
    queryFn: async () => {
      const res = await fetch('/api/admin/llm-models/analytics');
      if (!res.ok) throw new Error('Failed to load analytics');
      return res.json();
    },
    staleTime: 120_000,
  });

  const { data: models = [], isLoading: modelsLoading } = useQuery<ModelVersion[]>({
    queryKey: ['admin-model-versions'],
    queryFn: async () => {
      // Try to fetch from API first, fallback handled gracefully
      const res = await fetch('/api/admin/llm-models/versions');
      if (!res.ok) return [];
      const data = await res.json();
      return data.models || [];
    },
    staleTime: 120_000,
  });

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const res = await fetch(`/api/admin/llm-models/export?format=${format}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `appeal-training-data.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* export error is visible via network */ }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">LLM Model Management</h1>
          <p className="text-[17px] text-text-3 mt-0.5">Appeal analytics and AI model configuration</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => handleExport('csv')}>
            <Download size={13} className="mr-1.5" />
            Export CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleExport('json')}>
            <Download size={13} className="mr-1.5" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-2 p-1 rounded-[var(--radius)] border border-border w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-[6px] text-[16px] font-[500] transition-colors ${
              tab === t.key ? 'bg-surface text-text border border-border' : 'text-text-3 hover:text-text-2'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Appeal Analytics Tab */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {analyticsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-6 w-6 rounded-full border-2 border-border border-t-accent animate-spin" />
            </div>
          ) : analytics ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <AdminStatCard label="Total Appeals" value={analytics.totalAppeals} />
                <AdminStatCard label="Successful" value={analytics.successfulAppeals} accent />
                <AdminStatCard label="Failed" value={analytics.failedAppeals} />
                <AdminStatCard label="Success Rate" value={`${analytics.successRate}%`} accent={analytics.successRate > 50} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top Keywords */}
                <Card padding="none">
                  <div className="p-4 border-b border-border">
                    <h3 className="text-[16px] font-[500] text-text">Top Appeal Keywords</h3>
                    <p className="text-[16px] text-text-3 mt-0.5">Most common words in appeal reasons</p>
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {analytics.topAppealReasons.map((item, i) => (
                        <Badge key={i} color="muted" size="sm">
                          {item.keyword} ({item.count})
                        </Badge>
                      ))}
                      {analytics.topAppealReasons.length === 0 && (
                        <p className="text-[16px] text-text-3">No data yet.</p>
                      )}
                    </div>
                  </div>
                </Card>

                {/* By Category */}
                <Card padding="none">
                  <div className="p-4 border-b border-border">
                    <h3 className="text-[16px] font-[500] text-text">Appeals by Category</h3>
                  </div>
                  <div className="p-4 space-y-2">
                    {analytics.appealsByCategory.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-surface-2 rounded-[var(--radius)]">
                        <div>
                          <p className="text-[16px] font-[500] text-text">{item.category}</p>
                          <p className="text-[15px] text-text-3">{item.count} appeals</p>
                        </div>
                        <p className="text-[17px] font-[500] text-accent">{item.successRate}%</p>
                      </div>
                    ))}
                    {analytics.appealsByCategory.length === 0 && (
                      <p className="text-[16px] text-text-3">No data yet.</p>
                    )}
                  </div>
                </Card>
              </div>

              <Card padding="md">
                <p className="text-[16px] text-text-2">Average appeal length: <span className="text-text font-[500]">{analytics.averageAppealLength} characters</span></p>
              </Card>
            </>
          ) : (
            <Card padding="lg">
              <p className="text-[17px] text-text-3 text-center">No appeal analytics available.</p>
            </Card>
          )}
        </div>
      )}

      {/* Model Versions Tab */}
      {tab === 'models' && (
        <div className="space-y-4">
          {modelsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-6 w-6 rounded-full border-2 border-border border-t-accent animate-spin" />
            </div>
          ) : models.length === 0 ? (
            <Card padding="lg">
              <p className="text-[17px] text-text-3 text-center">No LLM models configured.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {models.map(m => (
                <Card key={m.id} padding="md" className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[17px] font-[500] text-text truncate">{m.name}</p>
                      {m.description && <p className="text-[15px] text-text-3 mt-0.5 line-clamp-2">{m.description}</p>}
                    </div>
                    <Badge color={m.isActive ? 'green' : 'muted'} size="sm" dot>
                      {m.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="space-y-1.5">
                    {m.provider && (
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] text-text-3 w-16 flex-shrink-0">Provider</p>
                        <Badge color={providerColor(m.provider)} size="sm">{m.provider}</Badge>
                      </div>
                    )}
                    {m.modelId && (
                      <div className="flex items-start gap-2">
                        <p className="text-[14px] text-text-3 w-16 flex-shrink-0 mt-0.5">Model ID</p>
                        <p className="text-[15px] text-text-2 font-mono break-all">{m.modelId}</p>
                      </div>
                    )}
                    {m.costPerToken != null && (
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] text-text-3 w-16 flex-shrink-0">Cost/token</p>
                        <p className="text-[15px] text-text-2 font-mono">${m.costPerToken.toFixed(8)}</p>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent Appeals Tab */}
      {tab === 'recent' && (
        <div className="space-y-4">
          {analyticsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-6 w-6 rounded-full border-2 border-border border-t-accent animate-spin" />
            </div>
          ) : (
            <Card padding="none">
              <div className="p-4 border-b border-border">
                <h3 className="text-[16px] font-[500] text-text">Recent Appeals</h3>
                <p className="text-[16px] text-text-3 mt-0.5">Training data from recent appeal submissions</p>
              </div>
              <div className="divide-y divide-border">
                {(analytics?.recentAppeals ?? []).map(appeal => (
                  <div key={appeal.id} className="p-4 hover:bg-surface-2/50 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="text-[17px] font-[500] text-text truncate">{appeal.debateTopic}</p>
                        <p className="text-[15px] text-text-3">{appeal.category}</p>
                      </div>
                      <Badge color={appeal.success === true ? 'green' : appeal.success === false ? 'red' : 'muted'} size="sm">
                        {appeal.success === true ? 'Success' : appeal.success === false ? 'Failed' : 'Pending'}
                      </Badge>
                    </div>
                    <p className="text-[16px] text-text-2 line-clamp-2">{appeal.appealReason}</p>
                    <div className="flex gap-4 mt-2">
                      <p className="text-[15px] text-text-3">Original winner: {appeal.originalWinner}</p>
                      {appeal.newWinner && <p className="text-[15px] text-[var(--green)]">New winner: {appeal.newWinner}</p>}
                    </div>
                    <p className="text-[14px] text-text-3 mt-1">{new Date(appeal.createdAt).toLocaleDateString()}</p>
                  </div>
                ))}
                {(!analytics?.recentAppeals?.length) && (
                  <div className="px-4 py-10 text-center">
                    <p className="text-[17px] text-text-3">No recent appeals.</p>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
