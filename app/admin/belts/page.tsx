'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { AdminStatCard } from '@/components/features/admin/admin-stat-card';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import Image from 'next/image';

type BeltStatus = 'ACTIVE' | 'INACTIVE' | 'VACANT' | 'STAKED' | 'GRACE_PERIOD' | 'MANDATORY';
type BeltType   = 'ROOKIE' | 'CATEGORY' | 'CHAMPIONSHIP' | 'UNDEFEATED' | 'TOURNAMENT';

interface Belt {
  id: string;
  name: string;
  type: BeltType;
  status: BeltStatus;
  category: string | null;
  designImageUrl: string | null;
  coinValue: number;
  acquiredAt: string | null;
  lastDefendedAt: string | null;
  timesDefended: number;
  successfulDefenses: number;
  isStaked: boolean;
  createdAt: string;
  currentHolder?: { id: string; username: string; avatarUrl: string | null } | null;
}

function statusColor(s: BeltStatus): 'green' | 'amber' | 'muted' | 'blue' | 'red' {
  if (s === 'ACTIVE')       return 'green';
  if (s === 'STAKED')       return 'blue';
  if (s === 'GRACE_PERIOD') return 'amber';
  if (s === 'MANDATORY')    return 'red';
  return 'muted'; // INACTIVE, VACANT
}

