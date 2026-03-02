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
import { Trash2 } from 'lucide-react';

type TournamentStatus = 'UPCOMING' | 'REGISTRATION_OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type BadgeColor = 'muted' | 'green' | 'blue' | 'amber' | 'red';

const statusColors: Record<TournamentStatus, BadgeColor> = {
  UPCOMING:          'blue',
  REGISTRATION_OPEN: 'amber',
  IN_PROGRESS:       'green',
  COMPLETED:         'muted',
  CANCELLED:         'red',
};

const statusLabels: Record<TournamentStatus, string> = {
  UPCOMING:          'Upcoming',
  REGISTRATION_OPEN: 'Registration Open',
  IN_PROGRESS:       'In Progress',
  COMPLETED:         'Completed',
  CANCELLED:         'Cancelled',
};

interface Tournament {
  id: string;
  name: string;
  description: string | null;
  status: string;
  maxParticipants?: number | null;
  currentRound: number;
  totalRounds: number;
  participantCount: number;
  format?: string | null;
  startDate?: string | null;
  createdAt: string;
  creator?: { username: string } | null;
}

export default function AdminTournamentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<Tournament | null>(null);
  const [freeLimitValue, setFreeLimitValue] = useState('');

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) return {};
      const data = await res.json();
      if (data.FREE_TOURNAMENT_LIMIT) setFreeLimitValue(data.FREE_TOURNAMENT_LIMIT);
      return data;
    },
    staleTime: 60_000,
  });

  const isEnabled = settings?.TOURNAMENTS_ENABLED === 'true';

  const { data: tournaments = [], isLoading } = useQuery<Tournament[]>({
    queryKey: ['admin-tournaments'],
    queryFn: async () => {
      const res = await fetch('/api/admin/tournaments');
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.tournaments || []);
    },
    staleTime: 60_000,
  });

  const total     = tournaments.length;
  const active    = tournaments.filter(t => t.status === 'IN_PROGRESS').length;
  const upcoming  = tournaments.filter(t => ['UPCOMING', 'REGISTRATION_OPEN'].includes(t.status)).length;
  const completed = tournaments.filter(t => t.status === 'COMPLETED').length;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-tournaments'] });
    queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
  };

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ TOURNAMENTS_ENABLED: enabled.toString() }),
      });
      if (!res.ok) throw new Error('Failed to update');
    },
    onSuccess: () => { toast({ type: 'success', title: `Tournaments ${isEnabled ? 'disabled' : 'enabled'}` }); invalidate(); },
    onError: () => toast({ type: 'error', title: 'Failed to update feature status' }),
  });

  const saveLimitMutation = useMutation({
    mutationFn: async (limit: string) => {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ FREE_TOURNAMENT_LIMIT: limit }),
      });
      if (!res.ok) throw new Error('Failed to save');
    },
    onSuccess: () => { toast({ type: 'success', title: 'Free limit updated' }); invalidate(); },
    onError: () => toast({ type: 'error', title: 'Failed to update limit' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/tournaments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      toast({ type: 'success', title: 'Tournament deleted' });
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin-tournaments'] });
    },
    onError: () => toast({ type: 'error', title: 'Failed to delete tournament' }),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">Tournaments</h1>
          <p className="text-[17px] text-text-3 mt-0.5">{total.toLocaleString()} total tournaments</p>
        </div>
      </div>

      {/* Feature toggle + free limit */}
      <Card padding="md">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[17px] font-[500] text-text">Tournament Feature</p>
            <p className="text-[16px] text-text-3 mt-0.5">Enable or disable the tournaments system platform-wide</p>
          </div>
          <button
            onClick={() => toggleMutation.mutate(!isEnabled)}
            disabled={toggleMutation.isPending}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${isEnabled ? 'bg-accent' : 'bg-surface-3'}`}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
          <p className="text-[16px] text-text-2">Free tournament limit per user per month:</p>
          <Input
            type="number"
            value={freeLimitValue}
            onChange={e => setFreeLimitValue(e.target.value)}
            className="w-20 h-7 text-[16px]"
            min="0"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => saveLimitMutation.mutate(freeLimitValue)}
            loading={saveLimitMutation.isPending}
          >
            Save
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AdminStatCard label="Total" value={total.toLocaleString()} />
        <AdminStatCard label="Active" value={active} accent={active > 0} />
        <AdminStatCard label="Upcoming" value={upcoming} />
        <AdminStatCard label="Completed" value={completed.toLocaleString()} />
      </div>

      {/* Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="grid grid-cols-[3fr_2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2.5 border-b border-border bg-surface-2">
          {['Name', 'Creator', 'Status', 'Participants', 'Start Date', 'Format', ''].map(h => (
            <p key={h} className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">{h}</p>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="h-6 w-6 rounded-full border-2 border-border border-t-accent animate-spin" />
          </div>
        ) : tournaments.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[17px] text-text-3">No tournaments found.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tournaments.map(t => {
              const status = t.status as TournamentStatus;
              return (
                <div
                  key={t.id}
                  className="grid grid-cols-[3fr_2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 items-center hover:bg-surface-2/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-[17px] text-text font-[450] truncate">{t.name}</p>
                    <p className="text-[14px] text-text-3 mt-0.5">ID: {t.id.slice(0, 8)}</p>
                  </div>
                  <p className="text-[16px] text-text-2 truncate">{t.creator?.username ?? '—'}</p>
                  <div>
                    <Badge color={statusColors[status] ?? 'muted'} size="sm" dot>
                      {statusLabels[status] ?? t.status}
                    </Badge>
                  </div>
                  <p className="text-[16px] text-text-2">
                    {t.participantCount ?? 0}
                    {t.maxParticipants ? `/${t.maxParticipants}` : ''}
                  </p>
                  <p className="text-[15px] text-text-3">
                    {t.startDate
                      ? new Date(t.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                      : '—'}
                  </p>
                  <p className="text-[16px] text-text-2">{t.format ?? '—'}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(t)}
                    className="text-[var(--red)] hover:text-[var(--red)]"
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Delete Confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Tournament">
        <div className="space-y-4">
          <p className="text-[17px] text-text-2">
            Delete <span className="text-text font-[500]">"{deleteTarget?.name}"</span>? This permanently removes all matches, rounds, and participants. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>Cancel</Button>
            <Button
              variant="secondary" size="sm"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              loading={deleteMutation.isPending}
              className="text-[var(--red)] border-[var(--red)]/30"
            >
              Delete Tournament
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
