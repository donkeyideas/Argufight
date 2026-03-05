'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { ExternalLink, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';

type DebateStatus = 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'VERDICT_READY' | 'APPEALED' | 'CANCELLED';
type BadgeColor = 'muted' | 'green' | 'blue' | 'amber' | 'red';

const statusColors: Record<DebateStatus, BadgeColor> = {
  WAITING:       'muted',
  ACTIVE:        'green',
  COMPLETED:     'muted',
  VERDICT_READY: 'blue',
  APPEALED:      'amber',
  CANCELLED:     'red',
};

const statusLabel: Record<DebateStatus, string> = {
  WAITING:       'Waiting',
  ACTIVE:        'Active',
  COMPLETED:     'Completed',
  VERDICT_READY: 'Verdict Ready',
  APPEALED:      'Appealed',
  CANCELLED:     'Cancelled',
};

const STATUS_TABS = ['', 'ACTIVE', 'COMPLETED', 'VERDICT_READY', 'APPEALED', 'CANCELLED', 'WAITING'] as const;
const STATUS_TAB_LABELS: Record<string, string> = {
  '':              'All',
  ACTIVE:          'Active',
  COMPLETED:       'Completed',
  VERDICT_READY:   'Verdict Ready',
  APPEALED:        'Appealed',
  CANCELLED:       'Cancelled',
  WAITING:         'Waiting',
};

interface DebateListItem {
  id: string;
  topic: string;
  category: string;
  status: string;
  visibility: string;
  totalRounds: number;
  currentRound: number;
  speedMode: boolean;
  viewCount: number;
  createdAt: string;
  challenger: { id: string; username: string; avatarUrl: string | null };
  opponent: { id: string; username: string; avatarUrl: string | null } | null;
}

interface DebateDetail {
  id: string;
  topic: string;
  description: string | null;
  category: string;
  status: string;
  visibility: string;
  totalRounds: number;
  currentRound: number;
  speedMode: boolean;
  viewCount: number;
  spectatorCount: number;
  winnerId: string | null;
  challengerPosition: string;
  opponentPosition: string;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  challenger: { id: string; username: string; avatarUrl: string | null; eloRating: number };
  opponent: { id: string; username: string; avatarUrl: string | null; eloRating: number } | null;
  statements: { id: string; round: number; content: string; author: { id: string; username: string } }[];
  verdicts: { id: string; decision: string; reasoning: string; challengerScore: number | null; opponentScore: number | null; judge: { id: string; name: string; avatarUrl: string | null } }[];
}

