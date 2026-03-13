'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import {
  Twitter, Linkedin, Facebook, Instagram, Share2,
  Plus, Trash2, Send, Copy, Check, RefreshCw,
  ChevronDown, ChevronUp, Eye, EyeOff, Clock,
} from 'lucide-react';
import { cn } from '@/lib/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SocialPost {
  id: string;
  platform: string;
  content: string;
  hashtags: string | null;
  imagePrompt: string | null;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  debate?: { topic: string } | null;
}

interface GeneratedCard {
  platform: string;
  content: string;
  hashtags: string;
  imagePrompt: string;
  savedId?: string;
  charLimit: number;
}

interface AutoConfig {
  enabled: boolean;
  platforms: string[];
  hourUtc: number;
  topics: string[];
  includeDebates: boolean;
  requireApproval: boolean;
}

// ─── Platform config ──────────────────────────────────────────────────────────

const PLATFORMS = [
  { id: 'TWITTER',   label: 'Twitter / X', icon: Twitter,   limit: 280,  color: 'text-[#1da1f2]', note: null },
  { id: 'LINKEDIN',  label: 'LinkedIn',    icon: Linkedin,  limit: 3000, color: 'text-[#0a66c2]', note: null },
  { id: 'FACEBOOK',  label: 'Facebook',    icon: Facebook,  limit: 2000, color: 'text-[#1877f2]', note: null },
  { id: 'INSTAGRAM', label: 'Instagram',   icon: Instagram, limit: 2200, color: 'text-[#e1306c]', note: 'Needs image' },
  { id: 'TIKTOK',    label: 'TikTok',      icon: Share2,    limit: 300,  color: 'text-text-3',    note: 'Coming soon' },
];

const TONES = ['Informative', 'Engaging', 'Promotional', 'Controversial'];

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'muted',
  SCHEDULED: 'amber',
  PUBLISHED: 'green',
  FAILED: 'red',
  CANCELLED: 'muted',
};

const PLATFORM_CREDENTIAL_FIELDS: Record<string, { key: string; label: string; placeholder: string }[]> = {
  TWITTER: [
    { key: 'SOCIAL_TWITTER_API_KEY',       label: 'API Key',             placeholder: 'Consumer Key from developer.twitter.com' },
    { key: 'SOCIAL_TWITTER_API_SECRET',    label: 'API Secret',          placeholder: 'Consumer Secret' },
    { key: 'SOCIAL_TWITTER_ACCESS_TOKEN',  label: 'Access Token',        placeholder: 'OAuth 1.0a Access Token' },
    { key: 'SOCIAL_TWITTER_ACCESS_SECRET', label: 'Access Token Secret', placeholder: 'OAuth 1.0a Access Secret' },
  ],
  LINKEDIN: [
    { key: 'SOCIAL_LINKEDIN_ACCESS_TOKEN', label: 'Access Token', placeholder: '60-day OAuth access token' },
    { key: 'SOCIAL_LINKEDIN_PERSON_URN',   label: 'Person URN',   placeholder: 'urn:li:person:XXXXXXXX from /v2/me' },
  ],
  FACEBOOK: [
    { key: 'SOCIAL_FACEBOOK_PAGE_ACCESS_TOKEN', label: 'Page Access Token', placeholder: 'Never-expiring page token' },
    { key: 'SOCIAL_FACEBOOK_PAGE_ID',           label: 'Page ID',           placeholder: 'Numeric page ID from Page About' },
  ],
  INSTAGRAM: [],
};

