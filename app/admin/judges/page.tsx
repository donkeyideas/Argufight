'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { AdminStatCard } from '@/components/features/admin/admin-stat-card';
import { Plus, Trash2, Database, Bot, Pencil, Upload, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

/* ── Types ─────────────────────────────────────────────── */

interface Judge {
  id: string;
  name: string;
  emoji: string;
  personality: string;
  description: string;
  systemPrompt: string;
  avatarUrl: string | null;
  debatesJudged: number;
}

interface VerdictDetail {
  id: string;
  decision: string;
  challengerScore: number | null;
  opponentScore: number | null;
  createdAt: string;
  debate: {
    id: string;
    topic: string;
    category: string;
    status: string;
    challenger: { username: string };
    opponent: { username: string } | null;
  };
}

interface JudgeDetail extends Judge {
  verdicts: VerdictDetail[];
  _count: { verdicts: number };
}

/* ── Style constants ───────────────────────────────────── */

const labelCls = 'block text-[14px] font-[500] text-text-2 mb-1.5';
const hintCls  = 'text-[13px] text-text-3 mt-1';

/* ── Page ──────────────────────────────────────────────── */

export default function AdminJudgesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* List state */
  const [addOpen, setAddOpen]             = useState(false);
  const [deleteJudge, setDeleteJudge]     = useState<Judge | null>(null);
  const [seedConfirmOpen, setSeedConfirmOpen] = useState(false);
  const [form, setForm] = useState({ name: '', personality: '', description: '', systemPrompt: '' });

  /* Detail modal state */
  const [selectedJudgeId, setSelectedJudgeId] = useState<string | null>(null);
  const [editMode, setEditMode]               = useState(false);
  const [editForm, setEditForm]               = useState({ name: '', personality: '', description: '', systemPrompt: '', avatarUrl: '' });
  const [imageUploading, setImageUploading]   = useState(false);

  /* ── Queries ───────────────────────────────────────── */

  const { data: judges = [], isLoading } = useQuery<Judge[]>({
    queryKey: ['admin-judges'],
    queryFn: async () => {
      const res = await fetch('/api/admin/judges');
      if (!res.ok) throw new Error('Failed to load judges');
      const data = await res.json();
      return data.judges || [];
    },
    staleTime: 60_000,
  });

  const { data: judgeDetail, isLoading: detailLoading } = useQuery<JudgeDetail>({
    queryKey: ['admin-judge-detail', selectedJudgeId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/judges/${selectedJudgeId}`);
      if (!res.ok) throw new Error('Failed to load judge');
      const data = await res.json();
      return data.judge;
    },
    enabled: !!selectedJudgeId,
    staleTime: 30_000,
  });

  const totalJudged = judges.reduce((sum, j) => sum + (j.debatesJudged ?? 0), 0);
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-judges'] });
    if (selectedJudgeId) queryClient.invalidateQueries({ queryKey: ['admin-judge-detail', selectedJudgeId] });
  };

  /* ── Mutations ─────────────────────────────────────── */

  const addMutation = useMutation({
    mutationFn: async (body: typeof form) => {
      const res = await fetch('/api/admin/judges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create judge');
    },
    onSuccess: () => {
      toast({ type: 'success', title: 'Judge created' });
      setAddOpen(false);
      setForm({ name: '', personality: '', description: '', systemPrompt: '' });
      invalidate();
    },
    onError: (e: Error) => toast({ type: 'error', title: e.message }),
  });

  const updateMutation = useMutation({
    mutationFn: async (body: typeof editForm) => {
      const res = await fetch(`/api/admin/judges/${selectedJudgeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update judge');
    },
    onSuccess: () => {
      toast({ type: 'success', title: 'Judge updated' });
      setEditMode(false);
      invalidate();
    },
    onError: (e: Error) => toast({ type: 'error', title: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (judgeId: string) => {
      const res = await fetch(`/api/admin/judges/${judgeId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete judge');
    },
    onSuccess: () => {
      toast({ type: 'success', title: 'Judge deleted' });
      setDeleteJudge(null);
      invalidate();
    },
    onError: () => toast({ type: 'error', title: 'Failed to delete judge' }),
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/seed', { method: 'POST' });
      if (!res.ok) throw new Error('Seeding failed');
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        type: 'success',
        title: 'Database seeded',
        description: `${data.results?.judges ?? 0} judges, ${data.results?.categories ?? 0} categories seeded`,
      });
      setSeedConfirmOpen(false);
      invalidate();
    },
    onError: () => toast({ type: 'error', title: 'Seeding failed' }),
  });

  /* ── Handlers ──────────────────────────────────────── */

  const handleAdd = () => {
    if (!form.name || !form.personality || !form.description || !form.systemPrompt) {
      toast({ type: 'error', title: 'All fields are required' });
      return;
    }
    addMutation.mutate(form);
  };

  const openDetail = (judge: Judge) => {
    setSelectedJudgeId(judge.id);
    setEditMode(false);
    setEditForm({
      name: judge.name,
      personality: judge.personality,
      description: judge.description,
      systemPrompt: judge.systemPrompt,
      avatarUrl: judge.avatarUrl ?? '',
    });
  };

  const closeDetail = () => {
    setSelectedJudgeId(null);
    setEditMode(false);
  };

  const startEdit = () => {
    if (judgeDetail) {
      setEditForm({
        name: judgeDetail.name,
        personality: judgeDetail.personality,
        description: judgeDetail.description,
        systemPrompt: judgeDetail.systemPrompt,
        avatarUrl: judgeDetail.avatarUrl ?? '',
      });
    }
    setEditMode(true);
  };

  const handleSave = () => {
    if (!editForm.name || !editForm.personality || !editForm.description || !editForm.systemPrompt) {
      toast({ type: 'error', title: 'Name, personality, description, and system prompt are required' });
      return;
    }
    updateMutation.mutate(editForm);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/admin/judges/images', { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json()).error || 'Upload failed');
      const { url } = await res.json();
      setEditForm(p => ({ ...p, avatarUrl: url }));
    } catch (err: any) {
      toast({ type: 'error', title: err.message || 'Failed to upload image' });
    } finally {
      setImageUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /* Current detail for view mode */
  const detail = judgeDetail;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">AI Judges</h1>
          <p className="text-[15px] text-text-3 mt-0.5">Manage the AI personalities that evaluate debates</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setSeedConfirmOpen(true)}>
            <Database size={13} className="mr-1.5" />
            Seed DB
          </Button>
          <Button variant="accent" size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={13} className="mr-1.5" />
            Add Judge
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <AdminStatCard label="Total judges" value={judges.length} />
        <AdminStatCard label="Debates judged" value={totalJudged.toLocaleString()} sub="All time" />
        <AdminStatCard
          label="Avg. per judge"
          value={judges.length > 0 ? Math.round(totalJudged / judges.length).toLocaleString() : '0'}
          sub="Debates judged"
        />
      </div>

      {/* Judges list */}
      <Card padding="none">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-[15px] font-[500] text-text">All judges</p>
          <p className="text-[13px] text-text-3">{judges.length} judge{judges.length !== 1 ? 's' : ''}</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="h-6 w-6 rounded-full border-2 border-border border-t-accent animate-spin" />
          </div>
        ) : judges.length === 0 ? (
          <div className="px-4 py-12 text-center space-y-3">
            <p className="text-[15px] text-text-3">No AI judges configured.</p>
            <p className="text-[14px] text-text-3">Use &quot;Seed DB&quot; to populate with default judges, or add them manually.</p>
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setSeedConfirmOpen(true)}>
                <Database size={13} className="mr-1.5" />
                Seed Default Judges
              </Button>
              <Button variant="accent" size="sm" onClick={() => setAddOpen(true)}>
                <Plus size={13} className="mr-1.5" />
                Add Judge
              </Button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {judges.map((judge) => (
              <div
                key={judge.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-surface-2/50 transition-colors cursor-pointer"
                onClick={() => openDetail(judge)}
              >
                {/* Avatar */}
                <div className="flex-shrink-0 w-9 h-9 rounded-[var(--radius)] bg-surface-2 border border-border flex items-center justify-center overflow-hidden">
                  {judge.avatarUrl ? (
                    <Image src={judge.avatarUrl} alt={judge.name} width={36} height={36} className="w-full h-full object-cover" />
                  ) : (
                    <Bot size={16} className="text-text-3" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[15px] font-[500] text-text">{judge.name}</p>
                    <Badge color="muted" size="sm">{judge.debatesJudged} judged</Badge>
                  </div>
                  <p className="text-[13px] text-text-3 truncate">
                    {(judge.personality || judge.description || '').slice(0, 120) || 'No description'}
                  </p>
                </div>

                {/* Delete */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setDeleteJudge(judge); }}
                    className="text-[var(--red)] hover:text-[var(--red)] text-[13px]"
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Detail / Edit Modal ──────────────────────── */}
      <Modal open={!!selectedJudgeId} onClose={closeDetail} title={editMode ? 'Edit Judge' : 'Judge Details'} size="lg">
        {detailLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="h-6 w-6 rounded-full border-2 border-border border-t-accent animate-spin" />
          </div>
        ) : detail ? (
          <div className="space-y-5">
            {/* Image + header info */}
            <div className="flex items-start gap-4">
              {/* Avatar area */}
              {editMode ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0 w-16 h-16 rounded-[var(--radius)] bg-surface-2 border border-dashed border-border-2 flex items-center justify-center overflow-hidden hover:border-accent transition-colors cursor-pointer relative group"
                  disabled={imageUploading}
                >
                  {imageUploading ? (
                    <div className="h-5 w-5 rounded-full border-2 border-border border-t-accent animate-spin" />
                  ) : editForm.avatarUrl ? (
                    <>
                      <Image src={editForm.avatarUrl} alt="Judge" width={64} height={64} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Upload size={16} className="text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <Upload size={14} className="text-text-3" />
                      <span className="text-[10px] text-text-3">Upload</span>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </button>
              ) : (
                <div className="flex-shrink-0 w-16 h-16 rounded-[var(--radius)] bg-surface-2 border border-border flex items-center justify-center overflow-hidden">
                  {detail.avatarUrl ? (
                    <Image src={detail.avatarUrl} alt={detail.name} width={64} height={64} className="w-full h-full object-cover" />
                  ) : (
                    <Bot size={24} className="text-text-3" />
                  )}
                </div>
              )}

              {/* Name + personality */}
              <div className="flex-1 min-w-0">
                {editMode ? (
                  <>
                    <div className="mb-2">
                      <label className={labelCls}>Name *</label>
                      <Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} placeholder="Judge name" />
                    </div>
                    <div>
                      <label className={labelCls}>Personality *</label>
                      <Input value={editForm.personality} onChange={e => setEditForm(p => ({ ...p, personality: e.target.value }))} placeholder="e.g. Strict, logic-focused" />
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-[16px] font-[600] text-text">{detail.name}</h3>
                    <p className="text-[13px] text-text-3 mt-0.5">{detail.personality}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <Badge color="muted" size="sm">{detail._count.verdicts} verdicts</Badge>
                      <span className="text-[12px] text-text-3">{detail.debatesJudged} debates judged</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className={labelCls}>Description</label>
              {editMode ? (
                <Textarea value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Brief description" />
              ) : (
                <p className="text-[13px] text-text-2 leading-relaxed">{detail.description}</p>
              )}
            </div>

            {/* System Prompt */}
            <div>
              <label className={labelCls}>System Prompt</label>
              {editMode ? (
                <>
                  <Textarea value={editForm.systemPrompt} onChange={e => setEditForm(p => ({ ...p, systemPrompt: e.target.value }))} rows={6} placeholder="System prompt..." />
                  <p className={hintCls}>The AI instruction that shapes how this judge evaluates debates.</p>
                </>
              ) : (
                <div className="bg-surface-2 border border-border rounded-[var(--radius)] p-3 max-h-40 overflow-y-auto">
                  <pre className="text-[12px] text-text-2 whitespace-pre-wrap font-mono leading-relaxed">{detail.systemPrompt}</pre>
                </div>
              )}
            </div>

            {/* Recent Verdicts — view mode only */}
            {!editMode && detail.verdicts.length > 0 && (
              <div>
                <label className={labelCls}>Recent Verdicts</label>
                <div className="divide-y divide-border border border-border rounded-[var(--radius)] overflow-hidden">
                  {detail.verdicts.map((v) => (
                    <Link
                      key={v.id}
                      href={`/debate/${v.debate.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-text truncate">{v.debate.topic}</p>
                        <p className="text-[11px] text-text-3 mt-0.5">
                          {v.debate.challenger.username} vs {v.debate.opponent?.username ?? 'Open'}
                        </p>
                      </div>
                      <Badge color={v.decision === 'CHALLENGER_WINS' || v.decision === 'OPPONENT_WINS' ? 'green' : 'muted'} size="sm">
                        {v.decision.replace(/_/g, ' ').toLowerCase()}
                      </Badge>
                      {v.challengerScore != null && v.opponentScore != null && (
                        <span className="text-[11px] text-text-3 flex-shrink-0">
                          {v.challengerScore}–{v.opponentScore}
                        </span>
                      )}
                      <ExternalLink size={11} className="text-text-3 flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              {editMode ? (
                <>
                  <Button variant="secondary" size="sm" onClick={() => setEditMode(false)} disabled={updateMutation.isPending}>Cancel</Button>
                  <Button variant="accent" size="sm" onClick={handleSave} loading={updateMutation.isPending}>Save Changes</Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" size="sm" onClick={closeDetail}>Close</Button>
                  <Button variant="accent" size="sm" onClick={startEdit}>
                    <Pencil size={12} className="mr-1.5" />
                    Edit
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ── Add Judge Modal ──────────────────────────── */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add AI Judge">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Name *</label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. The Strict Judge" />
          </div>
          <div>
            <label className={labelCls}>Personality *</label>
            <Input value={form.personality} onChange={e => setForm(p => ({ ...p, personality: e.target.value }))} placeholder="e.g. Strict, logic-focused" />
          </div>
          <div>
            <label className={labelCls}>Description *</label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Brief description shown to users" />
          </div>
          <div>
            <label className={labelCls}>System Prompt *</label>
            <Textarea value={form.systemPrompt} onChange={e => setForm(p => ({ ...p, systemPrompt: e.target.value }))} rows={6} placeholder="Full system prompt for this judge personality..." />
            <p className={hintCls}>This is the AI instruction that shapes how this judge evaluates debates.</p>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setAddOpen(false)} disabled={addMutation.isPending}>Cancel</Button>
            <Button variant="accent" size="sm" onClick={handleAdd} loading={addMutation.isPending}>Create Judge</Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Modal ─────────────────────────────── */}
      <Modal open={!!deleteJudge} onClose={() => setDeleteJudge(null)} title="Delete Judge">
        <div className="space-y-4">
          <p className="text-[15px] text-text-2">
            Delete <span className="text-text font-[500]">{deleteJudge?.name}</span>? This cannot be undone. Existing verdicts issued by this judge will remain.
          </p>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setDeleteJudge(null)} disabled={deleteMutation.isPending}>Cancel</Button>
            <Button
              variant="secondary" size="sm"
              onClick={() => deleteJudge && deleteMutation.mutate(deleteJudge.id)}
              loading={deleteMutation.isPending}
              className="text-[var(--red)] border-[var(--red)]/30"
            >
              Delete Judge
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Seed DB Modal ────────────────────────────── */}
      <Modal open={seedConfirmOpen} onClose={() => setSeedConfirmOpen(false)} title="Seed Database">
        <div className="space-y-4">
          <p className="text-[15px] text-text-2">
            This will populate the database with default data including AI judges, debate categories, homepage sections, and legal pages. Existing records will not be duplicated.
          </p>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setSeedConfirmOpen(false)} disabled={seedMutation.isPending}>Cancel</Button>
            <Button variant="accent" size="sm" onClick={() => seedMutation.mutate()} loading={seedMutation.isPending}>
              Seed Database
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
