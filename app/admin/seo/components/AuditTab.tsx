'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface CategoryData {
  score: number;
  checks: Array<{ name: string; passed: boolean; details?: string }>;
  issues: Array<{
    category: string; severity: string; title: string; description: string;
    pageUrl?: string; recommendation: string;
  }>;
}

interface AuditData {
  id: string;
  overallScore: number; technicalScore: number; contentScore: number;
  performanceScore: number; geoScore: number; totalIssues: number;
  criticalIssues: number; warningIssues: number; infoIssues: number;
  results: { summary: string; categories: { technical: CategoryData; content: CategoryData; performance: CategoryData; geo: CategoryData } };
  createdAt: string;
}

interface AuditHistory {
  overallScore: number; technicalScore: number; contentScore: number;
  performanceScore: number; geoScore: number; totalIssues: number; createdAt: string;
}

function ScoreGauge({ score, size = 'lg' }: { score: number; size?: 'sm' | 'lg' }) {
  const color = score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--blue)' : score >= 40 ? 'var(--amber)' : 'var(--red)';
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Needs Work' : 'Critical';
  const dim   = size === 'lg' ? 128 : 80;
  const r     = size === 'lg' ? 50 : 32;
  const sw    = size === 'lg' ? 10 : 6;
  const circ  = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg className="-rotate-90" width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>
          <circle cx={dim / 2} cy={dim / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={sw} />
          <circle
            cx={dim / 2} cy={dim / 2} r={r} fill="none"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-[300] text-text ${size === 'lg' ? 'text-3xl' : 'text-xl'}`}>{score}</span>
        </div>
      </div>
      {size === 'lg' && (
        <p className="text-[16px] font-[500] mt-2" style={{ color }}>{label}</p>
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    critical: 'bg-[rgba(255,77,77,0.15)] text-[var(--red)]   border-[rgba(255,77,77,0.3)]',
    warning:  'bg-[rgba(255,207,77,0.15)] text-[var(--amber)] border-[rgba(255,207,77,0.3)]',
    info:     'bg-[rgba(77,159,255,0.15)] text-[var(--blue)]  border-[rgba(77,159,255,0.3)]',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[15px] font-[500] border ${styles[severity] || styles.info}`}>
      {severity}
    </span>
  );
}

const tooltipStyle = {
  backgroundColor: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--text)',
  fontSize: 12,
};

