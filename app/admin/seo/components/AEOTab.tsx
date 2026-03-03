'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, AlertTriangle, ExternalLink } from 'lucide-react';

interface AeoData {
  aeoScore: number;
  hasLlmsTxt: boolean;
  contentStats: {
    totalPosts: number; withMetaTitle: number; withMetaDesc: number;
    withTags: number; withFeaturedImage: number; longFormPosts: number;
  };
  debateStats: { total: number; completed: number };
  checklist: { label: string; done: boolean }[];
  recommendations: { priority: string; title: string; description: string; action: string | null }[];
  recentDebatesAsQA: { id: string; topic: string; category: string }[];
}

function ScoreGauge({ score }: { score: number }) {
  const color  = score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--blue)' : score >= 40 ? 'var(--amber)' : 'var(--red)';
  const circ   = 2 * Math.PI * 40;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="relative w-24 h-24">
      <svg className="-rotate-90 w-24 h-24" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="var(--surface-3)" strokeWidth="8" />
        <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-[300] text-text">{score}</span>
      </div>
    </div>
  );
}

function priorityBadge(p: string) {
  if (p === 'high')   return <span className="px-2 py-0.5 rounded text-[13px] font-[500] bg-[rgba(255,77,77,0.15)] text-[var(--red)]">High</span>;
  if (p === 'medium') return <span className="px-2 py-0.5 rounded text-[13px] font-[500] bg-[rgba(255,207,77,0.15)] text-[var(--amber)]">Medium</span>;
  return                     <span className="px-2 py-0.5 rounded text-[13px] font-[500] bg-[rgba(120,120,120,0.15)] text-text-3">Low</span>;
}

