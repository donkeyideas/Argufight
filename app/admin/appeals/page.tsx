import type { Metadata } from 'next';
import { prisma } from '@/lib/db/prisma';
import { AdminStatCard } from '@/components/features/admin/admin-stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Admin — Appeals' };
export const revalidate = 60;

type AppealStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type BadgeColor = 'amber' | 'green' | 'red' | 'muted';

const statusColors: Record<AppealStatus, BadgeColor> = {
  PENDING:  'amber',
  APPROVED: 'green',
  REJECTED: 'red',
};

const statusLabels: Record<AppealStatus, string> = {
  PENDING:  'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export default async function AdminAppealsPage() {
  let total = 0;
  let pending = 0;
  let resolved = 0;
  let overturned = 0;
  let appeals: Array<{
    id: string;
    status: string;
    createdAt: Date;
    debate?: { id: string; topic: string } | null;
    appellant?: { username: string | null } | null;
  }> = [];

  try {
    [total, pending, resolved, overturned, appeals] = await Promise.all([
      (prisma as unknown as { appeal: { count: (a?: unknown) => Promise<number> } }).appeal.count().catch(() => 0),
      (prisma as unknown as { appeal: { count: (a?: unknown) => Promise<number> } }).appeal.count({ where: { status: 'PENDING' } }).catch(() => 0),
      (prisma as unknown as { appeal: { count: (a?: unknown) => Promise<number> } }).appeal.count({ where: { status: 'REJECTED' } }).catch(() => 0),
      (prisma as unknown as { appeal: { count: (a?: unknown) => Promise<number> } }).appeal.count({ where: { status: 'APPROVED' } }).catch(() => 0),
      (prisma as unknown as { appeal: { findMany: (a: unknown) => Promise<typeof appeals> } }).appeal.findMany({
        take: 30,
        orderBy: { createdAt: 'desc' },
        include: {
          debate: { select: { id: true, topic: true } },
          appellant: { select: { username: true } },
        },
      }).catch(() => []),
    ]);
  } catch {
    // Appeal model may not exist
  }

  const AlertTriangleIcon = (
    <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" />
      <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" />
    </svg>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">

      <div className="mb-6">
        <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">Appeals</h1>
        <p className="text-[15px] text-text-3 mt-0.5">{total.toLocaleString()} total appeals</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <AdminStatCard label="Pending" value={pending} accent={pending > 0} sub={pending > 0 ? 'Needs review' : 'None'} />
        <AdminStatCard label="Resolved" value={resolved.toLocaleString()} />
        <AdminStatCard label="Overturned" value={overturned.toLocaleString()} />
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="grid grid-cols-[3fr_2fr_1fr_1fr] gap-4 px-4 py-2.5 border-b border-border bg-surface-2">
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Debate topic</p>
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Appellant</p>
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Status</p>
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Date</p>
        </div>

        {appeals.length === 0 ? (
          <EmptyState
            icon={AlertTriangleIcon}
            title="No appeals found"
            description="Appeal records will appear here once the appeals system is active."
          />
        ) : (
          <div className="divide-y divide-border">
            {appeals.map((appeal) => {
              const status = appeal.status as AppealStatus;
              const color: BadgeColor = statusColors[status] ?? 'muted';
              const label = statusLabels[status] ?? appeal.status;

              return (
                <div
                  key={appeal.id}
                  className="grid grid-cols-[3fr_2fr_1fr_1fr] gap-4 px-4 py-3 items-center hover:bg-surface-2 transition-colors duration-100"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-text font-[450] line-clamp-1">
                      {appeal.debate?.topic ?? '—'}
                    </p>
                    <p className="text-[15px] text-text-3 mt-0.5">
                      {appeal.debate ? `ID: ${appeal.debate.id.slice(0, 8)}` : ''}
                    </p>
                  </div>

                  <p className="text-xs text-text-2 truncate">
                    {appeal.appellant?.username ?? '—'}
                  </p>

                  <div>
                    <Badge color={color} size="sm" dot>{label}</Badge>
                  </div>

                  <p className="text-[15px] text-text-3">
                    {new Date(appeal.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: '2-digit',
                    })}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {appeals.length === 30 && (
        <p className="text-[15px] text-text-3 text-center mt-4">Showing first 30 results.</p>
      )}
    </div>
  );
}