export function AdminDebatesClient() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedDebateId, setSelectedDebateId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; topic: string } | null>(null);

  const { data, isLoading } = useQuery<{ debates: DebateListItem[]; pagination: { total: number } }>({
    queryKey: ['admin-debates', search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      params.set('limit', '50');
      const res = await fetch(`/api/admin/debates?${params}`);
      if (!res.ok) throw new Error('Failed to load debates');
      return res.json();
    },
    staleTime: 30_000,
  });

  const debates = data?.debates ?? [];
  const total = data?.pagination?.total ?? 0;

  const { data: debateDetail, isLoading: detailLoading } = useQuery<DebateDetail>({
    queryKey: ['admin-debate-detail', selectedDebateId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/debates/${selectedDebateId}`);
      if (!res.ok) throw new Error('Failed to load debate');
      const d = await res.json();
      return d.debate;
    },
    enabled: !!selectedDebateId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/debates/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Delete failed');
      }
    },
    onSuccess: () => {
      toast({ type: 'success', title: 'Debate deleted' });
      setDeleteTarget(null);
      setSelectedDebateId(null);
      queryClient.invalidateQueries({ queryKey: ['admin-debates'] });
    },
    onError: (err: Error) => toast({ type: 'error', title: 'Delete failed', description: err.message }),
  });

  // Group statements by round for the detail modal
  const statementsByRound = useMemo(() => {
    if (!debateDetail?.statements) return {};
    const grouped: Record<number, typeof debateDetail.statements> = {};
    for (const s of debateDetail.statements) {
      (grouped[s.round] ??= []).push(s);
    }
    return grouped;
  }, [debateDetail?.statements]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">Debates</h1>
        <p className="text-[15px] text-text-3 mt-0.5">{total.toLocaleString()} total debates</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Status tabs */}
        <div className="flex gap-1 bg-surface-2 p-1 rounded-[var(--radius)] border border-border overflow-x-auto">
          {STATUS_TABS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-[6px] text-[15px] font-[500] transition-colors whitespace-nowrap ${
                statusFilter === s ? 'bg-surface text-text border border-border' : 'text-text-3 hover:text-text-2'
              }`}
            >
              {STATUS_TAB_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search topic or username..."
            className="w-full pl-8 pr-3 h-8 bg-surface border border-border rounded-[var(--radius)] text-[16px] text-text placeholder:text-text-3 focus:outline-none focus:border-border-2"
          />
        </div>
      </div>

      {/* Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="grid grid-cols-[3fr_2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2.5 border-b border-border bg-surface-2">
          {['Topic', 'Participants', 'Status', 'Visibility', 'Created', 'Actions'].map(h => (
            <p key={h} className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">{h}</p>
          ))}
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-[var(--radius)]" />
            ))}
          </div>
        ) : debates.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[17px] text-text-3">No debates found.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {debates.map(debate => {
              const status = debate.status as DebateStatus;
              const badgeColor: BadgeColor = statusColors[status] ?? 'muted';
              const label = statusLabel[status] ?? debate.status;

              return (
                <div
                  key={debate.id}
                  onClick={() => setSelectedDebateId(debate.id)}
                  className="grid grid-cols-[3fr_2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 items-center hover:bg-surface-2/50 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-[16px] text-text line-clamp-1 font-[450]">{debate.topic}</p>
                    <p className="text-[14px] text-text-3 mt-0.5">{debate.category}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[16px] text-text truncate">
                      <span className="font-[450]">{debate.challenger.username}</span>
                      <span className="text-text-3 mx-1">vs</span>
                      <span className="font-[450]">{debate.opponent?.username ?? 'Open'}</span>
                    </p>
                  </div>

                  <div>
                    <Badge color={badgeColor} size="sm" dot>{label}</Badge>
                  </div>

                  <div>
                    <Badge color={debate.visibility === 'PUBLIC' ? 'default' : 'muted'} size="sm">
                      {debate.visibility === 'PUBLIC' ? 'Public' : debate.visibility === 'UNLISTED' ? 'Unlisted' : 'Private'}
                    </Badge>
                  </div>

                  <p className="text-[15px] text-text-3">
                    {new Date(debate.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </p>

                  <div onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedDebateId(debate.id)}>View</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {debates.length >= 50 && (
        <p className="text-[15px] text-text-3 text-center">Showing first 50 results. Use search to narrow results.</p>
      )}

      {/* Debate Detail Modal */}
      <Modal open={!!selectedDebateId} onClose={() => setSelectedDebateId(null)} title="Debate Details" size="xl">
        {detailLoading || !debateDetail ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-[var(--radius)]" />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Header */}
            <div>
              <h3 className="text-[18px] font-[600] text-text">{debateDetail.topic}</h3>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge color="muted" size="sm">{debateDetail.category}</Badge>
                <Badge color={statusColors[debateDetail.status as DebateStatus] ?? 'muted'} size="sm" dot>
                  {statusLabel[debateDetail.status as DebateStatus] ?? debateDetail.status}
                </Badge>
                <Badge color={debateDetail.visibility === 'PUBLIC' ? 'default' : 'muted'} size="sm">
                  {debateDetail.visibility}
                </Badge>
              </div>
              {debateDetail.description && (
                <p className="text-[15px] text-text-2 mt-2">{debateDetail.description}</p>
              )}
            </div>

            {/* Participants */}
            <div className="flex items-center gap-4 bg-surface-2 border border-border rounded-[var(--radius)] p-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Avatar src={debateDetail.challenger.avatarUrl} alt={debateDetail.challenger.username} fallback={debateDetail.challenger.username} size="sm" />
                <div className="min-w-0">
                  <p className="text-[16px] text-text font-[500] truncate">{debateDetail.challenger.username}</p>
                  <p className="text-[13px] text-text-3">ELO: {debateDetail.challenger.eloRating} · {debateDetail.challengerPosition}</p>
                </div>
              </div>
              <span className="text-[15px] text-text-3 font-[500]">vs</span>
              <div className="flex items-center gap-2 flex-1 min-w-0 justify-end text-right">
                {debateDetail.opponent ? (
                  <>
                    <div className="min-w-0">
                      <p className="text-[16px] text-text font-[500] truncate">{debateDetail.opponent.username}</p>
                      <p className="text-[13px] text-text-3">ELO: {debateDetail.opponent.eloRating} · {debateDetail.opponentPosition}</p>
                    </div>
                    <Avatar src={debateDetail.opponent.avatarUrl} alt={debateDetail.opponent.username} fallback={debateDetail.opponent.username} size="sm" />
                  </>
                ) : (
                  <p className="text-[15px] text-text-3">Waiting for opponent</p>
                )}
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Rounds', value: `${debateDetail.currentRound} / ${debateDetail.totalRounds}` },
                { label: 'Speed Mode', value: debateDetail.speedMode ? 'Yes' : 'No' },
                { label: 'Views', value: debateDetail.viewCount },
                { label: 'Spectators', value: debateDetail.spectatorCount },
                { label: 'Created', value: new Date(debateDetail.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
                { label: 'Started', value: debateDetail.startedAt ? new Date(debateDetail.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' },
              ].map(kpi => (
                <div key={kpi.label} className="bg-surface-2 border border-border rounded-[var(--radius)] p-3">
                  <p className="text-[13px] text-text-3 uppercase tracking-wide">{kpi.label}</p>
                  <p className="text-[17px] font-[600] text-text mt-0.5">{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Statements */}
            {debateDetail.statements.length > 0 && (
              <div>
                <p className="text-[13px] text-text-3 uppercase tracking-wide mb-2">Statements</p>
                <div className="max-h-[40vh] overflow-y-auto space-y-3 border border-border rounded-[var(--radius)] p-3 bg-surface-2">
                  {Object.entries(statementsByRound).map(([round, stmts]) => (
                    <div key={round}>
                      <p className="text-[13px] font-[600] text-text-3 mb-1.5">Round {round}</p>
                      {stmts.map(s => (
                        <div key={s.id} className="mb-2 last:mb-0">
                          <p className="text-[14px] font-[500] text-text">{s.author.username}</p>
                          <p className="text-[14px] text-text-2 mt-0.5 line-clamp-3">{s.content}</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Verdicts */}
            {debateDetail.verdicts.length > 0 && (
              <div>
                <p className="text-[13px] text-text-3 uppercase tracking-wide mb-2">Verdicts</p>
                <div className="space-y-2">
                  {debateDetail.verdicts.map(v => (
                    <div key={v.id} className="border border-border rounded-[var(--radius)] p-3 bg-surface-2">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[15px] font-[500] text-text">Judge: {v.judge.name}</p>
                        <Badge color={v.decision === 'DRAW' ? 'muted' : 'green'} size="sm">{v.decision.replace(/_/g, ' ')}</Badge>
                      </div>
                      {(v.challengerScore != null || v.opponentScore != null) && (
                        <p className="text-[14px] text-text-3 mb-1">
                          Scores: {v.challengerScore ?? '—'} / {v.opponentScore ?? '—'}
                        </p>
                      )}
                      <p className="text-[14px] text-text-2 line-clamp-3">{v.reasoning}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setSelectedDebateId(null); setDeleteTarget({ id: debateDetail.id, topic: debateDetail.topic }); }}
                className="text-[var(--red)] border-[var(--red)]/30 hover:border-[var(--red)]/60"
              >
                <Trash2 size={13} className="mr-1.5" />
                Delete Debate
              </Button>
              <Link href={`/debate/${debateDetail.id}`} target="_blank">
                <Button variant="secondary" size="sm">
                  <ExternalLink size={13} className="mr-1.5" />
                  View Debate
                </Button>
              </Link>
              <Button variant="secondary" size="sm" onClick={() => setSelectedDebateId(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Debate">
        <div className="space-y-4">
          <p className="text-[17px] text-text-2">
            Permanently delete &ldquo;<span className="text-text font-[500]">{deleteTarget?.topic}</span>&rdquo;? This removes all statements, verdicts, and related data. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>Cancel</Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              loading={deleteMutation.isPending}
              className="text-[var(--red)] border-[var(--red)]/30 hover:border-[var(--red)]/60"
            >
              Delete Permanently
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