export default function AuditTab() {
  const { toast }  = useToast();
  const [audit, setAudit]     = useState<AuditData | null>(null);
  const [history, setHistory] = useState<AuditHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [auditRes, historyRes] = await Promise.all([
        fetch('/api/admin/seo-geo/audit'),
        fetch('/api/admin/seo-geo/audit/history'),
      ]);
      if (auditRes.ok)   { const d = await auditRes.json();   setAudit(d.audit); }
      if (historyRes.ok) { const d = await historyRes.json(); setHistory(d.audits || []); }
    } catch { /* noop */ } finally { setIsLoading(false); }
  };

  const handleRunAudit = async () => {
    try {
      setIsRunning(true);
      const res = await fetch('/api/admin/seo-geo/audit', { method: 'POST' });
      if (res.ok) {
        const d = await res.json();
        toast({ type: 'success', title: 'Audit Complete', description: `Score: ${d.audit.overallScore}/100 with ${d.recommendationsCount} recommendation(s)` });
        await fetchData();
      } else {
        throw new Error('Audit failed');
      }
    } catch {
      toast({ type: 'error', title: 'Audit Failed', description: 'Failed to run SEO & GEO audit' });
    } finally {
      setIsRunning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 border-border border-t-accent animate-spin" />
      </div>
    );
  }

  const categories = audit?.results?.categories;
  const historyChartData = history.map((h) => ({
    date:        new Date(h.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    overall:     h.overallScore,
    technical:   h.technicalScore,
    content:     h.contentScore,
    performance: h.performanceScore,
    geo:         h.geoScore,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-[600] text-text">SEO &amp; GEO Audit</h2>
          <p className="text-[17px] text-text-3">
            {audit
              ? `Last run: ${new Date(audit.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`
              : 'No audits run yet'}
          </p>
        </div>
        <Button variant="accent" onClick={handleRunAudit} loading={isRunning}>
          {isRunning ? 'Running Audit...' : 'Run New Audit'}
        </Button>
      </div>

      {!audit ? (
        <Card padding="lg" className="text-center">
          <p className="text-[17px] text-text-3 mb-4">
            Run your first audit to analyze your site&apos;s SEO &amp; GEO health.
          </p>
          <Button variant="accent" onClick={handleRunAudit} loading={isRunning}>
            Run First Audit
          </Button>
        </Card>
      ) : (
        <>
          {/* Score cards */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card padding="md" className="lg:col-span-1 flex flex-col items-center justify-center py-6">
              <ScoreGauge score={audit.overallScore} size="lg" />
              <p className="text-[16px] text-text-3 mt-2">Overall Score</p>
            </Card>
            <div className="lg:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Technical',   score: audit.technicalScore },
                { label: 'Content',     score: audit.contentScore },
                { label: 'Performance', score: audit.performanceScore },
                { label: 'GEO',         score: audit.geoScore },
              ].map((cat) => (
                <Card key={cat.label} padding="md" className="flex flex-col items-center py-4">
                  <ScoreGauge score={cat.score} size="sm" />
                  <p className="text-[16px] text-text-3 mt-2">{cat.label}</p>
                </Card>
              ))}
            </div>
          </div>

          {/* Summary */}
          <Card padding="md">
            <p className="text-[17px] text-text">{audit.results?.summary}</p>
            <div className="flex gap-4 mt-3">
              <span className="text-[15px] text-[var(--red)]">{audit.criticalIssues} critical</span>
              <span className="text-[15px] text-[var(--amber)]">{audit.warningIssues} warnings</span>
              <span className="text-[15px] text-[var(--blue)]">{audit.infoIssues} info</span>
            </div>
          </Card>

          {/* Category issues */}
          {categories && (['technical', 'content', 'performance', 'geo'] as const).map((catKey) => {
            const cat = categories[catKey];
            if (!cat?.issues?.length && !cat?.checks?.length) return null;
            const catLabels: Record<string, string> = {
              technical: 'Technical SEO', content: 'Content SEO', performance: 'Performance', geo: 'GEO (AI Engine)',
            };
            return (
              <Card key={catKey} padding="none">
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <h3 className="text-[16px] font-[500] text-text">{catLabels[catKey]}</h3>
                  <span className="text-[16px] text-text-3">Score: {cat.score}/100</span>
                </div>
                <div className="p-4 space-y-3">
                  {cat.checks?.length > 0 && (
                    <div className="space-y-1.5">
                      {cat.checks.map((check, i) => (
                        <div key={i} className="flex items-center gap-2 text-[17px]">
                          <span className={check.passed ? 'text-[var(--green)]' : 'text-[var(--red)]'}>
                            {check.passed ? '✓' : '✗'}
                          </span>
                          <span className="text-text-3">{check.name}</span>
                          {check.details && <span className="text-text-3 text-xs">({check.details})</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {cat.issues?.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <h4 className="text-[16px] font-[500] text-text-3">Issues Found</h4>
                      {cat.issues.map((issue, i) => (
                        <div key={i} className="p-3 bg-surface-2 rounded-[var(--radius)] border border-border">
                          <div className="flex items-start gap-2">
                            <SeverityBadge severity={issue.severity} />
                            <div className="flex-1">
                              <p className="text-text text-[17px] font-[500]">{issue.title}</p>
                              <p className="text-text-3 text-[16px] mt-1">{issue.description}</p>
                              <p className="text-accent text-[16px] mt-1">Fix: {issue.recommendation}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}

          {/* Audit history chart */}
          {historyChartData.length > 1 && (
            <Card padding="none">
              <div className="p-4 border-b border-border">
                <h3 className="text-[16px] font-[500] text-text">Audit History</h3>
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={historyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" stroke="var(--border)" tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
                    <YAxis domain={[0, 100]} stroke="var(--border)" tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Line type="monotone" dataKey="overall"     stroke="var(--accent)"  strokeWidth={2}   name="Overall" />
                    <Line type="monotone" dataKey="technical"   stroke="var(--amber)"   strokeWidth={1.5} name="Technical"   strokeDasharray="5 5" />
                    <Line type="monotone" dataKey="content"     stroke="var(--blue)"    strokeWidth={1.5} name="Content"     strokeDasharray="5 5" />
                    <Line type="monotone" dataKey="geo"         stroke="var(--green)"   strokeWidth={1.5} name="GEO"         strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
