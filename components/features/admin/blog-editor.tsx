'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import {
  ArrowLeft, ExternalLink, Trash2, X, Plus, Sparkles, Loader2,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Category { id: string; name: string; slug: string; }
interface Tag      { id: string; name: string; slug: string; }

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  status: string;
  featured: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  keywords: string | null;
  ogImage: string | null;
  createdAt: string;
  publishedAt: string | null;
  author: { username: string } | null;
  categories: Array<{ id: string; name: string; slug: string }>;
  tags: Array<{ id: string; name: string; slug: string }>;
}

interface Props {
  postId?: string;
  initialPost?: BlogPost | null;
}

// ─── SEO Scoring ────────────────────────────────────────────────────────────

function calcSeo(
  title: string, content: string, excerpt: string,
  metaTitle: string, metaDesc: string, keywords: string,
) {
  let score = 0;
  const items: { ok: boolean; text: string }[] = [];

  const push = (ok: boolean, text: string, pts: number) => {
    if (ok) score += pts;
    items.push({ ok, text });
  };

  push(title.trim().length >= 10,         'Title is set', 15);
  push(content.replace(/<[^>]+>/g, '').trim().length >= 300, 'Content has good length', 20);
  push(excerpt.trim().length >= 50,       'Excerpt added for listing previews', 10);

  const mdl = metaDesc.trim().length;
  if (mdl >= 120 && mdl <= 160) push(true,  `Meta description optimal (${mdl} chars)`, 20);
  else if (mdl > 0)              push(false, `Meta description should be 120–160 chars (${mdl} now)`, 0);
  else                           push(false, 'Add a meta description (120–160 characters)', 0);

  push(keywords.trim().length > 0,        'Keywords set for SEO targeting', 10);
  push(metaTitle.trim().length >= 10,     'Custom meta title set', 10);
  push(/<h[123]/i.test(content),          'Content has headings for structure', 10);
  if (title.trim().length >= 30 && title.trim().length <= 70) score += 5;

  return { score: Math.min(100, score), items };
}

function scoreColor(s: number) {
  if (s >= 70) return 'var(--green)';
  if (s >= 40) return 'var(--amber)';
  return 'var(--red)';
}
function scoreLabel(s: number) {
  if (s >= 70) return 'Good SEO';
  if (s >= 40) return 'Needs Work';
  return 'Poor SEO';
}

// ─── Toolbar button ─────────────────────────────────────────────────────────

const TB = 'px-2.5 py-1.5 text-[15px] text-text-2 hover:text-text hover:bg-surface-3 rounded transition-colors select-none';

// ─── Component ──────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED'];
const statusColor: Record<string, 'green' | 'muted' | 'amber' | 'red'> = {
  PUBLISHED: 'green', DRAFT: 'muted', SCHEDULED: 'amber', ARCHIVED: 'red',
};
const labelCls   = 'block text-[17px] font-[500] text-text-2 mb-1.5';
const selectCls  = 'w-full h-10 px-3 bg-surface-2 border border-border rounded-[var(--radius)] text-[18px] text-text focus:outline-none focus:border-border-2';

