'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';

interface Recommendation {
  id: string; category: string; severity: string; title: string;
  description: string; impact: string | null; effort: string | null;
  status: string; pageUrl: string | null; createdAt: string;
}

interface AffectedPost {
  id: string; title: string; slug: string; wordCount?: number;
  status: string; publishedAt: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  technical_seo: 'Technical SEO', content_seo: 'Content SEO',
  performance: 'Performance', geo: 'GEO',
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-[rgba(255,77,77,0.15)]   text-[var(--red)]   border-[rgba(255,77,77,0.3)]',
  warning:  'bg-[rgba(255,207,77,0.15)]  text-[var(--amber)] border-[rgba(255,207,77,0.3)]',
  info:     'bg-[rgba(77,159,255,0.15)]  text-[var(--blue)]  border-[rgba(77,159,255,0.3)]',
};

const IMPACT_STYLES: Record<string, string>  = { high: 'text-[var(--red)]', medium: 'text-[var(--amber)]', low: 'text-[var(--blue)]' };
const EFFORT_STYLES: Record<string, string>  = { easy: 'text-[var(--green)]', medium: 'text-[var(--amber)]', hard: 'text-[var(--red)]' };

function getAffectedPostsType(rec: Recommendation): string | null {
  const t = rec.title.toLowerCase();
  if (t.includes('thin content'))                        return 'thin_content';
  if (t.includes('without og or featured'))              return 'missing_images';
  if (t.includes('without categories'))                  return 'missing_categories';
  if (t.includes('duplicate') && t.includes('title'))   return 'duplicate_titles';
  if (t.includes('missing meta title'))                  return 'missing_meta_titles';
  if (t.includes('missing meta description'))            return 'missing_meta_descriptions';
  if (t.includes('without featured image'))              return 'missing_featured_images';
  return null;
}