function statusLabel(s: BeltStatus): string {
  if (s === 'GRACE_PERIOD') return 'Grace';
  if (s === 'MANDATORY')    return 'Mandatory';
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function typeColor(t: BeltType): 'green' | 'blue' | 'amber' | 'accent' | 'muted' {
  if (t === 'ROOKIE')      return 'amber';
  if (t === 'CATEGORY')    return 'green';
  if (t === 'CHAMPIONSHIP')return 'blue';
  if (t === 'UNDEFEATED')  return 'accent';
  return 'muted';
}

function AvatarInitial({ username, avatarUrl }: { username: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={username}
        width={24}
        height={24}
        className="w-6 h-6 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  return (
    <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[13px] font-[600] flex-shrink-0 uppercase">
      {username.charAt(0)}
    </span>
  );
}

const labelCls = 'block text-[16px] font-[500] text-text-2 mb-1.5';
const selectCls = 'w-full h-9 px-3 bg-surface-2 border border-border rounded-[var(--radius)] text-[17px] text-text focus:outline-none focus:border-border-2';

const CATEGORIES = ['SPORTS', 'POLITICS', 'TECH', 'ENTERTAINMENT', 'SCIENCE', 'MUSIC', 'OTHER'];
const BELT_TYPES: BeltType[] = ['ROOKIE', 'CATEGORY', 'CHAMPIONSHIP', 'UNDEFEATED', 'TOURNAMENT'];

export default function AdminBeltsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Belt | null>(null);
  const [filterCat, setFilterCat]     = useState<string>('');
  const [form, setForm] = useState({
    name: '', type: 'CATEGORY' as BeltType, category: 'SPORTS',
    coinValue: '0', designImageUrl: '',
  });

  const { data: belts = [], isLoading, refetch } = useQuery<Belt[]>({
    queryKey: ['admin-belts'],
    queryFn: async () => {
      const res = await fetch('/api/admin/belts');
      if (!res.ok) throw new Error('Failed to load belts');
      const data = await res.json();
      return data.belts ?? [];
    },
    staleTime: 30_000,
  });

  const visible = filterCat ? belts.filter(b => b.category === filterCat) : belts;

  const totalCount  = belts.length;
  const activeCount = belts.filter(b => b.status === 'ACTIVE').length;
  const vacantCount = belts.filter(b => b.status === 'VACANT').length;
  const stakedCount = belts.filter(b => b.isStaked).length;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-belts'] });

  const createMutation = useMutation({
    mutationFn: async (body: typeof form) => {
      const res = await fetch('/api/admin/belts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: body.name,
          type: body.type,
          category: body.category || null,
          coinValue: parseInt(body.coinValue) || 0,
          designImageUrl: body.designImageUrl || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to create belt');
      }
    },
    onSuccess: () => {
      toast({ type: 'success', title: 'Belt created' });
      setCreateOpen(false);
      setForm({ name: '', type: 'CATEGORY', category: 'SPORTS', coinValue: '0', designImageUrl: '' });
      invalidate();
    },
    onError: (e: any) => toast({ type: 'error', title: e.message || 'Failed to create belt' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/belts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete belt');
    },
    onSuccess: () => {
      toast({ type: 'success', title: 'Belt deleted' });
      setDeleteTarget(null);
      invalidate();
    },
    onError: () => toast({ type: 'error', title: 'Failed to delete belt' }),
  });

  const handleCreate = () => {
    if (!form.name.trim()) { toast({ type: 'error', title: 'Belt name is required' }); return; }
    createMutation.mutate(form);
  };

  // Unique categories for filter chips
  const cats = [...new Set(belts.map(b => b.category).filter(Boolean))] as string[];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">Championship Belts</h1>
          <p className="text-[17px] text-text-3 mt-0.5">{totalCount} belt{totalCount !== 1 ? 's' : ''} in the system</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            <RefreshCw size={13} className="mr-1.5" />
            Refresh
          </Button>
          <Button variant="accent" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={13} className="mr-1.5" />
            Create Belt
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AdminStatCard label="Total belts"   value={totalCount} />
        <AdminStatCard label="Active"        value={activeCount} sub="Currently held"      accent={activeCount > 0} />
        <AdminStatCard label="Vacant"        value={vacantCount} sub={vacantCount > 0 ? 'Unclaimed' : 'All held'} />
        <AdminStatCard label="Staked"        value={stakedCount} sub={stakedCount > 0 ? 'In active debate' : 'None'} accent={stakedCount > 0} />
      </div>

      {/* Filter chips */}
      {cats.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterCat('')}
            className={`px-3 py-1 rounded-full text-[15px] border transition-colors ${
              filterCat === '' ? 'bg-accent/10 border-accent text-accent font-[500]' : 'border-border text-text-3 hover:text-text hover:bg-surface-2'
            }`}
          >
            All belts ({totalCount})
          </button>
          {cats.map(c => (
            <button
              key={c}
              onClick={() => setFilterCat(filterCat === c ? '' : c)}
              className={`px-3 py-1 rounded-full text-[15px] border transition-colors ${
                filterCat === c ? 'bg-accent/10 border-accent text-accent font-[500]' : 'border-border text-text-3 hover:text-text hover:bg-surface-2'
              }`}
            >
              {c.charAt(0) + c.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      )}

      {/* Belt list */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-[17px] font-[500] text-text">
            All Belts {filterCat ? `— ${filterCat.charAt(0) + filterCat.slice(1).toLowerCase()}` : `(${totalCount})`}
          </p>
          <p className="text-[15px] text-text-3">Most recent first</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="h-6 w-6 rounded-full border-2 border-border border-t-accent animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <div className="px-4 py-14 text-center space-y-3">
            <p className="text-[17px] text-text-3">No championship belts created yet.</p>
            <Button variant="accent" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={13} className="mr-1.5" />
              Create First Belt
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visible.map(belt => (
              <div key={belt.id} className="flex items-center gap-4 px-4 py-4 hover:bg-surface-2/50 transition-colors">

                {/* Belt image */}
                <div className="w-[72px] h-[72px] flex-shrink-0 rounded bg-surface-2 border border-border overflow-hidden flex items-center justify-center">
                  {belt.designImageUrl ? (
                    <Image src={belt.designImageUrl} alt={belt.name} width={72} height={72} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[28px]">🏆</span>
                  )}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <p className="text-[17px] font-[600] text-text">{belt.name}</p>
                    <Badge color={typeColor(belt.type)} size="sm">{belt.type}</Badge>
                    <Badge color={statusColor(belt.status)} size="sm" dot>{statusLabel(belt.status)}</Badge>
                    {belt.category && (
                      <Badge color="muted" size="sm">{belt.category}</Badge>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 mt-2">
                    <div>
                      <p className="text-[13px] text-text-3 uppercase tracking-wide">Current Holder</p>
                      {belt.currentHolder ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <AvatarInitial username={belt.currentHolder.username} avatarUrl={belt.currentHolder.avatarUrl} />
                          <p className="text-[15px] text-text font-[450]">{belt.currentHolder.username}</p>
                        </div>
                      ) : (
                        <p className="text-[15px] text-text-3 mt-0.5">Vacant</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[13px] text-text-3 uppercase tracking-wide">Defenses</p>
                      <p className="text-[15px] text-text mt-0.5">
                        {belt.successfulDefenses} / {belt.timesDefended}
                      </p>
                    </div>
                    <div>
                      <p className="text-[13px] text-text-3 uppercase tracking-wide">Coin Value</p>
                      <p className="text-[15px] text-text mt-0.5">{belt.coinValue.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[13px] text-text-3 uppercase tracking-wide">Last Defended</p>
                      <p className="text-[15px] text-text mt-0.5">
                        {belt.lastDefendedAt
                          ? new Date(belt.lastDefendedAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
                          : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button variant="secondary" size="sm" href={`/admin/belts/${belt.id}`}>
                    View Details
                  </Button>
                  <Button
                    variant="secondary" size="sm"
                    onClick={() => setDeleteTarget(belt)}
                    className="text-[var(--red)] border-[var(--red)]/30 hover:bg-[var(--red)]/5"
                  >
                    <Trash2 size={13} className="mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Championship Belt">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Belt Name *</label>
            <Input
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Science Championship Belt"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Type</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as BeltType }))} className={selectCls}>
                {BELT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className={selectCls}>
                <option value="">No category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Coin Value</label>
            <Input type="number" value={form.coinValue} onChange={e => setForm(p => ({ ...p, coinValue: e.target.value }))} min="0" />
          </div>
          <div>
            <label className={labelCls}>Belt Image URL <span className="text-text-3 font-[400]">(optional)</span></label>
            <Input
              value={form.designImageUrl}
              onChange={e => setForm(p => ({ ...p, designImageUrl: e.target.value }))}
              placeholder="https://..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setCreateOpen(false)} disabled={createMutation.isPending}>Cancel</Button>
            <Button variant="accent" size="sm" onClick={handleCreate} loading={createMutation.isPending}>Create Belt</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Belt">
        <div className="space-y-4">
          <p className="text-[17px] text-text-2">
            Delete <span className="text-text font-[500]">"{deleteTarget?.name}"</span>?
            {deleteTarget?.currentHolder && (
              <span className="text-[var(--amber)]"> This belt is currently held by {deleteTarget.currentHolder.username}.</span>
            )}{' '}
            This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>Cancel</Button>
            <Button
              variant="secondary" size="sm"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              loading={deleteMutation.isPending}
              className="text-[var(--red)] border-[var(--red)]/30"
            >
              Delete Belt
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