const SETUP_HINTS: Record<string, string> = {
  TWITTER:   'developer.twitter.com → App → Keys and tokens → OAuth 1.0a Read+Write → Generate Access Token + Secret',
  LINKEDIN:  'linkedin.com/developers → App → Auth → Request w_member_social scope → get 60-day token → Person URN from GET /v2/me',
  FACEBOOK:  'developers.facebook.com → App → Add Pages product → Page Settings → Generate never-expiring token → get Page ID from Page About URL',
  INSTAGRAM: 'Instagram text-only posts are NOT supported by the API. You need a media URL. Use the imagePrompt field to generate an image first.',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function charColor(len: number, limit: number) {
  const pct = len / limit;
  if (pct < 0.8) return 'text-text-3';
  if (pct < 1)   return 'text-[var(--amber)]';
  return 'text-[var(--red)]';
}

function platformInfo(id: string) {
  return PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[0];
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SocialPostsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'generator' | 'queue' | 'published' | 'automation' | 'connections'>('generator');

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">Social Media</h1>
        <p className="text-[17px] text-text-3 mt-0.5">AI-powered post generation and auto-publishing</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {(['generator', 'queue', 'published', 'automation', 'connections'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-[16px] font-[500] capitalize border-b-2 -mb-px transition-colors',
              tab === t
                ? 'border-accent text-accent'
                : 'border-transparent text-text-3 hover:text-text-2',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'generator'   && <GeneratorTab toast={toast} queryClient={queryClient} />}
      {tab === 'queue'       && <QueueTab toast={toast} queryClient={queryClient} />}
      {tab === 'published'   && <PublishedTab />}
      {tab === 'automation'  && <AutomationTab toast={toast} />}
      {tab === 'connections' && <ConnectionsTab toast={toast} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — Generator
// ═══════════════════════════════════════════════════════════════════════════════

function GeneratorTab({ toast, queryClient }: { toast: any; queryClient: any }) {
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('Engaging');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['TWITTER', 'LINKEDIN']);
  const [results, setResults] = useState<GeneratedCard[]>([]);
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  const [expandedImages, setExpandedImages] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/social-posts/bulk-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim() || 'ArguFight debate platform',
          tone,
          platforms: selectedPlatforms,
        }),
      });
      if (!res.ok) throw new Error('Generation failed');
      return res.json();
    },
    onSuccess: (data) => {
      setResults(data.posts ?? []);
      setEditedContent({});
      if (data.errors?.length) {
        toast({ type: 'error', title: `${data.errors.length} platform(s) failed to generate` });
      } else {
        toast({ type: 'success', title: `Generated ${data.posts.length} posts` });
      }
    },
    onError: () => toast({ type: 'error', title: 'Generation failed' }),
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setUTCHours(9, 0, 0, 0);
      const res = await fetch(`/api/admin/social-posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, status: 'SCHEDULED', scheduledAt: tomorrow.toISOString() }),
      });
      if (!res.ok) throw new Error('Failed to approve');
    },
    onSuccess: () => {
      toast({ type: 'success', title: 'Scheduled for tomorrow 9 AM UTC' });
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
    },
    onError: () => toast({ type: 'error', title: 'Failed to approve post' }),
  });

  const discardMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/social-posts/${id}`, { method: 'DELETE' }),
    onSuccess: (_: any, id: string) => {
      setResults((r) => r.filter((c) => c.savedId !== id));
      toast({ type: 'success', title: 'Post discarded' });
    },
    onError: () => toast({ type: 'error', title: 'Failed to discard' }),
  });

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  return (
    <div className="space-y-5">
      <Card padding="md" className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[16px] font-[500] text-text-2 mb-1.5">Topic / Theme</label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. The art of persuasion in modern debates"
            />
          </div>
          <div>
            <label className="block text-[16px] font-[500] text-text-2 mb-1.5">Tone</label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={cn(
                    'px-3 py-1.5 rounded text-[15px] border transition-colors',
                    tone === t
                      ? 'border-accent text-accent bg-[rgba(212,240,80,0.06)]'
                      : 'border-border text-text-3 hover:text-text-2',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[16px] font-[500] text-text-2 mb-2">Platforms</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => {
              const Icon = p.icon;
              const selected = selectedPlatforms.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => p.note !== 'Coming soon' && togglePlatform(p.id)}
                  disabled={p.note === 'Coming soon'}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded border text-[15px] transition-colors',
                    selected && p.note !== 'Coming soon'
                      ? 'border-accent text-accent bg-[rgba(212,240,80,0.06)]'
                      : 'border-border text-text-3 hover:text-text-2',
                    p.note === 'Coming soon' && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  <Icon size={13} className={selected ? p.color : ''} />
                  {p.label}
                  {p.note && <Badge color="muted" size="sm">{p.note}</Badge>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            variant="accent"
            size="sm"
            onClick={() => generateMutation.mutate()}
            loading={generateMutation.isPending}
            disabled={selectedPlatforms.length === 0}
          >
            Generate All
          </Button>
        </div>
      </Card>

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((card) => {
            const info = platformInfo(card.platform);
            const Icon = info.icon;
            const content = editedContent[card.platform] ?? card.content;
            const len = content.length;

            return (
              <Card key={card.platform} padding="md" className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon size={15} className={info.color} />
                    <span className="text-[17px] font-[500] text-text">{info.label}</span>
                    {card.savedId && <Badge color="muted" size="sm">Draft saved</Badge>}
                  </div>
                  <span className={cn('text-[15px]', charColor(len, card.charLimit))}>
                    {len.toLocaleString()} / {card.charLimit.toLocaleString()}
                  </span>
                </div>

                <Textarea
                  value={content}
                  onChange={(e) => setEditedContent((prev) => ({ ...prev, [card.platform]: e.target.value }))}
                  rows={4}
                  className="text-[16px]"
                />

                {card.hashtags && (
                  <p className="text-[15px] text-text-3">{card.hashtags}</p>
                )}

                {card.imagePrompt && (
                  <div>
                    <button
                      onClick={() => setExpandedImages((p) => ({ ...p, [card.platform]: !p[card.platform] }))}
                      className="flex items-center gap-1 text-[15px] text-text-3 hover:text-text-2 transition-colors"
                    >
                      {expandedImages[card.platform] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      Image prompt
                    </button>
                    {expandedImages[card.platform] && (
                      <p className="mt-1 text-[15px] text-text-3 bg-surface-2 rounded p-2">{card.imagePrompt}</p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 border-t border-border">
                  <Button variant="ghost" size="sm" onClick={() => handleCopy(card.platform, content)}>
                    {copied === card.platform
                      ? <><Check size={13} className="mr-1 text-accent" />Copied</>
                      : <><Copy size={13} className="mr-1" />Copy</>}
                  </Button>
                  {card.savedId && (
                    <>
                      <Button
                        variant="accent"
                        size="sm"
                        onClick={() => approveMutation.mutate({ id: card.savedId!, content })}
                        loading={approveMutation.isPending}
                      >
                        <Clock size={13} className="mr-1" />
                        Approve
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => discardMutation.mutate(card.savedId!)}
                        className="text-[var(--red)]"
                      >
                        <Trash2 size={13} className="mr-1" />
                        Discard
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — Queue
// ═══════════════════════════════════════════════════════════════════════════════

function QueueTab({ toast, queryClient }: { toast: any; queryClient: any }) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [platformFilter, setPlatformFilter] = useState('ALL');

  const { data: draftData } = useQuery<{ posts: SocialPost[] }>({
    queryKey: ['social-posts', 'DRAFT'],
    queryFn: () => fetch('/api/admin/social-posts?status=DRAFT').then((r) => r.json()),
    staleTime: 30_000,
  });

  const { data: scheduledData } = useQuery<{ posts: SocialPost[] }>({
    queryKey: ['social-posts', 'SCHEDULED'],
    queryFn: () => fetch('/api/admin/social-posts?status=SCHEDULED').then((r) => r.json()),
    staleTime: 30_000,
  });

  const allPosts = [
    ...(draftData?.posts ?? []),
    ...(scheduledData?.posts ?? []),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filtered = allPosts.filter((p) => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (platformFilter !== 'ALL' && p.platform !== platformFilter) return false;
    return true;
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['social-posts'] });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/social-posts/${id}/publish`, { method: 'POST' });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ type: 'success', title: 'Published successfully' });
      } else {
        toast({ type: 'error', title: data.error ?? 'Publish failed' });
      }
      invalidate();
    },
    onError: () => toast({ type: 'error', title: 'Publish failed' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/social-posts/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast({ type: 'success', title: 'Deleted' }); invalidate(); },
    onError: () => toast({ type: 'error', title: 'Delete failed' }),
  });

  const approveAllMutation = useMutation({
    mutationFn: async () => {
      const drafts = allPosts.filter((p) => p.status === 'DRAFT');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setUTCHours(9, 0, 0, 0);
      await Promise.all(
        drafts.map((p) =>
          fetch(`/api/admin/social-posts/${p.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'SCHEDULED', scheduledAt: tomorrow.toISOString() }),
          }),
        ),
      );
    },
    onSuccess: () => { toast({ type: 'success', title: 'All drafts approved' }); invalidate(); },
    onError: () => toast({ type: 'error', title: 'Approval failed' }),
  });

  const draftCount = allPosts.filter((p) => p.status === 'DRAFT').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {['ALL', 'DRAFT', 'SCHEDULED'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1 rounded text-[15px] border transition-colors',
                statusFilter === s
                  ? 'border-accent text-accent bg-[rgba(212,240,80,0.06)]'
                  : 'border-border text-text-3 hover:text-text-2',
              )}
            >
              {s}
            </button>
          ))}
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="px-2 py-1 rounded border border-border bg-surface-2 text-[15px] text-text-2 outline-none"
          >
            <option value="ALL">All platforms</option>
            {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        {draftCount > 0 && (
          <Button
            variant="accent"
            size="sm"
            onClick={() => approveAllMutation.mutate()}
            loading={approveAllMutation.isPending}
          >
            <Check size={13} className="mr-1.5" />
            Approve all {draftCount} drafts
          </Button>
        )}
      </div>

      <Card padding="none">
        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-[17px] text-text-3">No posts in queue.</p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((post) => {
              const info = platformInfo(post.platform);
              const Icon = info.icon;
              return (
                <div key={post.id} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-2/50 transition-colors">
                  <Icon size={15} className={cn('flex-shrink-0', info.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[16px] text-text truncate">{post.content.slice(0, 100)}{post.content.length > 100 ? '…' : ''}</p>
                    <p className="text-[15px] text-text-3 mt-0.5">
                      {post.status === 'SCHEDULED' ? `Scheduled: ${fmtDate(post.scheduledAt)}` : 'Draft — pending approval'}
                    </p>
                  </div>
                  <Badge color={STATUS_COLORS[post.status] as any} size="sm">{post.status}</Badge>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => publishMutation.mutate(post.id)}
                      title="Publish now"
                    >
                      <Send size={13} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(post.id)}
                      className="text-[var(--red)]"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — Published
// ═══════════════════════════════════════════════════════════════════════════════

function PublishedTab() {
  const [platformFilter, setPlatformFilter] = useState('ALL');

  const { data, isLoading } = useQuery<{ posts: SocialPost[] }>({
    queryKey: ['social-posts', 'PUBLISHED'],
    queryFn: () => fetch('/api/admin/social-posts?status=PUBLISHED').then((r) => r.json()),
    staleTime: 60_000,
  });

  const posts = data?.posts ?? [];
  const filtered = platformFilter === 'ALL' ? posts : posts.filter((p) => p.platform === platformFilter);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {PLATFORMS.map((p) => {
          const Icon = p.icon;
          const count = posts.filter((post) => post.platform === p.id).length;
          return (
            <Card key={p.id} padding="md" className="text-center">
              <Icon size={18} className={cn('mx-auto mb-1', p.color)} />
              <p className="text-xl font-[200] text-text">{count}</p>
              <p className="text-[15px] text-text-3">{p.label}</p>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-2 flex-wrap">
        {['ALL', ...PLATFORMS.map((p) => p.id)].map((f) => (
          <button
            key={f}
            onClick={() => setPlatformFilter(f)}
            className={cn(
              'px-3 py-1 rounded text-[15px] border transition-colors',
              platformFilter === f
                ? 'border-accent text-accent bg-[rgba(212,240,80,0.06)]'
                : 'border-border text-text-3 hover:text-text-2',
            )}
          >
            {f === 'ALL' ? 'All' : platformInfo(f).label}
          </button>
        ))}
      </div>

      <Card padding="none">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="h-5 w-5 rounded-full border-2 border-border border-t-accent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-[17px] text-text-3">No published posts yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((post) => {
              const info = platformInfo(post.platform);
              const Icon = info.icon;
              return (
                <div key={post.id} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-2/50">
                  <Icon size={15} className={cn('flex-shrink-0', info.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[16px] text-text truncate">{post.content.slice(0, 120)}{post.content.length > 120 ? '…' : ''}</p>
                    <p className="text-[15px] text-text-3 mt-0.5">Published {fmtDate(post.publishedAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4 — Automation
// ═══════════════════════════════════════════════════════════════════════════════

function AutomationTab({ toast }: { toast: any }) {
  const [config, setConfig] = useState<AutoConfig>({
    enabled: true,
    platforms: ['TWITTER', 'LINKEDIN', 'FACEBOOK'],
    hourUtc: 9,
    topics: [],
    includeDebates: true,
    requireApproval: true,
  });
  const [newTopic, setNewTopic] = useState('');

  const { isLoading } = useQuery({
    queryKey: ['social-automation'],
    queryFn: async () => {
      const res = await fetch('/api/admin/social-posts/automation');
      const data = await res.json();
      setConfig(data);
      return data;
    },
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      fetch('/api/admin/social-posts/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      }),
    onSuccess: () => toast({ type: 'success', title: 'Automation settings saved' }),
    onError: () => toast({ type: 'error', title: 'Failed to save' }),
  });

  const togglePlatform = (id: string) => {
    setConfig((c) => ({
      ...c,
      platforms: c.platforms.includes(id)
        ? c.platforms.filter((p) => p !== id)
        : [...c.platforms, id],
    }));
  };

  const addTopic = () => {
    const t = newTopic.trim();
    if (!t) return;
    setConfig((c) => ({ ...c, topics: [...c.topics, t] }));
    setNewTopic('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="h-5 w-5 rounded-full border-2 border-border border-t-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card padding="md" className="space-y-5">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[17px] font-[500] text-text">Enable daily auto-generation</p>
            <p className="text-[15px] text-text-3 mt-0.5">AI generates posts every day at the scheduled time</p>
          </div>
          <button
            onClick={() => setConfig((c) => ({ ...c, enabled: !c.enabled }))}
            className={cn(
              'relative w-10 h-6 rounded-full transition-colors flex-shrink-0',
              config.enabled ? 'bg-accent' : 'bg-surface-3',
            )}
          >
            <div className={cn(
              'absolute top-1 w-4 h-4 rounded-full bg-bg transition-transform',
              config.enabled ? 'translate-x-5' : 'translate-x-1',
            )} />
          </button>
        </div>

        {/* Platforms */}
        <div>
          <p className="text-[16px] font-[500] text-text-2 mb-2">Generate for</p>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.filter((p) => p.note !== 'Coming soon' && p.note !== 'Needs image').map((p) => {
              const Icon = p.icon;
              const selected = config.platforms.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded border text-[15px] transition-colors',
                    selected
                      ? 'border-accent text-accent bg-[rgba(212,240,80,0.06)]'
                      : 'border-border text-text-3 hover:text-text-2',
                  )}
                >
                  <Icon size={13} className={selected ? p.color : ''} />
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Hour */}
        <div>
          <p className="text-[16px] font-[500] text-text-2 mb-1.5">Cron time (UTC)</p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="23"
              value={config.hourUtc}
              onChange={(e) => setConfig((c) => ({ ...c, hourUtc: parseInt(e.target.value) }))}
              className="w-48"
            />
            <span className="text-[16px] font-[500] text-text-2">
              {String(config.hourUtc).padStart(2, '0')}:00 UTC
            </span>
          </div>
        </div>

        {/* Topic pool */}
        <div>
          <p className="text-[16px] font-[500] text-text-2 mb-2">Topic rotation pool</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {config.topics.map((t) => (
              <span
                key={t}
                className="flex items-center gap-1 px-2 py-1 rounded bg-surface-2 text-[15px] text-text-2 border border-border"
              >
                {t}
                <button
                  onClick={() => setConfig((c) => ({ ...c, topics: c.topics.filter((x) => x !== t) }))}
                  className="text-text-3 hover:text-[var(--red)] ml-1"
                >
                  ×
                </button>
              </span>
            ))}
            {config.topics.length === 0 && (
              <p className="text-[15px] text-text-3 italic">No topics — add some below</p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTopic()}
              placeholder="Add topic theme…"
              className="flex-1"
            />
            <Button variant="secondary" size="sm" onClick={addTopic}>
              <Plus size={13} />
            </Button>
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-3 pt-2 border-t border-border">
          {[
            {
              key: 'includeDebates' as const,
              label: 'Use recent debate topics as themes',
              sub: 'Overrides the rotation pool when enabled',
            },
            {
              key: 'requireApproval' as const,
              label: 'Require approval before publishing',
              sub: 'Posts land in DRAFT queue instead of auto-scheduling',
            },
          ].map(({ key, label, sub }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <p className="text-[16px] text-text-2">{label}</p>
                <p className="text-[15px] text-text-3">{sub}</p>
              </div>
              <button
                onClick={() => setConfig((c) => ({ ...c, [key]: !c[key] }))}
                className={cn(
                  'relative w-10 h-6 rounded-full transition-colors flex-shrink-0',
                  config[key] ? 'bg-accent' : 'bg-surface-3',
                )}
              >
                <div className={cn(
                  'absolute top-1 w-4 h-4 rounded-full bg-bg transition-transform',
                  config[key] ? 'translate-x-5' : 'translate-x-1',
                )} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button variant="accent" size="sm" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
            Save Settings
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 5 — Connections
// ═══════════════════════════════════════════════════════════════════════════════

function ConnectionsTab({ toast }: { toast: any }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showFields, setShowFields] = useState<Record<string, boolean>>({});
  const [expandedHint, setExpandedHint] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; error?: string } | null>>({});

  useQuery({
    queryKey: ['social-credentials'],
    queryFn: async () => {
      const res = await fetch('/api/admin/social-posts/credentials');
      const data = await res.json();
      setValues(data.values ?? {});
      return data;
    },
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      fetch('/api/admin/social-posts/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      }),
    onSuccess: () => toast({ type: 'success', title: 'Credentials saved' }),
    onError: () => toast({ type: 'error', title: 'Failed to save credentials' }),
  });

  const testMutation = useMutation({
    mutationFn: async (platform: string) => {
      await fetch('/api/admin/social-posts/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const res = await fetch('/api/admin/social-posts/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      });
      return { platform, result: await res.json() };
    },
    onSuccess: ({ platform, result }: { platform: string; result: any }) => {
      setTestResults((prev) => ({ ...prev, [platform]: result }));
      toast({
        type: result.success ? 'success' : 'error',
        title: result.success ? `${platformInfo(platform).label} connected` : result.error ?? 'Connection failed',
      });
    },
  });

  return (
    <div className="space-y-4">
      {PLATFORMS.filter((p) => p.id !== 'TIKTOK').map((p) => {
        const Icon = p.icon;
        const fields = PLATFORM_CREDENTIAL_FIELDS[p.id] ?? [];
        const allSet = fields.length > 0 && fields.every((f) => !!values[f.key]);
        const test = testResults[p.id];

        return (
          <Card key={p.id} padding="md" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Icon size={18} className={p.color} />
                <span className="text-[17px] font-[500] text-text">{p.label}</span>
                <span className={cn('w-2 h-2 rounded-full', allSet ? 'bg-green-500' : 'bg-surface-3')} />
                {test && (
                  <Badge color={test.success ? 'green' : 'red'} size="sm">
                    {test.success ? 'Connected' : 'Error'}
                  </Badge>
                )}
              </div>
              {fields.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => testMutation.mutate(p.id)}
                  loading={testMutation.isPending}
                >
                  <RefreshCw size={12} className="mr-1" />
                  Test Connection
                </Button>
              )}
            </div>

            {test && !test.success && test.error && (
              <p className="text-[15px] text-[var(--red)] bg-[rgba(239,68,68,0.08)] rounded px-3 py-2">
                {test.error}
              </p>
            )}

            {p.id === 'INSTAGRAM' ? (
              <p className="text-[15px] text-[var(--amber)] bg-[rgba(245,158,11,0.08)] rounded px-3 py-2">
                Instagram text-only posts are not supported by the API. Use the imagePrompt field in Generator to create an image prompt, then upload manually.
              </p>
            ) : (
              <div className="space-y-3">
                {fields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-[15px] font-[500] text-text-2 mb-1">{field.label}</label>
                    <div className="relative">
                      <input
                        type={showFields[field.key] ? 'text' : 'password'}
                        value={values[field.key] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 pr-10 rounded border border-border bg-surface-2 text-[16px] text-text-2 outline-none focus:border-accent/60 transition-colors placeholder:text-text-3"
                      />
                      <button
                        onClick={() => setShowFields((s) => ({ ...s, [field.key]: !s[field.key] }))}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-2 transition-colors"
                      >
                        {showFields[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div>
              <button
                onClick={() => setExpandedHint(expandedHint === p.id ? null : p.id)}
                className="flex items-center gap-1 text-[15px] text-text-3 hover:text-text-2 transition-colors"
              >
                {expandedHint === p.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Setup guide
              </button>
              {expandedHint === p.id && (
                <p className="mt-2 text-[15px] text-text-3 bg-surface-2 rounded p-3">
                  {SETUP_HINTS[p.id]}
                </p>
              )}
            </div>
          </Card>
        );
      })}

      <div className="flex justify-end">
        <Button variant="accent" size="sm" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
          Save All Credentials
        </Button>
      </div>
    </div>
  );
}
