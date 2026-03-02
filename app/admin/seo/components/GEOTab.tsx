'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

interface AiBotStatus { name: string; userAgent: string; allowed: boolean; scope: string }
interface StructuredDataCoverage { pageType: string; hasSchema: boolean; schemaTypes: string[] }

interface GeoData {
  aiBots: AiBotStatus[];
  llmsTxtContent: string;
  llmsTxtSource: string;
  structuredDataCoverage: StructuredDataCoverage[];
  contentQuality: {
    totalPosts: number; avgWordCount: number; postsOver1000Words: number;
    postsWithKeywords: number; postsWithCategories: number; postsWithFeaturedImages: number;
  };
  rssFeedStatus: { exists: boolean; path: string };
  geoScore: number;
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--blue)' : score >= 40 ? 'var(--amber)' : 'var(--red)';
  const circ  = 2 * Math.PI * 40;
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

export default function GEOTab() {
  const { toast }  = useToast();
  const [data, setData]             = useState<GeoData | null>(null);
  const [isLoading, setIsLoading]   = useState(true);
  const [isSaving, setIsSaving]     = useState(false);
  const [editedLlmsTxt, setEditedLlmsTxt] = useState('');
  const [isEditingLlms, setIsEditingLlms] = useState(false);

  useEffect(() => { fetchGeoData(); }, []);

  const fetchGeoData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/seo-geo/geo');
      if (res.ok) {
        const result = await res.json();
        setData(result);
        setEditedLlmsTxt(result.llmsTxtContent);
      }
    } catch { /* noop */ } finally { setIsLoading(false); }
  };

  const handleSaveLlmsTxt = async () => {
    try {
      setIsSaving(true);
      const res = await fetch('/api/admin/seo-geo/geo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llmsTxtContent: editedLlmsTxt }),
      });
      if (res.ok) {
        toast({ type: 'success', title: 'Saved', description: 'llms.txt content updated successfully' });
        setIsEditingLlms(false);
        await fetchGeoData();
      } else {
        throw new Error('Failed to save');
      }
    } catch {
      toast({ type: 'error', title: 'Error', description: 'Failed to save llms.txt content' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 border-border border-t-accent animate-spin" />
      </div>
    );
  }

  if (!data) return null;
  const cq = data.contentQuality;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-[600] text-text">Generative Engine Optimization (GEO)</h2>
          <p className="text-[17px] text-text-3">Optimize your content for AI-powered search engines and chatbots</p>
        </div>
        <ScoreGauge score={data.geoScore} />
      </div>

      {/* AI Bot Access */}
      <Card padding="none">
        <div className="p-4 border-b border-border">
          <h3 className="text-[16px] font-[500] text-text">AI Bot Access Status</h3>
        </div>
        <div className="p-4">
          <p className="text-[17px] text-text-3 mb-4">
            These AI crawlers can access your public content. Rules are defined in{' '}
            <code className="text-accent text-[16px] bg-surface-2 px-1 rounded">robots.ts</code>.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[17px]">
              <thead>
                <tr className="border-b border-border">
                  {['AI Engine', 'User Agent', 'Status', 'Scope'].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-[15px] font-[500] text-text-3 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.aiBots.map((bot) => (
                  <tr key={bot.userAgent} className="border-b border-border/50">
                    <td className="py-2 px-3 text-text">{bot.name}</td>
                    <td className="py-2 px-3 text-text-3 font-mono text-[15px]">{bot.userAgent}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-[15px] font-[500] ${
                        bot.allowed
                          ? 'bg-[rgba(77,255,145,0.15)] text-[var(--green)]'
                          : 'bg-[rgba(255,77,77,0.15)] text-[var(--red)]'
                      }`}>
                        {bot.allowed ? 'Allowed' : 'Blocked'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-text-3 text-[16px]">{bot.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* llms.txt Editor */}
      <Card padding="none">
        <div className="flex items-start justify-between p-4 border-b border-border">
          <div>
            <h3 className="text-[16px] font-[500] text-text">llms.txt Content</h3>
            <p className="text-[16px] text-text-3 mt-1">
              This file tells AI engines about your site. Served at{' '}
              <code className="text-accent text-[15px] bg-surface-2 px-1 rounded">/llms.txt</code>
            </p>
          </div>
          {!isEditingLlms ? (
            <Button variant="secondary" size="sm" onClick={() => setIsEditingLlms(true)}>Edit</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setEditedLlmsTxt(data.llmsTxtContent); setIsEditingLlms(false); }}>Cancel</Button>
              <Button variant="accent" size="sm" onClick={handleSaveLlmsTxt} loading={isSaving}>Save</Button>
            </div>
          )}
        </div>
        <div className="p-4">
          {isEditingLlms ? (
            <textarea
              value={editedLlmsTxt}
              onChange={(e) => setEditedLlmsTxt(e.target.value)}
              rows={18}
              className="w-full px-4 py-3 bg-surface-2 border border-border rounded-[var(--radius)] text-text font-mono text-[16px] focus:outline-none focus:border-border-2 resize-y"
              spellCheck={false}
            />
          ) : (
            <pre className="w-full p-4 bg-surface-2 rounded-[var(--radius)] text-text-3 font-mono text-[16px] whitespace-pre-wrap overflow-x-auto">
              {data.llmsTxtContent}
            </pre>
          )}
          <p className="text-[15px] text-text-3 mt-2">
            Source: {data.llmsTxtSource === 'admin_settings' ? 'Admin Settings (editable)' : 'Static file (public/llms.txt)'}
          </p>
        </div>
      </Card>

      {/* Structured Data Coverage */}
      <Card padding="none">
        <div className="p-4 border-b border-border">
          <h3 className="text-[16px] font-[500] text-text">Structured Data Coverage</h3>
        </div>
        <div className="p-4">
          <p className="text-[17px] text-text-3 mb-4">
            JSON-LD structured data helps AI engines understand your content semantically.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[17px]">
              <thead>
                <tr className="border-b border-border">
                  {['Page Type', 'Status', 'Schema Types'].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-[15px] font-[500] text-text-3 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.structuredDataCoverage.map((item) => (
                  <tr key={item.pageType} className="border-b border-border/50">
                    <td className="py-2 px-3 text-text">{item.pageType}</td>
                    <td className="py-2 px-3">
                      <span className={item.hasSchema ? 'text-[var(--green)]' : 'text-[var(--red)]'}>
                        {item.hasSchema ? '✓ Implemented' : '✗ Missing'}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex flex-wrap gap-1">
                        {item.schemaTypes.map((type) => (
                          <span key={type} className="px-1.5 py-0.5 bg-surface-2 rounded text-[15px] text-text-3">{type}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Content Quality */}
      <Card padding="none">
        <div className="p-4 border-b border-border">
          <h3 className="text-[16px] font-[500] text-text">Content Quality for AI</h3>
        </div>
        <div className="p-4">
          <p className="text-[17px] text-text-3 mb-4">
            AI engines favor comprehensive, well-structured, and categorized content.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { val: cq.totalPosts,              label: 'Published Posts' },
              { val: cq.avgWordCount,             label: 'Avg Word Count' },
              { val: cq.postsOver1000Words,       label: 'Posts 1000+ Words' },
              { val: cq.postsWithKeywords,        label: 'Posts with Keywords' },
              { val: cq.postsWithCategories,      label: 'Categorized Posts' },
              { val: cq.postsWithFeaturedImages,  label: 'Posts with Images' },
            ].map(({ val, label }) => (
              <div key={label} className="p-3 bg-surface-2 rounded-[var(--radius)]">
                <p className="text-2xl font-[300] text-text">{val}</p>
                <p className="text-[15px] text-text-3">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* RSS Feed */}
      <Card padding="md">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[var(--green)]">✓</span>
          <span className="text-[17px] font-[500] text-text">RSS feed is active</span>
        </div>
        <p className="text-[16px] text-text-3">
          Available at{' '}
          <a href="/feed.xml" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            /feed.xml
          </a>{' '}
          — includes latest debates and blog posts
        </p>
      </Card>
    </div>
  );
}
