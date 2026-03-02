'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { AdminStatCard } from '@/components/features/admin/admin-stat-card';
import { Plus, Trash2, Database, Bot } from 'lucide-react';

interface Judge {
  id: string;
  name: string;
  emoji: string;
  personality: string;
  description: string;
  systemPrompt: string;
  debatesJudged: number;
}

const labelCls = 'block text-[16px] font-[500] text-text-2 mb-1.5';
const hintCls  = 'text-[15px] text-text-3 mt-1';

export default function AdminJudgesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [addOpen, setAddOpen]     = useState(false);
  const [deleteJudge, setDeleteJudge] = useState<Judge | null>(null);
  const [seedConfirmOpen, setSeedConfirmOpen] = useState(false);
  const [form, setForm] = useState({ name: '', personality: '', description: '', systemPrompt: '' });

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

  const totalJudged = judges.reduce((sum, j) => sum + (j.debatesJudged ?? 0), 0);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-judges'] });

  const addMutation = useMutation({
    mutationFn: async (body: typeof form) => {
      const res = await fetch('/api/admin/judges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to create judge');
    },
    onSuccess: () => {
      toast({ type: 'success', title: 'Judge created' });
      setAddOpen(false);
      setForm({ name: '', personality: '', description: '', systemPrompt: '' });
      invalidate();
    },
    onError: () => toast({ type: 'error', title: 'Failed to create judge' }),
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

  const handleAdd = () => {
    if (!form.name || !form.personality || !form.description || !form.systemPrompt) {
      toast({ type: 'error', title: 'All fields are required' });
      return;
    }
    addMutation.mutate(form);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">AI Judges</h1>
          <p className="text-[17px] text-text-3 mt-0.5">Manage the AI personalities that evaluate debates</p>
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
          <p className="text-[17px] font-[500] text-text">All judges</p>
          <p className="text-[15px] text-text-3">{judges.length} judge{judges.length !== 1 ? 's' : ''}</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="h-6 w-6 rounded-full border-2 border-border border-t-accent animate-spin" />
          </div>
        ) : judges.length === 0 ? (
          <div className="px-4 py-12 text-center space-y-3">
            <p className="text-[17px] text-text-3">No AI judges configured.</p>
            <p className="text-[16px] text-text-3">Use "Seed DB" to populate with default judges, or add them manually.</p>
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
              <div key={judge.id} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-2/50 transition-colors">
                {/* Icon avatar */}
                <div className="flex-shrink-0 w-9 h-9 rounded-[var(--radius)] bg-surface-2 border border-border flex items-center justify-center text-text-3">
                  <Bot size={16} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[17px] font-[500] text-text">{judge.name}</p>
                    <Badge color="muted" size="sm">{judge.debatesJudged} judged</Badge>
                  </div>
                  <p className="text-[15px] text-text-3 truncate">
                    {(judge.personality || judge.description || '').slice(0, 120) || 'No description'}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteJudge(judge)}
                    className="text-[var(--red)] hover:text-[var(--red)] text-[15px]"
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Judge Modal */}
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

      {/* Delete Modal */}
      <Modal open={!!deleteJudge} onClose={() => setDeleteJudge(null)} title="Delete Judge">
        <div className="space-y-4">
          <p className="text-[17px] text-text-2">
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

      {/* Seed DB Confirm Modal */}
      <Modal open={seedConfirmOpen} onClose={() => setSeedConfirmOpen(false)} title="Seed Database">
        <div className="space-y-4">
          <p className="text-[17px] text-text-2">
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
