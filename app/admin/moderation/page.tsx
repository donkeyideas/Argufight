import type { Metadata } from 'next';
import { prisma } from '@/lib/db/prisma';
import { AdminStatCard } from '@/components/features/admin/admin-stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Admin — Moderation' };
export const revalidate = 30;

function ShieldIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function statusColor(status: string): 'amber' | 'green' | 'muted' {
  if (status === 'PENDING') return 'amber';
  if (status === 'RESOLVED') return 'green';
  return 'muted';
}

export default async function AdminModerationPage() {
  const [
    pendingCount,
    resolvedCount,
    bannedCount,
    strikesCount,
  ] = await Promise.all([
    prisma.report.count({ where: { status: 'PENDING' } }).catch(() => 0),
    prisma.report.count({ where: { status: 'RESOLVED' } }).catch(() => 0),
    prisma.user.count({ where: { isBanned: true } }),
    prisma.user.count({ where: { strikes: { gt: 0 } } }),
  ]);

  const reports = await prisma.report
    .findMany({
      take: 30,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { id: true, username: true } },
      },
    })
    .catch(() => []);

  const bannedUsers = await prisma.user
    .findMany({
      where: { isBanned: true },
      select: {
        id: true,
        username: true,
        banReason: true,
        bannedUntil: true,
      },
      take: 20,
    })
    .catch(() => []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">Moderation</h1>
        <p className="text-[15px] text-text-3 mt-0.5">
          Content reports, bans, and user strikes
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <AdminStatCard
          label="Pending reports"
          value={pendingCount}
          sub={pendingCount > 0 ? 'Needs review' : 'All clear'}
          accent={pendingCount > 0}
        />
        <AdminStatCard label="Resolved reports" value={resolvedCount} />
        <AdminStatCard
          label="Banned users"
          value={bannedCount}
          sub={bannedCount > 0 ? 'Active bans' : 'None'}
          accent={bannedCount > 0}
        />
        <AdminStatCard
          label="Users with strikes"
          value={strikesCount}
          sub={strikesCount > 0 ? 'Monitor closely' : 'None'}
          accent={strikesCount > 0}
        />
      </div>

      {/* Reports table */}
      <Card padding="none" className="mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-xs font-[500] text-text">Recent reports</p>
          <p className="text-[15px] text-text-3">Last 30</p>
        </div>

        {reports.length === 0 ? (
          <EmptyState
            icon={<ShieldIcon />}
            title="No reports"
            description="No reports have been submitted yet."
          />
        ) : (
          <div className="divide-y divide-border">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_1fr_2fr_80px_80px] gap-3 px-4 py-2 bg-surface-2">
              <p className="text-[15px] text-text-3 font-[500]">Reporter</p>
              <p className="text-[15px] text-text-3 font-[500]">Reported</p>
              <p className="text-[15px] text-text-3 font-[500]">Reason</p>
              <p className="text-[15px] text-text-3 font-[500]">Status</p>
              <p className="text-[15px] text-text-3 font-[500]">Date</p>
            </div>

            {reports.map((report) => (
              <div
                key={report.id}
                className="grid grid-cols-[1fr_1fr_2fr_80px_80px] gap-3 px-4 py-2.5 items-center"
              >
                <p className="text-xs text-text truncate">
                  {report.reporter.username}
                </p>
                <p className="text-xs text-text-3 truncate">
                  {report.debateId ? `Debate` : '—'}
                </p>
                <p className="text-xs text-text-2 truncate" title={report.reason}>
                  {report.reason.length > 60
                    ? report.reason.slice(0, 60) + '…'
                    : report.reason}
                </p>
                <Badge color={statusColor(report.status)} size="sm" dot>
                  {report.status}
                </Badge>
                <p className="text-[15px] text-text-3">
                  {new Date(report.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Banned users */}
      <Card padding="none">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-xs font-[500] text-text">Banned users</p>
          <Badge color={bannedCount > 0 ? 'red' : 'muted'} size="sm">
            {bannedCount} banned
          </Badge>
        </div>

        {bannedUsers.length === 0 ? (
          <EmptyState
            icon={<ShieldIcon />}
            title="No banned users"
            description="There are currently no active bans."
          />
        ) : (
          <div className="divide-y divide-border">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_2fr_120px] gap-3 px-4 py-2 bg-surface-2">
              <p className="text-[15px] text-text-3 font-[500]">Username</p>
              <p className="text-[15px] text-text-3 font-[500]">Ban reason</p>
              <p className="text-[15px] text-text-3 font-[500]">Banned until</p>
            </div>

            {bannedUsers.map((user) => (
              <div
                key={user.id}
                className="grid grid-cols-[1fr_2fr_120px] gap-3 px-4 py-2.5 items-center"
              >
                <p className="text-xs text-text font-[450]">{user.username}</p>
                <p
                  className="text-xs text-text-2 truncate"
                  title={user.banReason ?? undefined}
                >
                  {user.banReason
                    ? user.banReason.length > 80
                      ? user.banReason.slice(0, 80) + '…'
                      : user.banReason
                    : '—'}
                </p>
                <p className="text-[15px] text-text-3">
                  {user.bannedUntil
                    ? new Date(user.bannedUntil).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Permanent'}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