export default function RecommendationsTab() {
  const { toast } = useToast();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [statusCounts, setStatusCounts]       = useState({ pending: 0, implemented: 0, dismissed: 0 });
  const [isLoading, setIsLoading]             = useState(true);
  const [filterCategory, setFilterCategory]   = useState('');
  const [filterStatus, setFilterStatus]       = useState('');
  const [updatingId, setUpdatingId]           = useState<string | null>(null);

  const [detailsOpen, setDetailsOpen]         = useState(false);
  const [detailsRec, setDetailsRec]           = useState<Recommendation | null>(null);
  const [affectedPosts, setAffectedPosts]     = useState<AffectedPost[]>([]);
  const [affectedDesc, setAffectedDesc]       = useState('');
  const [loadingDetails, setLoadingDetails]   = useState(false);

  useEffect(() => { fetchRecommendations(); }, [filterCategory, filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRecommendations = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (filterCategory) params.set('category', filterCategory);
      if (filterStatus)   params.set('status',   filterStatus);
      const res = await fetch(`/api/admin/seo-geo/recommendations?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
        setStatusCounts(data.statusCounts || { pending: 0, implemented: 0, dismissed: 0 });
      }
    } catch { /* noop */ } finally { setIsLoading(false); }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      setUpdatingId(id);
      const res = await fetch('/api/admin/seo-geo/recommendations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        toast({ type: 'success', title: 'Updated', description: `Recommendation marked as ${status}` });
        await fetchRecommendations();
      }
    } catch {
      toast({ type: 'error', title: 'Error', description: 'Failed to update recommendation' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleViewDetails = async (rec: Recommendation) => {
    const type = getAffectedPostsType(rec);
    setDetailsRec(rec);
    setDetailsOpen(true);
    if (!type) { setAffectedPosts([]); setAffectedDesc(rec.description); return; }
    setLoadingDetails(true);
    setAffectedPosts([]);
    try {
      const res = await fetch(`/api/admin/seo-geo/recommendations/affected-posts?type=${type}`);
      if (res.ok) {
        const data = await res.json();
        setAffectedPosts(data.posts || []);
        setAffectedDesc(data.description || rec.description);
      }
    } catch { setAffectedDesc(rec.description); }
    finally { setLoadingDetails(false); }
  };

  const closeDetails = () => { setDetailsOpen(false); setDetailsRec(null); setAffectedPosts([]); };

  const handleCopyAll = () => {
    const text = recommendations.map((rec, i) => {
      const parts = [
        `${i + 1}. [${rec.severity.toUpperCase()}] ${rec.title}`,
        `   Category: ${CATEGORY_LABELS[rec.category] || rec.category}`,
        `   ${rec.description}`,
      ];
      if (rec.impact)  parts.push(`   Impact: ${rec.impact}`);
      if (rec.effort)  parts.push(`   Effort: ${rec.effort}`);
      if (rec.pageUrl) parts.push(`   URL: ${rec.pageUrl}`);
      parts.push(`   Status: ${rec.status}`);
      return parts.join('\n');
    }).join('\n\n');
    navigator.clipboard.writeText(`SEO & GEO Recommendations (${recommendations.length} items)\n${'='.repeat(50)}\n\n${text}`);
    toast({ type: 'success', title: 'Copied', description: `${recommendations.length} recommendations copied to clipboard` });
  };

  const handleExportCSV = () => {
    const headers = ['Severity', 'Category', 'Title', 'Description', 'Impact', 'Effort', 'Status', 'URL'];
    const rows = recommendations.map((rec) => [
      rec.severity, CATEGORY_LABELS[rec.category] || rec.category, rec.title,
      rec.description, rec.impact || '', rec.effort || '', rec.status, rec.pageUrl || '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = `seo-recommendations-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 border-border border-t-accent animate-spin" />
      </div>
    );
  }

  const selectCls = 'px-3 py-1.5 bg-surface-2 border border-border rounded-[var(--radius)] text-[17px] text-text focus:outline-none focus:border-border-2';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-[600] text-text">Recommendations</h2>
        <p className="text-[17px] text-text-3">Actionable improvements based on your latest audit</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { val: statusCounts.pending,     label: 'Pending',     color: 'text-[var(--amber)]' },
          { val: statusCounts.implemented, label: 'Implemented', color: 'text-[var(--green)]' },
          { val: statusCounts.dismissed,   label: 'Dismissed',   color: 'text-text-3' },
        ].map(({ val, label, color }) => (
          <Card key={label} padding="md" className="text-center">
            <p className={`text-2xl font-[300] ${color}`}>{val}</p>
            <p className="text-[15px] text-text-3 mt-1">{label}</p>
          </Card>
        ))}
      </div>

      {/* Filters + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={selectCls}>
          <option value="">All Categories</option>
          <option value="technical_seo">Technical SEO</option>
          <option value="content_seo">Content SEO</option>
          <option value="performance">Performance</option>
          <option value="geo">GEO</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectCls}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="implemented">Implemented</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleCopyAll} disabled={recommendations.length === 0}>Copy All</Button>
          <Button variant="secondary" size="sm" onClick={handleExportCSV} disabled={recommendations.length === 0}>Export CSV</Button>
        </div>
      </div>

      {/* Recommendations list */}
      {recommendations.length === 0 ? (
        <Card padding="lg" className="text-center">
          <p className="text-[17px] text-text-3">
            {filterCategory || filterStatus
              ? 'No recommendations match the current filters.'
              : 'No recommendations yet. Run an audit to generate recommendations.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec) => (
            <Card key={rec.id} padding="md">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-[15px] font-[500] border ${SEVERITY_STYLES[rec.severity] || SEVERITY_STYLES.info}`}>
                      {rec.severity}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[15px] font-[500] bg-surface-2 text-text-3">
                      {CATEGORY_LABELS[rec.category] || rec.category}
                    </span>
                    {rec.impact && <span className={`text-[15px] ${IMPACT_STYLES[rec.impact] || ''}`}>Impact: {rec.impact}</span>}
                    {rec.effort && <span className={`text-[15px] ${EFFORT_STYLES[rec.effort] || ''}`}>Effort: {rec.effort}</span>}
                    {rec.status !== 'pending' && (
                      <span className={`px-2 py-0.5 rounded text-[15px] font-[500] ${
                        rec.status === 'implemented' ? 'bg-[rgba(77,255,145,0.15)] text-[var(--green)]' : 'bg-surface-3 text-text-3'
                      }`}>
                        {rec.status}
                      </span>
                    )}
                  </div>
                  <h4 className="text-[17px] font-[500] text-text">{rec.title}</h4>
                  <p className="text-[16px] text-text-3 mt-1">{rec.description}</p>
                  {rec.pageUrl && (
                    <a href={rec.pageUrl} className="text-accent text-[15px] mt-1 inline-block hover:underline">{rec.pageUrl}</a>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {getAffectedPostsType(rec) && (
                    <Button variant="secondary" size="sm" onClick={() => handleViewDetails(rec)}>View Details</Button>
                  )}
                  {rec.status === 'pending' && (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => handleUpdateStatus(rec.id, 'implemented')} disabled={updatingId === rec.id}>Done</Button>
                      <button onClick={() => handleUpdateStatus(rec.id, 'dismissed')} disabled={updatingId === rec.id}
                        className="px-3 py-1 text-[15px] text-text-3 hover:text-text-2 transition-colors">
                        Dismiss
                      </button>
                    </>
                  )}
                  {rec.status !== 'pending' && (
                    <button onClick={() => handleUpdateStatus(rec.id, 'pending')} disabled={updatingId === rec.id}
                      className="px-3 py-1 text-[15px] text-text-3 hover:text-text-2 transition-colors">
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Details Modal */}
      {detailsRec && (
        <Modal open={detailsOpen} onClose={closeDetails} title={detailsRec.title} size="lg">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[15px] font-[500] border ${SEVERITY_STYLES[detailsRec.severity] || SEVERITY_STYLES.info}`}>
                {detailsRec.severity}
              </span>
              <span className="px-2 py-0.5 rounded text-[15px] font-[500] bg-surface-2 text-text-3">
                {CATEGORY_LABELS[detailsRec.category] || detailsRec.category}
              </span>
              {detailsRec.impact && <span className={`text-[15px] ${IMPACT_STYLES[detailsRec.impact] || ''}`}>Impact: {detailsRec.impact}</span>}
              {detailsRec.effort && <span className={`text-[15px] ${EFFORT_STYLES[detailsRec.effort] || ''}`}>Effort: {detailsRec.effort}</span>}
            </div>

            <p className="text-[17px] text-text-3">{affectedDesc}</p>

            {loadingDetails && (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 rounded-full border-2 border-border border-t-accent animate-spin" />
              </div>
            )}

            {!loadingDetails && affectedPosts.length > 0 && (
              <div className="border border-border rounded-[var(--radius)] overflow-hidden">
                <div className={`grid gap-4 px-4 py-2.5 bg-surface-2 text-[15px] font-[500] text-text-3 uppercase tracking-wide ${
                  affectedPosts[0]?.wordCount !== undefined ? 'grid-cols-[1fr_60px_auto]' : 'grid-cols-[1fr_auto]'
                }`}>
                  <span>Blog Post</span>
                  {affectedPosts[0]?.wordCount !== undefined && <span>Words</span>}
                  <span>Action</span>
                </div>
                {affectedPosts.map((post) => (
                  <div key={post.id} className={`grid gap-4 items-center px-4 py-3 border-t border-border hover:bg-surface-2 transition-colors ${
                    post.wordCount !== undefined ? 'grid-cols-[1fr_60px_auto]' : 'grid-cols-[1fr_auto]'
                  }`}>
                    <div className="min-w-0">
                      <p className="text-text text-[17px] font-[500] truncate">{post.title}</p>
                      <p className="text-text-3 text-[15px] truncate">/{post.slug}</p>
                    </div>
                    {post.wordCount !== undefined && (
                      <span className={`text-[17px] font-mono font-[600] tabular-nums text-right ${
                        post.wordCount < 300 ? 'text-[var(--red)]' : post.wordCount < 500 ? 'text-[var(--amber)]' : 'text-[var(--green)]'
                      }`}>{post.wordCount}</span>
                    )}
                    <div className="flex gap-2">
                      <a href={`/admin/content?tab=blog&edit=${post.id}`}
                        className="px-3 py-1.5 text-[15px] font-[500] rounded-[var(--radius-sm)] bg-[rgba(212,240,80,0.1)] text-accent border border-[rgba(212,240,80,0.2)] hover:bg-[rgba(212,240,80,0.2)] transition-colors whitespace-nowrap">
                        Edit
                      </a>
                      <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer"
                        className="px-3 py-1.5 text-[15px] font-[500] rounded-[var(--radius-sm)] bg-surface-2 text-text-3 hover:text-text transition-colors whitespace-nowrap">
                        View
                      </a>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-2.5 bg-surface-2/30 border-t border-border text-[15px] text-text-3">
                  {affectedPosts.length} affected post{affectedPosts.length !== 1 ? 's' : ''}
                  {affectedPosts[0]?.wordCount !== undefined && <> &middot; Target: 500+ words per post</>}
                </div>
              </div>
            )}

            {!loadingDetails && affectedPosts.length === 0 && (
              <div className="text-center py-6 border border-border rounded-[var(--radius)]">
                <p className="text-[17px] text-text-3">No affected blog posts found. This issue may have already been resolved.</p>
              </div>
            )}

            <div className="pt-2 flex justify-between items-center border-t border-border">
              <a href="/admin/content?tab=blog" className="text-accent text-[17px] hover:underline">Go to Blog Manager</a>
              <Button variant="secondary" size="sm" onClick={closeDetails}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
