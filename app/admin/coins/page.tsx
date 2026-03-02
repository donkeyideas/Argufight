import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { AdminStatCard } from '@/components/features/admin/admin-stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const metadata: Metadata = { title: 'Admin — Coins' };
export const dynamic = 'force-dynamic';

const PER_PAGE = 10;

type TxType = 'COIN_PURCHASE' | 'COIN_PURCHASE_REFUND' | 'ADMIN_GRANT' | 'ADMIN_DEDUCT' |
  'REFUND' | 'BELT_CHALLENGE_ENTRY' | 'BELT_CHALLENGE_REWARD' | 'BELT_CHALLENGE_CONSOLATION' |
  'BELT_TOURNAMENT_CREATION' | 'BELT_TOURNAMENT_REWARD' | 'PLATFORM_FEE' |
  'DAILY_LOGIN_REWARD' | 'ONBOARDING_REWARD' | 'DEBATE_STREAK_REWARD';

function fmtType(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function typeColor(type: string): 'green' | 'blue' | 'amber' | 'red' | 'muted' {
  if (type === 'COIN_PURCHASE' || type === 'ADMIN_GRANT' || type.includes('REWARD') || type.includes('CONSOLATION')) return 'green';
  if (type === 'BELT_CHALLENGE_ENTRY' || type === 'PLATFORM_FEE' || type === 'ADMIN_DEDUCT') return 'amber';
  if (type === 'REFUND' || type === 'COIN_PURCHASE_REFUND') return 'blue';
  if (type.includes('DEDUCT') || type.includes('FEE')) return 'red';
  return 'muted';
}

function isPositive(type: string): boolean {
  return type.includes('REWARD') || type.includes('GRANT') || type === 'COIN_PURCHASE' || type.includes('CONSOLATION') || type.includes('REFUND');
}

export default async function AdminCoinsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));
  const skip = (page - 1) * PER_PAGE;

  const [totalTx, byType, pageTx] = await Promise.all([
    prisma.coinTransaction.count(),
    prisma.coinTransaction
      .groupBy({ by: ['type'], _count: true, _sum: { amount: true } })
      .catch(() => [] as Array<{ type: string; _count: number; _sum: { amount: number | null } }>),
    prisma.coinTransaction.findMany({
      take: PER_PAGE,
      skip,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalTx / PER_PAGE));

  const userIds = [...new Set(pageTx.map((t) => t.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.username]));

  const typeMap = Object.fromEntries(
    byType.map((row) => [row.type, { count: row._count, total: row._sum.amount ?? 0 }])
  );

  const allTypes: TxType[] = ['COIN_PURCHASE', 'ADMIN_GRANT', 'ADMIN_DEDUCT', 'REFUND', 'BELT_CHALLENGE_ENTRY', 'BELT_CHALLENGE_REWARD', 'PLATFORM_FEE', 'DAILY_LOGIN_REWARD'];

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">Coins</h1>
        <p className="text-[15px] text-text-3 mt-0.5">Transaction ledger and coin flow overview</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <AdminStatCard label="Total transactions" value={totalTx.toLocaleString()} sub="All time" accent />
        <AdminStatCard label="Transaction types" value={byType.length} sub="Distinct types" />
        <AdminStatCard label="Pages" value={totalPages} sub={`${PER_PAGE} per page`} />
      </div>

      {/* By-type breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {allTypes.map((type) => {
          const data = typeMap[type];
          return (
            <AdminStatCard
              key={type}
              label={fmtType(type)}
              value={data ? data.count.toLocaleString() : '0'}
              sub={data ? `${data.total.toLocaleString()} coins` : '—'}
              accent={false}
            />
          );
        })}
      </div>

      <Separator className="mb-6" />

      <div className="grid lg:grid-cols-3 gap-4 mb-6">

        {/* Volume by type */}
        <Card padding="lg">
          <p className="label mb-4">Volume by type</p>
          <div className="space-y-2.5">
            {allTypes.map((type) => {
              const data = typeMap[type];
              const total = data?.total ?? 0;
              const color = typeColor(type);
              return (
                <div key={type} className="flex items-center justify-between">
                  <Badge color={color} size="sm">{fmtType(type)}</Badge>
                  <p className="text-xs font-[500] text-text">
                    {total.toLocaleString()}
                    <span className="text-[14px] text-text-3 ml-1">coins</span>
                  </p>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Count by type */}
        <Card padding="lg">
          <p className="label mb-4">Count by type</p>
          <div className="space-y-2.5">
            {allTypes.map((type) => {
              const data = typeMap[type];
              const count = data?.count ?? 0;
              const pct = totalTx > 0 ? Math.round((count / totalTx) * 100) : 0;
              return (
                <div key={type} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-text-2">{fmtType(type)}</p>
                    <p className="text-xs text-text">{count.toLocaleString()} <span className="text-[14px] text-text-3">({pct}%)</span></p>
                  </div>
                  <div className="w-full bg-surface-2 rounded-full h-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        type.includes('PURCHASE') ? 'bg-[var(--green)]' :
                        type.includes('REWARD') || type.includes('GRANT') ? 'bg-[var(--blue)]' :
                        type.includes('ENTRY') || type.includes('FEE') || type.includes('DEDUCT') ? 'bg-[var(--amber)]' :
                        type.includes('REFUND') ? 'bg-[var(--red)]' :
                        'bg-text-3'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Net flow */}
        <Card padding="lg">
          <p className="label mb-4">Net coin flow</p>
          <div className="space-y-3">
            {(() => {
              const purchased = typeMap['PURCHASE']?.total ?? 0;
              const rewarded  = typeMap['REWARD']?.total ?? 0;
              const spent     = typeMap['SPEND']?.total ?? 0;
              const refunded  = typeMap['REFUND']?.total ?? 0;
              const net       = purchased + rewarded + refunded - spent;
              return (
                <>
                  <div className="flex justify-between">
                    <p className="text-xs text-text-2">Total in (purchase)</p>
                    <p className="text-xs text-[var(--green)]">+{purchased.toLocaleString()}</p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-xs text-text-2">Total in (rewards)</p>
                    <p className="text-xs text-[var(--blue)]">+{rewarded.toLocaleString()}</p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-xs text-text-2">Total out (spend)</p>
                    <p className="text-xs text-[var(--amber)]">-{spent.toLocaleString()}</p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-xs text-text-2">Refunded</p>
                    <p className="text-xs text-[var(--red)]">+{refunded.toLocaleString()}</p>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <p className="text-xs font-[500] text-text">Net balance</p>
                    <p className={`text-xs font-[500] ${net >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                      {net >= 0 ? '+' : ''}{net.toLocaleString()}
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        </Card>

      </div>

      {/* Transactions table */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="label">Transactions</p>
            <p className="text-[15px] text-text-3 mt-0.5">
              {skip + 1}–{Math.min(skip + PER_PAGE, totalTx)} of {totalTx.toLocaleString()}
            </p>
          </div>
          <p className="text-[15px] text-text-3">Page {page} of {totalPages}</p>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_2fr_1fr] gap-4 px-4 py-2.5 border-b border-border bg-surface-2">
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">User</p>
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Amount</p>
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Type</p>
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Description</p>
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Date</p>
        </div>

        {/* Table rows */}
        {pageTx.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-xs text-text-3">No transactions found.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {pageTx.map((tx) => {
              const username = userMap[tx.userId] ?? tx.userId.slice(0, 8) + '...';
              const positive = isPositive(tx.type);
              const color    = typeColor(tx.type);
              return (
                <div
                  key={tx.id}
                  className="grid grid-cols-[2fr_1fr_1fr_2fr_1fr] gap-4 px-4 py-3 items-center hover:bg-surface-2 transition-colors duration-100"
                >
                  <p className="text-xs text-text truncate font-[450]">{username}</p>
                  <p className={`text-xs font-[500] ${positive ? 'text-[var(--green)]' : 'text-[var(--amber)]'}`}>
                    {positive ? '+' : '-'}{Math.abs(Number(tx.amount)).toLocaleString()}
                  </p>
                  <div>
                    <Badge color={color} size="sm">{fmtType(tx.type)}</Badge>
                  </div>
                  <p className="text-[15px] text-text-3 truncate">
                    {tx.description
                      ? tx.description.length > 40 ? tx.description.slice(0, 40) + '...' : tx.description
                      : <span className="italic">No description</span>}
                  </p>
                  <p className="text-[15px] text-text-3 flex-shrink-0">
                    {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-[15px] text-text-3">
            Showing {skip + 1}–{Math.min(skip + PER_PAGE, totalTx)} of {totalTx.toLocaleString()} transactions
          </p>
          <div className="flex items-center gap-1">
            {/* Prev */}
            {page > 1 ? (
              <Link
                href={`/admin/coins?page=${page - 1}`}
                className="flex items-center gap-1 px-3 py-1.5 rounded border border-border text-[15px] text-text-2 hover:bg-surface-2 transition-colors"
              >
                <ChevronLeft size={13} />
                Prev
              </Link>
            ) : (
              <span className="flex items-center gap-1 px-3 py-1.5 rounded border border-border text-[15px] text-text-3 opacity-40 cursor-not-allowed">
                <ChevronLeft size={13} />
                Prev
              </span>
            )}

            {/* Page numbers */}
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = totalPages <= 7
                ? i + 1
                : page <= 4
                  ? i + 1
                  : page >= totalPages - 3
                    ? totalPages - 6 + i
                    : page - 3 + i;
              return (
                <Link
                  key={p}
                  href={`/admin/coins?page=${p}`}
                  className={`w-8 h-8 flex items-center justify-center rounded text-[15px] border transition-colors ${
                    p === page
                      ? 'border-accent text-accent bg-[rgba(212,240,80,0.06)] font-[500]'
                      : 'border-border text-text-3 hover:text-text-2 hover:bg-surface-2'
                  }`}
                >
                  {p}
                </Link>
              );
            })}

            {/* Next */}
            {page < totalPages ? (
              <Link
                href={`/admin/coins?page=${page + 1}`}
                className="flex items-center gap-1 px-3 py-1.5 rounded border border-border text-[15px] text-text-2 hover:bg-surface-2 transition-colors"
              >
                Next
                <ChevronRight size={13} />
              </Link>
            ) : (
              <span className="flex items-center gap-1 px-3 py-1.5 rounded border border-border text-[15px] text-text-3 opacity-40 cursor-not-allowed">
                Next
                <ChevronRight size={13} />
              </span>
            )}
          </div>
        </div>
      </Card>

    </div>
  );
}
