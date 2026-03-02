import type { Metadata } from 'next';
import { prisma } from '@/lib/db/prisma';
import { AdminStatCard } from '@/components/features/admin/admin-stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Admin — Debates' };
export const revalidate = 30;

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

export default async function AdminDebatesPage() {
  const [totalDebates, activeDebates, completedDebates, appealedDebates, debates] =
    await Promise.all([
      prisma.debate.count(),
      prisma.debate.count({ where: { status: 'ACTIVE' } }),
      prisma.debate.count({ where: { status: 'COMPLETED' } }),
      prisma.debate.count({ where: { status: 'APPEALED' } }),
      prisma.debate.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          challenger: { select: { id: true, username: true } },
          opponent:   { select: { id: true, username: true } },
        },
      }),
    ]);

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">Debates</h1>
        <p className="text-[15px] text-text-3 mt-0.5">{totalDebates.toLocaleString()} total debates</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <AdminStatCard label="Total" value={totalDebates.toLocaleString()} />
        <AdminStatCard label="Active" value={activeDebates} accent={activeDebates > 0} />
        <AdminStatCard label="Completed" value={completedDebates.toLocaleString()} />
        <AdminStatCard label="Appealed" value={appealedDebates} sub={appealedDebates > 0 ? 'Needs review' : 'None'} accent={appealedDebates > 0} />
      </div>

      {/* Table */}
      <Card padding="none" className="overflow-hidden">

        {/* Table header */}
        <div className="grid grid-cols-[3fr_2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2.5 border-b border-border bg-surface-2">
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Topic</p>
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Participants</p>
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Status</p>
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Visibility</p>
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Created</p>
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Actions</p>
        </div>

        {/* Table rows */}
        {debates.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-xs text-text-3">No debates found.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {debates.map((debate) => {
              const status = debate.status as DebateStatus;
              const badgeColor: BadgeColor = statusColors[status] ?? 'muted';
              const label = statusLabel[status] ?? debate.status;

              return (
                <div
                  key={debate.id}
                  className="grid grid-cols-[3fr_2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 items-center hover:bg-surface-2 transition-colors duration-100"
                >
                  {/* Topic */}
                  <div className="min-w-0">
                    <p className="text-xs text-text line-clamp-1 font-[450]">
                      {debate.topic}
                    </p>
                    <p className="text-[15px] text-text-3 mt-0.5">
                      ID: {debate.id.slice(0, 8)}
                    </p>
                  </div>

                  {/* Challenger vs Opponent */}
                  <div className="min-w-0">
                    <p className="text-xs text-text truncate">
                      <span className="font-[450]">{debate.challenger.username}</span>
                      <span className="text-text-3 mx-1">vs</span>
                      <span className="font-[450]">{debate.opponent?.username ?? 'Open'}</span>
                    </p>
                  </div>

                  {/* Status badge */}
                  <div>
                    <Badge color={badgeColor} size="sm" dot>
                      {label}
                    </Badge>
                  </div>

                  {/* Visibility badge */}
                  <div>
                    <Badge
                      color={'isPublic' in debate && debate.isPublic === false ? 'muted' : 'default'}
                      size="sm"
                    >
                      {'isPublic' in debate && debate.isPublic === false ? 'Private' : 'Public'}
                    </Badge>
                  </div>

                  {/* Created */}
                  <p className="text-[15px] text-text-3">
                    {new Date(debate.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: '2-digit',
                    })}
                  </p>

                  {/* Actions */}
                  <div>
                    <Button
                      href={`/debate/${debate.id}`}
                      variant="ghost"
                      size="sm"
                    >
                      View
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {debates.length === 50 && (
        <p className="text-[15px] text-text-3 text-center mt-4">
          Showing first 50 results.
        </p>
      )}
    </div>
  );
}
