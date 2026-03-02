'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import {
  Plus, Eye, EyeOff, Edit2, Trash2, ExternalLink,
  FileText, Globe, Scale,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SectionImage { id: string; url: string; alt: string | null; order: number }
interface SectionButton { id: string; text: string; url: string; variant: string | null; order: number; isVisible: boolean }
interface Section {
  id: string; key: string; title: string | null; content: string | null;
  order: number; isVisible: boolean;
  metaTitle: string | null; metaDescription: string | null;
  images: SectionImage[]; buttons: SectionButton[];
}

interface LegalPage {
  id: string; slug: string; title: string; content: string;
  isVisible: boolean; metaTitle: string | null; metaDescription: string | null;
  updatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const labelCls = 'block text-[15px] font-[500] text-text-2 mb-1.5';
const inputCls = 'w-full h-9 px-3 bg-surface-2 border border-border rounded-[var(--radius)] text-[15px] text-text focus:outline-none focus:border-border-2';
const SECTION_KEYS = ['hero', 'features', 'how-it-works', 'stats', 'testimonials', 'cta', 'app-download', 'faq'];

const TABS = [
  { id: 'homepage', label: 'Homepage', icon: Globe },
  { id: 'seo',      label: 'SEO',      icon: FileText },
  { id: 'legal',    label: 'Legal',    icon: Scale },
] as const;
type TabId = typeof TABS[number]['id'];

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({
  section, onEdit, onToggle, onDelete,
}: {
  section: Section;
  onEdit: (s: Section) => void;
  onToggle: (s: Section) => void;
  onDelete: (s: Section) => void;
}) {
  const preview = section.content
    ? section.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
    : null;

  return (
    <div className="flex items-start gap-4 px-4 py-4 hover:bg-surface-2/40 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="text-[17px] font-[600] text-text">{section.title || `(${section.key})`}</p>
          <Badge color="muted" size="sm">{section.key}</Badge>
          <Badge color={section.isVisible ? 'green' : 'muted'} size="sm" dot>
            {section.isVisible ? 'Visible' : 'Hidden'}
          </Badge>
        </div>
        {preview && (
          <p className="text-[15px] text-text-3 line-clamp-2 mb-2">{preview}</p>
        )}
        <p className="text-[13px] text-text-3">
          {section.images.length} image(s) &nbsp;&middot;&nbsp;
          {section.buttons.length} button(s) &nbsp;&middot;&nbsp;
          Order: {section.order}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="secondary" size="sm"
          onClick={() => onToggle(section)}
          title={section.isVisible ? 'Hide section' : 'Show section'}
        >
          {section.isVisible ? <EyeOff size={13} className="mr-1" /> : <Eye size={13} className="mr-1" />}
          {section.isVisible ? 'Hide' : 'Show'}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onEdit(section)}>
          <Edit2 size={13} className="mr-1" />
          Edit
        </Button>
        <Button
          variant="secondary" size="sm"
          onClick={() => onDelete(section)}
          className="text-[var(--red)] border-[var(--red)]/30 hover:bg-[var(--red)]/5"
        >
          <Trash2 size={13} />
        </Button>
      </div>
    </div>
  );
}

// ─── Legal page card ─────────────────────────────────────────────────────────