export function BlogEditor({ postId, initialPost }: Props) {
  const router    = useRouter();
  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInited = useRef(false);

  // Core fields
  const [title,   setTitle]   = useState(initialPost?.title   ?? '');
  const [excerpt, setExcerpt] = useState(initialPost?.excerpt ?? '');
  const [status,  setStatus]  = useState(initialPost?.status  ?? 'DRAFT');
  const [featured, setFeatured] = useState(initialPost?.featured ?? false);

  // SEO
  const [metaTitle, setMetaTitle] = useState(initialPost?.metaTitle        ?? '');
  const [metaDesc,  setMetaDesc]  = useState(initialPost?.metaDescription  ?? '');
  const [keywords,  setKeywords]  = useState(initialPost?.keywords         ?? '');
  const [ogImage,   setOgImage]   = useState(initialPost?.ogImage          ?? '');

  // Content HTML (tracked for SEO score, written via contenteditable)
  const [contentHtml, setContentHtml] = useState(initialPost?.content ?? '');

  // Categories
  const [allCategories,    setAllCategories]    = useState<Category[]>([]);
  const [selectedCatIds,   setSelectedCatIds]   = useState<Set<string>>(
    new Set(initialPost?.categories?.map(c => c.id) ?? []),
  );
  const [newCatName,  setNewCatName]  = useState('');
  const [addingCat,   setAddingCat]   = useState(false);
  const [creatingCat, setCreatingCat] = useState(false);

  // Tags
  const [allTags,      setAllTags]      = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<Array<{ id?: string; name: string }>>(
    initialPost?.tags?.map(t => ({ id: t.id, name: t.name })) ?? [],
  );
  const [tagInput, setTagInput] = useState('');

  // UI state
  const [activeTab,      setActiveTab]      = useState<'content' | 'seo'>('content');
  const [isSaving,       setIsSaving]       = useState(false);
  const [isGenerating,   setIsGenerating]   = useState(false);
  const [isDeleting,     setIsDeleting]     = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const [isDirty,        setIsDirty]        = useState(false);
  const [linkModal,      setLinkModal]      = useState(false);
  const [linkUrl,        setLinkUrl]        = useState('https://');
  const [imageModal,     setImageModal]     = useState(false);
  const [imageUrl,       setImageUrl]       = useState('');
  const [savedRange,     setSavedRange]     = useState<Range | null>(null);

  // Fetch categories + tags
  useEffect(() => {
    Promise.all([
      fetch('/api/admin/blog/categories').then(r => r.json()),
      fetch('/api/admin/blog/tags').then(r => r.json()),
    ]).then(([cd, td]) => {
      setAllCategories(cd.categories ?? []);
      setAllTags(td.tags ?? []);
    }).catch(() => {});
  }, []);

  // Seed editor content once
  useEffect(() => {
    if (editorRef.current && !editorInited.current) {
      editorRef.current.innerHTML = initialPost?.content ?? '';
      editorInited.current = true;
    }
  }, [initialPost?.content]);

  const mark = () => setIsDirty(true);

  // ── Rich text helpers ──────────────────────────────────────────────────────

  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    mark();
  };

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) setSavedRange(sel.getRangeAt(0).cloneRange());
  };

  const restoreSelection = () => {
    const sel = window.getSelection();
    sel?.removeAllRanges();
    if (savedRange) sel?.addRange(savedRange);
    editorRef.current?.focus();
  };

  const insertLink = () => {
    if (!linkUrl.trim() || linkUrl === 'https://') return;
    restoreSelection();
    execCmd('createLink', linkUrl.trim());
    setLinkModal(false);
    setLinkUrl('https://');
  };

  const insertImage = () => {
    if (!imageUrl.trim()) return;
    restoreSelection();
    execCmd('insertHTML', `<img src="${imageUrl.trim()}" alt="" style="max-width:100%;border-radius:8px;margin:12px 0;" />`);
    setImageModal(false);
    setImageUrl('');
  };

  // ── AI Generate ───────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!title.trim()) {
      toast({ type: 'error', title: 'Enter a title first to generate content' });
      return;
    }
    try {
      setIsGenerating(true);
      const res  = await fetch('/api/admin/blog/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generate failed');
      if (editorRef.current && data.content) {
        editorRef.current.innerHTML = data.content;
        setContentHtml(data.content);
        mark();
      }
      toast({ type: 'success', title: 'Content generated' });
    } catch (err) {
      toast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to generate' });
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Category helpers ──────────────────────────────────────────────────────

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      setCreatingCat(true);
      const res  = await fetch('/api/admin/blog/categories', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: newCatName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create category');
      const cat: Category = data.category;
      setAllCategories(prev => [...prev, cat]);
      setSelectedCatIds(prev => new Set([...prev, cat.id]));
      setNewCatName('');
      setAddingCat(false);
      mark();
    } catch (err) {
      toast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to create category' });
    } finally {
      setCreatingCat(false);
    }
  };

  // ── Tag helpers ───────────────────────────────────────────────────────────

  const addTag = (name: string) => {
    const n = name.trim();
    if (!n) return;
    if (selectedTags.find(t => t.name.toLowerCase() === n.toLowerCase())) return;
    const existing = allTags.find(t => t.name.toLowerCase() === n.toLowerCase());
    setSelectedTags(prev => [...prev, existing ? { id: existing.id, name: existing.name } : { name: n }]);
    setTagInput('');
    mark();
  };

  const removeTag = (name: string) => {
    setSelectedTags(prev => prev.filter(t => t.name !== name));
    mark();
  };

  const resolveTagIds = async (tags: Array<{ id?: string; name: string }>) => {
    const ids: string[] = [];
    for (const tag of tags) {
      if (tag.id) {
        ids.push(tag.id);
      } else {
        const res  = await fetch('/api/admin/blog/tags', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ name: tag.name }),
        });
        const data = await res.json();
        if (res.ok && data.tag?.id) ids.push(data.tag.id);
      }
    }
    return ids;
  };

  // ── Save / Delete ─────────────────────────────────────────────────────────

  const handleSave = async () => {
    const content = editorRef.current?.innerHTML ?? '';
    if (!title.trim()) {
      toast({ type: 'error', title: 'Title is required' });
      return;
    }
    try {
      setIsSaving(true);
      const tagIds = await resolveTagIds(selectedTags);
      const body   = {
        title:           title.trim(),
        excerpt:         excerpt.trim() || null,
        content,
        status,
        featured,
        metaTitle:       metaTitle.trim() || null,
        metaDescription: metaDesc.trim()  || null,
        keywords:        keywords.trim()  || null,
        ogImage:         ogImage.trim()   || null,
        categoryIds:     [...selectedCatIds],
        tagIds,
      };

      if (postId) {
        const res = await fetch(`/api/admin/blog/${postId}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to save');
        setIsDirty(false);
        toast({ type: 'success', title: 'Post saved' });
      } else {
        const res = await fetch('/api/admin/blog', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to create');
        const data = await res.json();
        toast({ type: 'success', title: 'Post created' });
        router.push(`/admin/blog/${data.post?.id}/edit`);
      }
    } catch (err) {
      toast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!postId) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/admin/blog/${postId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast({ type: 'success', title: 'Post deleted' });
      router.push('/admin/blog');
    } catch {
      toast({ type: 'error', title: 'Failed to delete' });
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  // ── SEO Score ─────────────────────────────────────────────────────────────

  const { score, items: seoItems } = calcSeo(title, contentHtml, excerpt, metaTitle, metaDesc, keywords);
  const circumference = 2 * Math.PI * 28; // r=28
  const dashOffset    = circumference * (1 - score / 100);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/admin/blog" className="flex-shrink-0 text-text-3 hover:text-text-2 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-[600] text-text tracking-[-0.3px] truncate">
              {postId ? (initialPost?.title || 'Edit Post') : 'New Post'}
            </h1>
            {postId && initialPost && (
              <div className="flex items-center gap-2 mt-0.5">
                <Badge color={statusColor[initialPost.status] ?? 'muted'} size="sm" dot>
                  {initialPost.status}
                </Badge>
                <span className="text-[14px] text-text-3">by {initialPost.author?.username ?? 'Unknown'}</span>
                {initialPost.slug && (
                  <Link
                    href={`/blog/${initialPost.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[14px] text-text-3 hover:text-accent transition-colors"
                  >
                    <ExternalLink size={12} />
                    View live
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isDirty && <span className="text-[14px] text-[var(--amber)] hidden sm:block">Unsaved changes</span>}
          {postId && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDelete}
              loading={isDeleting}
              className="text-[var(--red)] border-[var(--red)]/30 hover:border-[var(--red)]/60"
            >
              <Trash2 size={13} />
              {confirmDelete ? 'Confirm' : 'Delete'}
            </Button>
          )}
          <Button variant="accent" size="sm" onClick={handleSave} loading={isSaving}>
            {postId ? 'Save' : 'Create Post'}
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

        {/* ── Left: editor ──────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Tabs */}
          <div className="flex gap-1 bg-surface-2 p-1 rounded-[var(--radius)] border border-border w-fit">
            {(['content', 'seo'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-[6px] text-[16px] font-[500] transition-colors ${
                  activeTab === tab
                    ? 'bg-surface text-text border border-border'
                    : 'text-text-3 hover:text-text-2'
                }`}
              >
                {tab === 'content' ? 'Content' : 'SEO'}
              </button>
            ))}
          </div>

          {/* CONTENT TAB */}
          {activeTab === 'content' && (
            <div className="space-y-5">
              {/* Title + Generate */}
              <div>
                <label className={labelCls}>Title *</label>
                <div className="flex gap-2">
                  <Input
                    value={title}
                    onChange={e => { setTitle(e.target.value); mark(); }}
                    placeholder="Blog post title"
                    className="flex-1 text-[18px] h-10"
                    autoFocus={!postId}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleGenerate}
                    disabled={isGenerating || !title.trim()}
                    className="flex-shrink-0 gap-1.5 h-10 px-3 text-[16px]"
                  >
                    {isGenerating
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Sparkles size={14} />}
                    Generate with AI
                  </Button>
                </div>
              </div>

              {/* Excerpt */}
              <div>
                <label className={labelCls}>Excerpt</label>
                <Textarea
                  value={excerpt}
                  onChange={e => { setExcerpt(e.target.value); mark(); }}
                  rows={3}
                  placeholder="Short description for listings (optional)"
                  className="text-[18px]"
                />
              </div>

              {/* Content editor */}
              <div>
                <label className={labelCls}>Content *</label>
                <div className="border border-border rounded-[var(--radius)] overflow-hidden bg-surface-2 focus-within:border-border-2 transition-colors">
                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-surface-3">
                    {[
                      { label: 'H1', title: 'Heading 1',   fn: () => execCmd('formatBlock', '<h1>') },
                      { label: 'H2', title: 'Heading 2',   fn: () => execCmd('formatBlock', '<h2>') },
                      { label: 'H3', title: 'Heading 3',   fn: () => execCmd('formatBlock', '<h3>') },
                    ].map(b => (
                      <button key={b.label} title={b.title} onClick={b.fn} className={TB + ' font-[600]'}>{b.label}</button>
                    ))}
                    <span className="w-px h-4 bg-border mx-1" />
                    <button title="Bold"          onClick={() => execCmd('bold')}          className={TB + ' font-[700]'}>B</button>
                    <button title="Italic"        onClick={() => execCmd('italic')}        className={TB + ' italic'}>I</button>
                    <button title="Underline"     onClick={() => execCmd('underline')}     className={TB + ' underline'}>U</button>
                    <button title="Strikethrough" onClick={() => execCmd('strikeThrough')} className={TB + ' line-through'}>S</button>
                    <span className="w-px h-4 bg-border mx-1" />
                    <button title="Bullet list"   onClick={() => execCmd('insertUnorderedList')} className={TB}>•</button>
                    <button title="Numbered list" onClick={() => execCmd('insertOrderedList')}   className={TB}>1.</button>
                    <span className="w-px h-4 bg-border mx-1" />
                    <button
                      title="Link"
                      onClick={() => { saveSelection(); setLinkModal(true); }}
                      className={TB}
                    >
                      Link
                    </button>
                    <button
                      title="Image"
                      onClick={() => { saveSelection(); setImageModal(true); }}
                      className={TB}
                    >
                      Img
                    </button>
                    <span className="flex-1" />
                    <button title="Clear formatting" onClick={() => execCmd('removeFormat')} className={TB + ' text-[13px] text-text-3'}>
                      Clear
                    </button>
                  </div>

                  {/* Editable area */}
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={() => {
                      setContentHtml(editorRef.current?.innerHTML ?? '');
                      mark();
                    }}
                    className={[
                      'min-h-[420px] p-4 text-[18px] text-text leading-relaxed outline-none',
                      'prose prose-sm max-w-none',
                      'prose-headings:text-text prose-headings:font-[600]',
                      'prose-p:text-text-2 prose-strong:text-text prose-em:text-text-2',
                      'prose-a:text-accent prose-ul:text-text-2 prose-ol:text-text-2',
                      'prose-li:text-text-2 prose-code:text-accent prose-code:bg-surface-3',
                      'prose-blockquote:border-l-accent prose-blockquote:text-text-2',
                      'prose-img:rounded-[var(--radius)]',
                    ].join(' ')}
                    data-placeholder="Write your blog post content..."
                    style={{
                      // Placeholder via CSS
                    } as React.CSSProperties}
                  />

                  <style>{`
                    [contenteditable][data-placeholder]:empty::before {
                      content: attr(data-placeholder);
                      color: var(--text-3);
                      pointer-events: none;
                    }
                  `}</style>
                </div>
                <p className="text-[15px] text-text-3 mt-1">
                  {contentHtml.replace(/<[^>]+>/g, '').trim().split(/\s+/).filter(Boolean).length} words
                </p>
              </div>
            </div>
          )}

          {/* SEO TAB */}
          {activeTab === 'seo' && (
            <div className="space-y-5">
              <div>
                <label className={labelCls}>SEO Title</label>
                <Input
                  value={metaTitle}
                  onChange={e => { setMetaTitle(e.target.value); mark(); }}
                  placeholder="Custom title for search engines (defaults to post title)"
                  className="text-[18px] h-10"
                />
                <p className={`text-[15px] mt-1 ${metaTitle.length > 60 ? 'text-[var(--amber)]' : 'text-text-3'}`}>
                  {metaTitle.length}/60
                </p>
              </div>

              <div>
                <label className={labelCls}>Meta Description</label>
                <Textarea
                  value={metaDesc}
                  onChange={e => { setMetaDesc(e.target.value); mark(); }}
                  rows={4}
                  placeholder="Description shown in search results (120–160 chars)"
                  className="text-[18px]"
                />
                <p className={`text-[15px] mt-1 ${metaDesc.length > 160 ? 'text-[var(--red)]' : metaDesc.length >= 120 ? 'text-[var(--green)]' : 'text-text-3'}`}>
                  {metaDesc.length}/160
                  {metaDesc.length >= 120 && metaDesc.length <= 160 && ' ✓'}
                </p>
              </div>

              <div>
                <label className={labelCls}>Keywords</label>
                <Input
                  value={keywords}
                  onChange={e => { setKeywords(e.target.value); mark(); }}
                  placeholder="debate, argument, logic, critical thinking"
                  className="text-[18px] h-10"
                />
                <p className="text-[15px] text-text-3 mt-1">Comma-separated</p>
              </div>

              <div>
                <label className={labelCls}>OG Image URL</label>
                <Input
                  value={ogImage}
                  onChange={e => { setOgImage(e.target.value); mark(); }}
                  placeholder="https://… (overrides featured image)"
                  className="text-[18px] h-10 font-mono"
                />
              </div>

              {postId && initialPost?.slug && (
                <div className="p-4 bg-surface-2 border border-border rounded-[var(--radius)]">
                  <p className="text-[16px] font-[500] text-text-2 mb-1">Permalink</p>
                  <p className="text-[16px] font-mono text-text-3 break-all">
                    /blog/<span className="text-text">{initialPost.slug}</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right sidebar ─────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* SEO Score */}
          <div className="bg-surface border border-border rounded-[var(--radius)] p-4">
            <p className="text-[15px] font-[500] text-text-3 uppercase tracking-wide mb-3">SEO Score</p>
            <div className="flex flex-col items-center gap-2 mb-4">
              <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="28" fill="none" stroke="var(--surface-3)" strokeWidth="6" />
                <circle
                  cx="36" cy="36" r="28"
                  fill="none"
                  stroke={scoreColor(score)}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 36 36)"
                  style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                />
                <text x="36" y="40" textAnchor="middle" fontSize="16" fontWeight="600" fill="var(--text)">{score}</text>
              </svg>
              <span className="text-[15px] font-[500]" style={{ color: scoreColor(score) }}>
                {scoreLabel(score)}
              </span>
            </div>

            <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide mb-2">AI Suggestions</p>
            <div className="space-y-1.5">
              {seoItems.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span
                    className="mt-0.5 w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.ok ? 'var(--green)' : 'var(--red)', opacity: 0.8 }}
                  />
                  <p className={`text-[14px] leading-snug ${item.ok ? 'text-text-3' : 'text-text-2'}`}>
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Post Settings */}
          <div className="bg-surface border border-border rounded-[var(--radius)] p-4 space-y-4">
            <p className="text-[15px] font-[500] text-text">Post Settings</p>

            <div>
              <label className={labelCls}>Status</label>
              <select value={status} onChange={e => { setStatus(e.target.value); mark(); }} className={selectCls}>
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-[17px] text-text-2 cursor-pointer" htmlFor="feat-toggle">Featured post</label>
              <button
                id="feat-toggle"
                role="switch"
                aria-checked={featured}
                onClick={() => { setFeatured(f => !f); mark(); }}
                className={`relative w-10 h-5 rounded-full transition-colors ${featured ? 'bg-accent' : 'bg-surface-3 border border-border'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${featured ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {initialPost?.publishedAt && (
              <p className="text-[15px] text-text-3">
                Published: {new Date(initialPost.publishedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}
              </p>
            )}
            {initialPost?.createdAt && (
              <p className="text-[15px] text-text-3">
                Created: {new Date(initialPost.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}
              </p>
            )}
          </div>

          {/* Categories */}
          <div className="bg-surface border border-border rounded-[var(--radius)] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[15px] font-[500] text-text">Categories</p>
              <button
                onClick={() => setAddingCat(a => !a)}
                className="flex items-center gap-1 text-[15px] text-accent hover:text-accent-2 transition-colors"
              >
                <Plus size={13} />
                New
              </button>
            </div>

            {addingCat && (
              <div className="flex gap-2 mb-3">
                <input
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateCategory()}
                  placeholder="Category name"
                  autoFocus
                  className="flex-1 h-8 px-2.5 bg-surface-2 border border-border rounded text-[16px] text-text placeholder:text-text-3 focus:outline-none focus:border-border-2"
                />
                <button
                  onClick={handleCreateCategory}
                  disabled={creatingCat || !newCatName.trim()}
                  className="px-3 h-8 text-[15px] bg-accent text-bg rounded hover:bg-accent-2 disabled:opacity-50 transition-colors"
                >
                  Add
                </button>
              </div>
            )}

            <div className="space-y-2">
              {allCategories.length === 0 && (
                <p className="text-[15px] text-text-3">No categories yet. Click + New above.</p>
              )}
              {allCategories.map(cat => (
                <label key={cat.id} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedCatIds.has(cat.id)}
                    onChange={e => {
                      setSelectedCatIds(prev => {
                        const next = new Set(prev);
                        e.target.checked ? next.add(cat.id) : next.delete(cat.id);
                        return next;
                      });
                      mark();
                    }}
                    className="w-4 h-4 rounded border-border accent-[var(--accent)] cursor-pointer"
                  />
                  <span className="text-[17px] text-text-2 group-hover:text-text transition-colors">{cat.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="bg-surface border border-border rounded-[var(--radius)] p-4">
            <p className="text-[15px] font-[500] text-text mb-3">Tags</p>

            {/* Selected tag chips */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {selectedTags.map(tag => (
                  <span
                    key={tag.name}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-2 border border-border rounded-full text-[15px] text-text-2"
                  >
                    {tag.name}
                    <button
                      onClick={() => removeTag(tag.name)}
                      className="text-text-3 hover:text-text transition-colors"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Tag input */}
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                }}
                placeholder="Type + Enter"
                className="flex-1 h-8 px-2.5 bg-surface-2 border border-border rounded text-[16px] text-text placeholder:text-text-3 focus:outline-none focus:border-border-2"
              />
              <button
                onClick={() => addTag(tagInput)}
                disabled={!tagInput.trim()}
                className="px-3 h-8 text-[15px] bg-surface-2 border border-border text-text-2 rounded hover:border-border-2 disabled:opacity-40 transition-colors"
              >
                Add
              </button>
            </div>

            {/* Suggestions from existing tags */}
            {tagInput.trim() && allTags.filter(t =>
              t.name.toLowerCase().includes(tagInput.toLowerCase()) &&
              !selectedTags.find(s => s.name.toLowerCase() === t.name.toLowerCase())
            ).slice(0, 4).map(t => (
              <button
                key={t.id}
                onClick={() => { addTag(t.name); }}
                className="block w-full text-left px-2.5 py-1 mt-1 text-[16px] text-text-2 hover:bg-surface-2 rounded transition-colors"
              >
                {t.name}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Link Modal */}
      <Modal open={linkModal} onClose={() => setLinkModal(false)} title="Insert Link">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>URL</label>
            <Input
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://…"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && insertLink()}
              className="text-[18px] font-mono h-10"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setLinkModal(false)}>Cancel</Button>
            <Button variant="accent" size="sm" onClick={insertLink}>Insert Link</Button>
          </div>
        </div>
      </Modal>

      {/* Image Modal */}
      <Modal open={imageModal} onClose={() => setImageModal(false)} title="Insert Image">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Image URL</label>
            <Input
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="https://…"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && insertImage()}
              className="text-[18px] font-mono h-10"
            />
          </div>
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="preview" className="w-full max-h-40 object-cover rounded-[var(--radius)] border border-border" />
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setImageModal(false)}>Cancel</Button>
            <Button variant="accent" size="sm" onClick={insertImage}>Insert Image</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
