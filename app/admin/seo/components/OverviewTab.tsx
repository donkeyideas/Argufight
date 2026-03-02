'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface OverviewData {
  latestAudit: {
    overallScore: number;
    technicalScore: number;
    contentScore: number;
    performanceScore: number;
    geoScore: number;
    totalIssues: number;
    criticalIssues: number;
    createdAt: string;
  } | null;
  statusCounts: { pending: number; implemented: number; dismissed: number };
  estimatedIndexedPages: number;
  auditHistory: Array<{
    overallScore: number;
    technicalScore: number;
    contentScore: number;
    geoScore: number;
    createdAt: string;
  }>;
  issuesByCategory: {
    technical: number;
    content: number;
    performance: number;
    geo: number;
  } | null;
}

function ScoreCircle({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--blue)' : score >= 40 ? 'var(--amber)' : 'var(--red)';
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="var(--surface-3)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="40" fill="none"
            stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-[300] text-text">{score}</span>
        </div>
      </div>
      <p className="text-[16px] text-text-3 mt-2">{label}</p>
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--text)',
  fontSize: 12,
};

export default function OverviewTab({ onTabChange }: { onTabChange: (tab: string) => void }) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningAudit, setIsRunningAudit] = useState(false);

  useEffect(() => { fetchOverview(); }, []);

  const fetchOverview = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/seo-geo/overview');
      if (res.ok) setData(await res.json());
    } catch { /* noop */ } finally { setIsLoading(false); }
  };

  const handleRunAudit = async () => {
    try {
      setIsRunningAudit(true);
      const res = await fetch('/api/admin/seo-geo/audit', { method: 'POST' });
      if (res.ok) await fetchOverview();
    } catch { /* noop */ } finally { setIsRunningAudit(false); }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 border-border border-t-accent animate-spin" />
      </div>
    );
  }

  const issuesChartData = data?.issuesByCategory ? [
    { category: 'Technical',   count: data.issuesByCategory.technical },
    { category: 'Content',     count: data.issuesByCategory.content },
    { category: 'Performance', count: data.issuesByCategory.performance },
    { category: 'GEO',         count: data.issuesByCategory.geo },
  ] : [];

  const historyChartData = (data?.auditHistory || []).map((a) => ({
    date: new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    overall:   a.overallScore,
    technical: a.technicalScore,
    content:   a.contentScore,
    geo:       a.geoScore,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md" className="flex flex-col items-center py-5">
          <ScoreCircle score={data?.latestAudit?.overallScore ?? 0} label="SEO Health Score" />
        </Card>

        <Card padding="md">
          <p className="text-[16px] text-text-3 mb-1">Indexed Pages (est.)</p>
          <p className="text-3xl font-[300] text-text">{data?.estimatedIndexedPages ?? 0}</p>
          <p className="text-[15px] text-text-3 mt-2">Based on sitemap entries</p>
        </Card>

        <Card padding="md">
          <p className="text-[16px] text-text-3 mb-1">Open Recommendations</p>
          <p className="text-3xl font-[300] text-text">{data?.statusCounts?.pending ?? 0}</p>
          <div className="flex gap-3 mt-2">
            <span className="text-[15px] text-[var(--green)]">{data?.statusCounts?.implemented ?? 0} done</span>
            <span className="text-[15px] text-text-3">{data?.statusCounts?.dismissed ?? 0} dismissed</span>
          </div>
        </Card>

        <Card padding="md" className="flex flex-col items-center py-5">
          <ScoreCircle score={data?.latestAudit?.geoScore ?? 0} label="GEO Score" />
        </Card>
      </div>

      {/* Charts */}
      {historyChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card padding="none">
            <div className="p-4 border-b border-border">
              <h3 className="text-[16px] font-[500] text-text">Score Trend</h3>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={historyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--border)" tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
                  <YAxis domain={[0, 100]} stroke="var(--border)" tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="overall"   stroke="var(--accent)" strokeWidth={2} name="Overall" dot={{ fill: 'var(--accent)' }} />
                  <Line type="monotone" dataKey="geo"       stroke="var(--green)"  strokeWidth={2} name="GEO"     dot={{ fill: 'var(--green)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card padding="none">
            <div className="p-4 border-b border-border">
              <h3 className="text-[16px] font-[500] text-text">Issues by Category</h3>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={issuesChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="category" stroke="var(--border)" tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
                  <YAxis stroke="var(--border)" tick={{ fill: 'var(--text-3)', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Issues" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* No audit banner */}
      {!data?.latestAudit && (
        <Card padding="lg" className="text-center">
          <svg className="w-10 h-10 mx-auto text-text-3 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <h3 className="text-[18px] font-[500] text-text mb-2">No Audit Data Yet</h3>
          <p className="text-[17px] text-text-3 mb-4 max-w-sm mx-auto">
            Run your first SEO &amp; GEO audit to see health scores, identify issues, and get actionable recommendations.
          </p>
          <Button variant="accent" onClick={handleRunAudit} loading={isRunningAudit}>
            {isRunningAudit ? 'Running Audit...' : 'Run First Audit'}
          </Button>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: (
              <svg className="w-5 h-5 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ),
            title: isRunningAudit ? 'Running...' : 'Run New Audit',
            subtitle: 'Scan for SEO & GEO issues',
            onClick: handleRunAudit,
            disabled: isRunningAudit,
          },
          {
            icon: (
              <svg className="w-5 h-5 text-[var(--amber)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            ),
            title: 'View Recommendations',
            subtitle: `${data?.statusCounts?.pending ?? 0} pending`,
            onClick: () => onTabChange('recommendations'),
          },
          {
            icon: (
              <svg className="w-5 h-5 text-[var(--green)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
            title: 'Edit llms.txt',
            subtitle: 'Manage AI engine content',
            onClick: () => onTabChange('geo'),
          },
          {
            icon: (
              <svg className="w-5 h-5 text-[var(--blue)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ),
            title: 'Configure Settings',
            subtitle: 'SEO & GEO configuration',
            onClick: () => onTabChange('settings'),
          },
        ].map((action, i) => (
          <button
            key={i}
            onClick={action.onClick}
            disabled={action.disabled}
            className="p-4 bg-surface border border-border rounded-[var(--radius)] hover:border-border-2 hover:bg-surface-2 transition-colors text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              {action.icon}
              <div>
                <p className="text-[17px] font-[500] text-text">{action.title}</p>
                <p className="text-[15px] text-text-3">{action.subtitle}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Last audit info */}
      {data?.latestAudit && (
        <p className="text-[15px] text-text-3 text-center">
          Last audit: {new Date(data.latestAudit.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      )}
    </div>
  );
}