function LegalPageCard({
  page, type, onEdit,
}: {
  page: LegalPage; type: 'legal' | 'static'; onEdit: (p: LegalPage, t: 'legal' | 'static') => void;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-surface-2/40 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[16px] font-[500] text-text">{page.title}</p>
          <Badge color="muted" size="sm">/{page.slug}</Badge>
          <Badge color={page.isVisible ? 'green' : 'muted'} size="sm" dot>
            {page.isVisible ? 'Visible' : 'Hidden'}
          </Badge>
        </div>
        <p className="text-[13px] text-text-3 mt-0.5">
          Updated {new Date(page.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={() => onEdit(page, type)}>
        <Edit2 size={13} className="mr-1" />
        Edit
      </Button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminContentPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>('homepage');

  // Section modals
  const [editSection, setEditSection] = useState<Section | null>(null);
  const [deleteSection, setDeleteSection] = useState<Section | null>(null);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [sectionForm, setSectionForm] = useState({ key: '', title: '', content: '', order: '0' });
  const [editForm, setEditForm] = useState({ title: '', content: '', order: '0', isVisible: true });

  // Legal page modals
  const [editLegal, setEditLegal] = useState<{ page: LegalPage; type: 'legal' | 'static' } | null>(null);
  const [addLegalOpen, setAddLegalOpen] = useState(false);
  const [legalForm, setLegalForm] = useState({ slug: '', title: '', content: '', type: 'legal' as 'legal' | 'static' });
  const [editLegalForm, setEditLegalForm] = useState({ title: '', content: '', isVisible: true });

  // ─── Queries ────────────────────────────────────────────────────────────────

  const { data: sections = [], isLoading: sectionsLoading } = useQuery<Section[]>({
    queryKey: ['admin-sections'],
    queryFn: async () => {
      const res = await fetch('/api/admin/content/sections');
      if (!res.ok) throw new Error('Failed to load sections');
      const d = await res.json();
      return d.sections ?? [];
    },
    enabled: tab === 'homepage',
    staleTime: 30_000,
  });

  const { data: legalPages = [], isLoading: legalLoading } = useQuery<LegalPage[]>({
    queryKey: ['admin-legal-pages'],
    queryFn: async () => {
      const res = await fetch('/api/admin/legal-pages');
      if (!res.ok) throw new Error('Failed to load legal pages');
      const d = await res.json();
      return d.pages ?? [];
    },
    enabled: tab === 'legal',
    staleTime: 30_000,
  });

  const { data: staticPages = [] } = useQuery<LegalPage[]>({
    queryKey: ['admin-static-pages'],
    queryFn: async () => {
      const res = await fetch('/api/admin/static-pages');
      if (!res.ok) return [];
      const d = await res.json();
      return d.pages ?? [];
    },
    enabled: tab === 'legal',
    staleTime: 30_000,
  });

  // ─── Section mutations ───────────────────────────────────────────────────────

  const createSection = useMutation({
    mutationFn: async (body: typeof sectionForm) => {
      const res = await fetch('/api/admin/content/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: body.key, title: body.title, content: body.content, order: parseInt(body.order) || 0 }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
    },
    onSuccess: () => {
      toast({ type: 'success', title: 'Section created' });
      setAddSectionOpen(false);
      setSectionForm({ key: '', title: '', content: '', order: '0' });
      qc.invalidateQueries({ queryKey: ['admin-sections'] });
    },
    onError: (e: any) => toast({ type: 'error', title: e.message }),
  });

  const updateSection = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Section> }) => {
      const res = await fetch(`/api/admin/content/sections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update section');
    },
    onSuccess: () => {
      toast({ type: 'success', title: 'Section updated' });
      setEditSection(null);
      qc.invalidateQueries({ queryKey: ['admin-sections'] });
    },
    onError: () => toast({ type: 'error', title: 'Failed to update section' }),
  });

  const deleteSecMutation = useMutation({
    mutationFn: async (id: string) => {
      // No delete endpoint for sections yet — just toggle hidden
      const res = await fetch(`/api/admin/content/sections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVisible: false }),
      });
      if (!res.ok) throw new Error('Failed');
    },
    onSuccess: () => {
      toast({ type: 'success', title: 'Section hidden' });
      setDeleteSection(null);
      qc.invalidateQueries({ queryKey: ['admin-sections'] });
    },
    onError: () => toast({ type: 'error', title: 'Failed' }),
  });

  // ─── Legal mutations ─────────────────────────────────────────────────────────

  const createLegal = useMutation({
    mutationFn: async (body: typeof legalForm) => {
      const endpoint = body.type === 'legal' ? '/api/admin/legal-pages' : '/api/admin/static-pages';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: body.slug, title: body.title, content: body.content }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
    },
    onSuccess: () => {
      toast({ type: 'success', title: 'Page created' });
      setAddLegalOpen(false);
      setLegalForm({ slug: '', title: '', content: '', type: 'legal' });
      qc.invalidateQueries({ queryKey: ['admin-legal-pages'] });
      qc.invalidateQueries({ queryKey: ['admin-static-pages'] });
    },
    onError: (e: any) => toast({ type: 'error', title: e.message }),
  });

  const updateLegal = useMutation({
    mutationFn: async ({ id, type, data }: { id: string; type: 'legal' | 'static'; data: any }) => {
      const endpoint = type === 'legal' ? `/api/admin/legal-pages/${id}` : `/api/admin/static-pages/${id}`;
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update page');
    },
    onSuccess: () => {
      toast({ type: 'success', title: 'Page updated' });
      setEditLegal(null);
      qc.invalidateQueries({ queryKey: ['admin-legal-pages'] });
      qc.invalidateQueries({ queryKey: ['admin-static-pages'] });
    },
    onError: () => toast({ type: 'error', title: 'Failed to update page' }),
  });

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const openEdit = (s: Section) => {
    setEditSection(s);
    setEditForm({ title: s.title ?? '', content: s.content ?? '', order: String(s.order), isVisible: s.isVisible });
  };

  const openEditLegal = (p: LegalPage, t: 'legal' | 'static') => {
    setEditLegal({ page: p, type: t });
    setEditLegalForm({ title: p.title, content: p.content, isVisible: p.isVisible });
  };

  const handleToggle = (s: Section) => {
    updateSection.mutate({ id: s.id, data: { isVisible: !s.isVisible } });
  };

  const handleSaveEdit = () => {
    if (!editSection) return;
    updateSection.mutate({
      id: editSection.id,
      data: { title: editForm.title, content: editForm.content, order: parseInt(editForm.order) || 0, isVisible: editForm.isVisible },
    });
  };

  const handleSaveLegal = () => {
    if (!editLegal) return;
    updateLegal.mutate({ id: editLegal.page.id, type: editLegal.type, data: editLegalForm });
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">Content Manager</h1>
          <p className="text-[17px] text-text-3 mt-0.5">Manage your homepage content, blog posts, SEO settings, and legal pages</p>
        </div>
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-1.5 text-[15px] text-accent hover:underline"
        >
          <ExternalLink size={13} />
          Preview Homepage
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-border mb-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[16px] border-b-2 transition-colors ${
              tab === id
                ? 'border-accent text-accent font-[500]'
                : 'border-transparent text-text-3 hover:text-text-2'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ─── Homepage Tab ─── */}
      {tab === 'homepage' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[15px] text-text-3">
              {sections.length} section{sections.length !== 1 ? 's' : ''} &nbsp;&middot;&nbsp;
              {sections.filter(s => s.isVisible).length} visible
            </p>
            <Button variant="accent" size="sm" onClick={() => setAddSectionOpen(true)}>
              <Plus size={13} className="mr-1.5" />
              Add Section
            </Button>
          </div>

          <Card padding="none" className="overflow-hidden">
            {sectionsLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="h-5 w-5 rounded-full border-2 border-border border-t-accent animate-spin" />
              </div>
            ) : sections.length === 0 ? (
              <div className="py-14 text-center space-y-3">
                <Globe size={32} className="mx-auto text-text-3" strokeWidth={1} />
                <p className="text-[17px] text-text-3">No homepage sections yet.</p>
                <p className="text-[15px] text-text-3 max-w-sm mx-auto">
                  Add sections like "hero", "features", "how-it-works" etc. to manage your homepage content.
                </p>
                <Button variant="accent" size="sm" onClick={() => setAddSectionOpen(true)}>
                  <Plus size={13} className="mr-1.5" />
                  Add First Section
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {sections.map(s => (
                  <SectionCard
                    key={s.id}
                    section={s}
                    onEdit={openEdit}
                    onToggle={handleToggle}
                    onDelete={setDeleteSection}
                  />
                ))}
              </div>
            )}
          </Card>

          {/* Section key guide */}
          {sections.length === 0 && (
            <Card padding="lg" className="mt-4">
              <p className="label mb-3">Suggested section keys</p>
              <div className="flex flex-wrap gap-2">
                {SECTION_KEYS.map(k => (
                  <button
                    key={k}
                    onClick={() => { setAddSectionOpen(true); setSectionForm(f => ({ ...f, key: k })); }}
                    className="px-2.5 py-1 rounded border border-border text-[15px] text-text-3 hover:text-text hover:bg-surface-2 transition-colors"
                  >
                    {k}
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ─── SEO Tab ─── */}
      {tab === 'seo' && (
        <div className="grid md:grid-cols-3 gap-4">
          <Card padding="lg" className="col-span-2">
            <p className="label mb-2">SEO & GEO settings</p>
            <p className="text-[15px] text-text-3 mb-4">
              Manage sitemap, meta tags, Google Search Console integration, and geo-targeted content.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="accent" size="sm" href="/admin/seo">
                Open SEO settings
              </Button>
            </div>
          </Card>
          <Card padding="lg">
            <p className="label mb-2">Quick links</p>
            <div className="space-y-2 mt-3">
              {[
                { href: '/admin/seo', label: 'SEO settings' },
                { href: '/sitemap.xml', label: 'Sitemap', external: true },
                { href: '/robots.txt', label: 'Robots.txt', external: true },
              ].map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  target={item.external ? '_blank' : undefined}
                  className="flex items-center justify-between px-3 py-2 rounded border border-border hover:bg-surface-2 transition-colors text-[15px] text-text-2"
                >
                  {item.label}
                  <ExternalLink size={12} className="text-text-3" />
                </Link>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ─── Legal Tab ─── */}
      {tab === 'legal' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[15px] text-text-3">
              {legalPages.length + staticPages.length} pages total
            </p>
            <Button variant="accent" size="sm" onClick={() => setAddLegalOpen(true)}>
              <Plus size={13} className="mr-1.5" />
              New page
            </Button>
          </div>

          {/* Legal pages */}
          {legalPages.length > 0 && (
            <Card padding="none" className="overflow-hidden mb-4">
              <div className="px-4 py-2.5 border-b border-border bg-surface-2">
                <p className="text-[13px] font-[500] text-text-3 uppercase tracking-wide">Legal pages</p>
              </div>
              <div className="divide-y divide-border">
                {legalPages.map(p => (
                  <LegalPageCard key={p.id} page={p} type="legal" onEdit={openEditLegal} />
                ))}
              </div>
            </Card>
          )}

          {/* Static pages */}
          {staticPages.length > 0 && (
            <Card padding="none" className="overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-surface-2">
                <p className="text-[13px] font-[500] text-text-3 uppercase tracking-wide">Static pages</p>
              </div>
              <div className="divide-y divide-border">
                {staticPages.map(p => (
                  <LegalPageCard key={p.id} page={p} type="static" onEdit={openEditLegal} />
                ))}
              </div>
            </Card>
          )}

          {legalLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-5 w-5 rounded-full border-2 border-border border-t-accent animate-spin" />
            </div>
          ) : legalPages.length === 0 && staticPages.length === 0 ? (
            <Card padding="lg">
              <div className="text-center py-8 space-y-3">
                <Scale size={32} className="mx-auto text-text-3" strokeWidth={1} />
                <p className="text-[17px] text-text-3">No legal pages yet.</p>
                <Button variant="accent" size="sm" onClick={() => setAddLegalOpen(true)}>
                  <Plus size={13} className="mr-1.5" />
                  Create first page
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
      )}

      {/* ─── Add Section Modal ─────────────────────────────────────────────────── */}
      <Modal open={addSectionOpen} onClose={() => setAddSectionOpen(false)} title="Add Homepage Section">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Section key *</label>
              <Input
                value={sectionForm.key}
                onChange={e => setSectionForm(f => ({ ...f, key: e.target.value }))}
                placeholder="e.g. hero, features"
              />
              <p className="text-[13px] text-text-3 mt-1">Lowercase, use hyphens</p>
            </div>
            <div>
              <label className={labelCls}>Order</label>
              <Input
                type="number"
                value={sectionForm.order}
                onChange={e => setSectionForm(f => ({ ...f, order: e.target.value }))}
                min="0"
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Title</label>
            <Input
              value={sectionForm.title}
              onChange={e => setSectionForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Welcome to ArguFight"
            />
          </div>
          <div>
            <label className={labelCls}>Content</label>
            <textarea
              value={sectionForm.content}
              onChange={e => setSectionForm(f => ({ ...f, content: e.target.value }))}
              rows={5}
              placeholder="Section body text or HTML content..."
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-[var(--radius)] text-[15px] text-text focus:outline-none focus:border-border-2 resize-y"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setAddSectionOpen(false)} disabled={createSection.isPending}>Cancel</Button>
            <Button variant="accent" size="sm" onClick={() => createSection.mutate(sectionForm)} loading={createSection.isPending}>Create Section</Button>
          </div>
        </div>
      </Modal>

      {/* ─── Edit Section Modal ────────────────────────────────────────────────── */}
      <Modal open={!!editSection} onClose={() => setEditSection(null)} title={`Edit — ${editSection?.key}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Title</label>
              <Input
                value={editForm.title}
                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Section title"
              />
            </div>
            <div>
              <label className={labelCls}>Order</label>
              <Input
                type="number"
                value={editForm.order}
                onChange={e => setEditForm(f => ({ ...f, order: e.target.value }))}
                min="0"
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Content</label>
            <textarea
              value={editForm.content}
              onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
              rows={8}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-[var(--radius)] text-[15px] text-text focus:outline-none focus:border-border-2 resize-y"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEditForm(f => ({ ...f, isVisible: !f.isVisible }))}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${editForm.isVisible ? 'bg-accent' : 'bg-surface-2 border border-border'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${editForm.isVisible ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
            <label className="text-[15px] text-text-2">Visible on homepage</label>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setEditSection(null)} disabled={updateSection.isPending}>Cancel</Button>
            <Button variant="accent" size="sm" onClick={handleSaveEdit} loading={updateSection.isPending}>Save changes</Button>
          </div>
        </div>
      </Modal>

      {/* ─── Delete Section Modal ──────────────────────────────────────────────── */}
      <Modal open={!!deleteSection} onClose={() => setDeleteSection(null)} title="Hide Section">
        <div className="space-y-4">
          <p className="text-[17px] text-text-2">
            Hide the <span className="text-text font-[500]">"{deleteSection?.title || deleteSection?.key}"</span> section from the homepage?
          </p>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setDeleteSection(null)}>Cancel</Button>
            <Button
              variant="secondary" size="sm"
              onClick={() => deleteSection && deleteSecMutation.mutate(deleteSection.id)}
              loading={deleteSecMutation.isPending}
              className="text-[var(--red)] border-[var(--red)]/30"
            >
              Hide Section
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Add Legal Page Modal ──────────────────────────────────────────────── */}
      <Modal open={addLegalOpen} onClose={() => setAddLegalOpen(false)} title="Create Page">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Slug *</label>
              <Input
                value={legalForm.slug}
                onChange={e => setLegalForm(f => ({ ...f, slug: e.target.value }))}
                placeholder="e.g. privacy-policy"
              />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select
                value={legalForm.type}
                onChange={e => setLegalForm(f => ({ ...f, type: e.target.value as 'legal' | 'static' }))}
                className={inputCls}
              >
                <option value="legal">Legal page</option>
                <option value="static">Static page</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Title *</label>
            <Input
              value={legalForm.title}
              onChange={e => setLegalForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Privacy Policy"
            />
          </div>
          <div>
            <label className={labelCls}>Content *</label>
            <textarea
              value={legalForm.content}
              onChange={e => setLegalForm(f => ({ ...f, content: e.target.value }))}
              rows={6}
              placeholder="Page content (text or HTML)..."
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-[var(--radius)] text-[15px] text-text focus:outline-none focus:border-border-2 resize-y"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setAddLegalOpen(false)} disabled={createLegal.isPending}>Cancel</Button>
            <Button variant="accent" size="sm" onClick={() => createLegal.mutate(legalForm)} loading={createLegal.isPending}>Create Page</Button>
          </div>
        </div>
      </Modal>

      {/* ─── Edit Legal Page Modal ─────────────────────────────────────────────── */}
      <Modal open={!!editLegal} onClose={() => setEditLegal(null)} title={`Edit — ${editLegal?.page.title}`}>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Title</label>
            <Input
              value={editLegalForm.title}
              onChange={e => setEditLegalForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelCls}>Content</label>
            <textarea
              value={editLegalForm.content}
              onChange={e => setEditLegalForm(f => ({ ...f, content: e.target.value }))}
              rows={10}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-[var(--radius)] text-[15px] text-text focus:outline-none focus:border-border-2 resize-y"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEditLegalForm(f => ({ ...f, isVisible: !f.isVisible }))}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${editLegalForm.isVisible ? 'bg-accent' : 'bg-surface-2 border border-border'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${editLegalForm.isVisible ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
            <label className="text-[15px] text-text-2">Page visible</label>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setEditLegal(null)} disabled={updateLegal.isPending}>Cancel</Button>
            <Button variant="accent" size="sm" onClick={handleSaveLegal} loading={updateLegal.isPending}>Save changes</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