export default function AEOTab({ onTabChange }: { onTabChange?: (tab: string) => void }) {
  const [data, setData]         = useState<AeoData | null>(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/seo-geo/aeo')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 border-border border-t-accent animate-spin" />
      </div>
    );
  }
  if (!data) return null;

  const cs = data.contentStats;
  const pct = (n: number, d: number) => d > 0 ? Math.round((n / d) * 100) : 100;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-[600] text-text">Answer Engine Optimization (AEO)</h2>
          <p className="text-[17px] text-text-3">Optimise content to appear as direct answers in AI chatbots and featured snippets</p>
        </div>
        <ScoreGauge score={data.aeoScore} />
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'AEO Score',          value: `${data.aeoScore}/100`,          color: data.aeoScore >= 70 ? 'var(--green)' : 'var(--amber)' },
          { label: 'Completed Debates',  value: data.debateStats.completed,       color: 'var(--text)' },
          { label: 'Blog Posts',         value: cs.totalPosts,                    color: 'var(--text)' },
          { label: 'llms.txt',           value: data.hasLlmsTxt ? 'Active' : 'Missing', color: data.hasLlmsTxt ? 'var(--green)' : 'var(--red)' },
        ].map(({ label, value, color }) => (
          <Card key={label} padding="md">
            <p className="text-2xl font-[300]" style={{ color }}>{value}</p>
            <p className="text-[15px] text-text-3 mt-1">{label}</p>
          </Card>
        ))}
      </div>

      {/* AEO Checklist */}
      <Card padding="none">
        <div className="p-4 border-b border-border">
          <h3 className="text-[16px] font-[500] text-text">AEO Readiness Checklist</h3>
          <p className="text-[15px] text-text-3 mt-0.5">Requirements for being cited by AI answer engines</p>
        </div>
        <div className="divide-y divide-border">
          {data.checklist.map((item) => (
            <div key={item.label} className="flex items-center gap-3 px-4 py-3">
              {item.done
                ? <CheckCircle size={16} className="flex-shrink-0 text-[var(--green)]" />
                : <XCircle    size={16} className="flex-shrink-0 text-[var(--red)]" />}
              <span className={`text-[15px] ${item.done ? 'text-text' : 'text-text-3'}`}>{item.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Content Coverage */}
      <Card padding="none">
        <div className="p-4 border-b border-border">
          <h3 className="text-[16px] font-[500] text-text">Content Coverage for AI Indexing</h3>
        </div>
        <div className="p-4">
          {cs.totalPosts === 0 ? (
            <p className="text-[15px] text-text-3">No published blog posts yet. Publish articles to improve AEO coverage.</p>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Meta Titles',       done: cs.withMetaTitle,      total: cs.totalPosts },
                { label: 'Meta Descriptions', done: cs.withMetaDesc,       total: cs.totalPosts },
                { label: 'Tags / Keywords',   done: cs.withTags,           total: cs.totalPosts },
                { label: 'Featured Images',   done: cs.withFeaturedImage,  total: cs.totalPosts },
                { label: 'Long-form (2k+ chars)', done: cs.longFormPosts,  total: cs.totalPosts },
              ].map(({ label, done, total }) => {
                const p = pct(done, total);
                const barColor = p >= 80 ? 'var(--green)' : p >= 50 ? 'var(--amber)' : 'var(--red)';
                return (
                  <div key={label}>
                    <div className="flex justify-between text-[14px] mb-1">
                      <span className="text-text-2">{label}</span>
                      <span className="text-text-3">{done}/{total} ({p}%)</span>
                    </div>
                    <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, background: barColor }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Debates as Q&A */}
      <Card padding="none">
        <div className="p-4 border-b border-border">
          <h3 className="text-[16px] font-[500] text-text">Debates as Structured Q&A Content</h3>
          <p className="text-[15px] text-text-3 mt-0.5">Completed debates are naturally formatted as questions AI engines can cite as authoritative answers</p>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-surface-2 rounded-[var(--radius)]">
              <p className="text-2xl font-[300] text-text">{data.debateStats.completed}</p>
              <p className="text-[14px] text-text-3">Completed debates</p>
            </div>
            <div className="p-3 bg-surface-2 rounded-[var(--radius)]">
              <p className="text-2xl font-[300] text-text">{data.debateStats.total}</p>
              <p className="text-[14px] text-text-3">Total debates</p>
            </div>
          </div>
          {data.recentDebatesAsQA.length > 0 && (
            <div className="space-y-2">
              <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide mb-2">Recent Q&A topics</p>
              {data.recentDebatesAsQA.map((d) => (
                <div key={d.id} className="flex items-start gap-2 py-2 border-b border-border/50 last:border-0">
                  <span className="text-[14px] font-[500] text-accent mr-1">Q</span>
                  <span className="text-[15px] text-text-2">{d.topic}</span>
                  <a href={`/debate/${d.id}`} target="_blank" rel="noopener noreferrer" className="ml-auto flex-shrink-0 text-text-3 hover:text-accent">
                    <ExternalLink size={13} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <Card padding="none">
          <div className="p-4 border-b border-border">
            <h3 className="text-[16px] font-[500] text-text">Recommendations</h3>
          </div>
          <div className="divide-y divide-border">
            {data.recommendations.map((rec, i) => (
              <div key={i} className="p-4 flex items-start gap-3">
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-[var(--amber)]" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {priorityBadge(rec.priority)}
                    <span className="text-[15px] font-[500] text-text">{rec.title}</span>
                  </div>
                  <p className="text-[14px] text-text-3">{rec.description}</p>
                </div>
                {rec.action && (
                  <Button variant="secondary" size="sm" onClick={() => onTabChange?.(rec.action!)}>
                    Go
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* AEO Guide */}
      <Card padding="md">
        <h3 className="text-[16px] font-[500] text-text mb-3">How ArguFight is optimised for Answer Engines</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {[
            { title: 'Debate-as-Q&A',        desc: 'Every debate is a structured question with expert arguments on both sides — ideal for AI answer extraction.' },
            { title: 'llms.txt Protocol',    desc: 'Tells AI crawlers (GPT, Gemini, Perplexity, Claude) what ArguFight is and what content to use.' },
            { title: 'Structured Data',      desc: 'Article, FAQ, and DebateEvent schema markup on blog and debate pages enables rich answer previews.' },
            { title: 'Open AI Bot Access',   desc: 'robots.ts explicitly allows ChatGPT-User, Google-Extended, PerplexityBot, and other AI crawlers.' },
          ].map(({ title, desc }) => (
            <div key={title} className="p-3 bg-surface-2 rounded-[var(--radius)]">
              <p className="text-[15px] font-[500] text-text mb-1">{title}</p>
              <p className="text-[14px] text-text-3">{desc}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
