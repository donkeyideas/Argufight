import type { Metadata } from 'next';
import { Suspense } from 'react';

import { prisma } from '@/lib/db/prisma';
import { unstable_cache } from 'next/cache';
import { AdminStatCard } from '@/components/features/admin/admin-stat-card';
import {
  AdminAreaChart,
  AdminBarChart,
  AdminDonutChart,
} from '@/components/features/admin/admin-charts';
import type { DayPoint, BarPoint, DonutSlice } from '@/components/features/admin/admin-charts';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Admin — Overview' };
export const dynamic = 'force-dynamic';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function dayLabel(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildDayBuckets(days: number): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    map.set(dayLabel(d), 0);
  }
  return map;
}

// ─── Cached data fetchers ─────────────────────────────────────────────────────

const getAdminStats = unstable_cache(
  async () => {
    const now     = new Date();
    const weekAgo = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    const dayAgo  = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalUsers, newUsersWeek,
      totalDebates, debatesToday,
      activeDebates,
      totalBelts,
      pendingModeration,
      totalRevenue,
    ] = await Promise.all([
      prisma.user.count({ where: { isAI: false } }),
      prisma.user.count({ where: { isAI: false, createdAt: { gte: weekAgo } } }),
      prisma.debate.count(),
      prisma.debate.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.debate.count({ where: { status: 'ACTIVE' } }),
      prisma.belt.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
      prisma.report.count({ where: { status: 'PENDING' } }).catch(() => 0),
      prisma.coinTransaction.aggregate({ _sum: { amount: true }, where: { type: 'COIN_PURCHASE' } }).catch(() => ({ _sum: { amount: null } })),
    ]);

    return { totalUsers, newUsersWeek, totalDebates, debatesToday, activeDebates, totalBelts, pendingModeration, totalRevenue };
  },
  ['admin-stats'],
  { revalidate: 30 }
);

const getAdminCharts = unstable_cache(
  async () => {
    const now    = new Date();
    const days14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [users14, debates14, debates30, debateStatuses, coinTypes, topCategories] = await Promise.all([
      prisma.user.findMany({ where: { isAI: false, createdAt: { gte: days14 } }, select: { createdAt: true } }),
      prisma.debate.findMany({ where: { createdAt: { gte: days14 } }, select: { createdAt: true } }),
      prisma.debate.findMany({ where: { createdAt: { gte: days30 } }, select: { createdAt: true } }),
      prisma.debate.groupBy({ by: ['status'], _count: true }),
      prisma.coinTransaction.groupBy({ by: ['type'], _count: true }).catch(() => []),
      prisma.debate.groupBy({ by: ['category'], _count: true, orderBy: { _count: { category: 'desc' } }, take: 6 }),
    ]);

    return { users14, debates14, debates30, debateStatuses, coinTypes, topCategories };
  },
  ['admin-charts'],
  { revalidate: 60 }
);

const getAdminRecent = unstable_cache(
  async () => {
    const [recentDebates, recentUsers] = await Promise.all([
      prisma.debate.findMany({
        take: 5, orderBy: { createdAt: 'desc' },
        include: { challenger: { select: { username: true } }, opponent: { select: { username: true } } },
      }),
      prisma.user.findMany({
        where: { isAI: false }, take: 5, orderBy: { createdAt: 'desc' },
        select: { id: true, username: true, email: true, createdAt: true },
      }),
    ]);
    return { recentDebates, recentUsers };
  },
  ['admin-recent'],
  { revalidate: 30 }
);

// ─── Chart colors ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#d4f050', COMPLETED: '#60a5fa', WAITING: '#f59e0b',
  CANCELLED: '#6b7280', VERDICT_READY: '#a78bfa', JUDGING: '#34d399',
};
const COIN_COLORS: Record<string, string> = {
  COIN_PURCHASE: '#d4f050', ADMIN_GRANT: '#60a5fa', DAILY_LOGIN_REWARD: '#34d399',
  ADMIN_DEDUCT: '#f59e0b', REFUND: '#a78bfa', BELT_CHALLENGE_REWARD: '#f87171',
  BELT_CHALLENGE_ENTRY: '#fb923c', PLATFORM_FEE: '#6b7280',
};

// ─── Async sub-components ─────────────────────────────────────────────────────

async function StatsSection() {
  const { totalUsers, newUsersWeek, totalDebates, debatesToday, activeDebates, totalBelts, pendingModeration, totalRevenue } = await getAdminStats();
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <AdminStatCard label="Total users"      value={totalUsers.toLocaleString()}  sub={`+${newUsersWeek} this week`} accent />
      <AdminStatCard label="Total debates"    value={totalDebates.toLocaleString()} sub={`${debatesToday} today`} />
      <AdminStatCard label="Active debates"   value={activeDebates} />
      <AdminStatCard label="Active belts"     value={totalBelts} />
      <AdminStatCard label="Pending reports"  value={pendingModeration} sub={pendingModeration > 0 ? 'Needs review' : 'All clear'} accent={pendingModeration > 0} />
      <AdminStatCard label="Coin purchases"   value={`${(totalRevenue._sum.amount ?? 0).toLocaleString()}`} sub="Coins sold" />
      <AdminStatCard label="New users"        value={newUsersWeek} sub="Last 7 days" />
      <AdminStatCard label="Platform health"  value="Good" />
    </div>
  );
}

async function ChartsSection() {
  const { users14, debates14, debates30, debateStatuses, coinTypes, topCategories } = await getAdminCharts();
  const now = new Date();

  const userBuckets = buildDayBuckets(14);
  for (const u of users14) userBuckets.set(dayLabel(u.createdAt), (userBuckets.get(dayLabel(u.createdAt)) ?? 0) + 1);
  const userTrend: DayPoint[] = [...userBuckets.entries()].map(([day, value]) => ({ day, value }));

  const debateBuckets = buildDayBuckets(14);
  for (const d of debates14) debateBuckets.set(dayLabel(d.createdAt), (debateBuckets.get(dayLabel(d.createdAt)) ?? 0) + 1);
  const debateTrend: DayPoint[] = [...debateBuckets.entries()].map(([day, value]) => ({ day, value }));

  const debateStatusData: DonutSlice[] = debateStatuses
    .filter((s) => s._count > 0)
    .map((s) => ({
      label: s.status.charAt(0) + s.status.slice(1).toLowerCase().replace(/_/g, ' '),
      value: s._count,
      color: STATUS_COLORS[s.status] ?? '#6b7280',
    }));

  const coinBarData: BarPoint[] = coinTypes
    .filter((c) => c._count > 0)
    .slice(0, 7)
    .map((c) => ({
      label: c.type.split('_').map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join(' '),
      value: c._count,
      color: COIN_COLORS[c.type] ?? '#6b7280',
    }));

  const categoryBarData: BarPoint[] = topCategories.map((c) => ({
    label: c.category.charAt(0) + c.category.slice(1).toLowerCase(),
    value: c._count,
    color: '#d4f050',
  }));

  const weekBuckets: Record<string, number> = { 'Week 1': 0, 'Week 2': 0, 'Week 3': 0, 'Week 4': 0 };
  for (const d of debates30) {
    const daysAgo = Math.floor((now.getTime() - d.createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const key = `Week ${Math.min(daysAgo + 1, 4)}`;
    weekBuckets[key] = (weekBuckets[key] ?? 0) + 1;
  }
  const weeklyDebates: BarPoint[] = Object.entries(weekBuckets).reverse().map(([label, value]) => ({ label, value, color: '#60a5fa' }));

  return (
    <>
      <div className="grid md:grid-cols-2 gap-4">
        <Card padding="lg">
          <p className="label mb-1">User signups</p>
          <p className="text-[15px] text-text-3 mb-4">Last 14 days</p>
          <AdminAreaChart data={userTrend} color="#d4f050" height={130} />
        </Card>
        <Card padding="lg">
          <p className="label mb-1">Debates created</p>
          <p className="text-[15px] text-text-3 mb-4">Last 14 days</p>
          <AdminAreaChart data={debateTrend} color="#60a5fa" height={130} />
        </Card>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card padding="lg">
          <p className="label mb-4">Debate status breakdown</p>
          {debateStatusData.length > 0
            ? <AdminDonutChart data={debateStatusData} height={160} />
            : <p className="text-[15px] text-text-3">No debate data yet</p>}
        </Card>
        <Card padding="lg">
          <p className="label mb-1">Weekly debate volume</p>
          <p className="text-[15px] text-text-3 mb-4">Last 4 weeks</p>
          <AdminBarChart data={weeklyDebates} height={160} />
        </Card>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card padding="lg">
          <p className="label mb-1">Debates by category</p>
          <p className="text-[15px] text-text-3 mb-4">All time, top 6</p>
          {categoryBarData.length > 0
            ? <AdminBarChart data={categoryBarData} height={160} />
            : <p className="text-[15px] text-text-3">No category data yet</p>}
        </Card>
        <Card padding="lg">
          <p className="label mb-1">Coin transactions by type</p>
          <p className="text-[15px] text-text-3 mb-4">All time counts</p>
          {coinBarData.length > 0
            ? <AdminBarChart data={coinBarData} height={160} />
            : <p className="text-[15px] text-text-3">No transaction data yet</p>}
        </Card>
      </div>
    </>
  );
}

async function RecentSection() {
  const { recentDebates, recentUsers } = await getAdminRecent();
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card padding="lg">
        <div className="flex items-center justify-between mb-4">
          <p className="label">Recent debates</p>
          <Link href="/admin/debates" className="text-[15px] text-accent hover:underline">View all</Link>
        </div>
        <div className="space-y-2.5">
          {recentDebates.map((d) => (
            <div key={d.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[16px] text-text truncate">{d.topic}</p>
                <p className="text-[15px] text-text-3">
                  {d.challenger.username} vs {d.opponent?.username ?? 'Open'}
                </p>
              </div>
              <Badge color={d.status === 'ACTIVE' ? 'green' : 'muted'} size="sm">
                {d.status.charAt(0) + d.status.slice(1).toLowerCase().replace(/_/g, ' ')}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
      <Card padding="lg">
        <div className="flex items-center justify-between mb-4">
          <p className="label">Recent signups</p>
          <Link href="/admin/users" className="text-[15px] text-accent hover:underline">View all</Link>
        </div>
        <div className="space-y-2.5">
          {recentUsers.map((u) => (
            <div key={u.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[16px] text-text">{u.username}</p>
                <p className="text-[15px] text-text-3 truncate">{u.email}</p>
              </div>
              <p className="text-[15px] text-text-3 flex-shrink-0">
                {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="bg-surface border border-border rounded-[var(--radius)] p-4">
          <Skeleton height={10} width={80} className="mb-2" />
          <Skeleton height={22} width={50} className="mb-1" />
          <Skeleton height={9} width={60} />
        </div>
      ))}
    </div>
  );
}

function ChartsSkeleton() {
  return (
    <>
      <div className="grid md:grid-cols-2 gap-4">
        {[0, 1].map(i => (
          <div key={i} className="bg-surface border border-border rounded-[var(--radius)] p-5">
            <Skeleton height={10} width={100} className="mb-1" />
            <Skeleton height={9} width={80} className="mb-4" />
            <Skeleton height={130} width="100%" />
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {[0, 1].map(i => (
          <div key={i} className="bg-surface border border-border rounded-[var(--radius)] p-5">
            <Skeleton height={10} width={140} className="mb-4" />
            <Skeleton height={160} width="100%" />
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminOverviewPage() {
  const now = new Date();
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">Admin overview</h1>
        <p className="text-[15px] text-text-3 mt-0.5">
          {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      <Suspense fallback={<StatsSkeleton />}>
        <StatsSection />
      </Suspense>
      <Suspense fallback={<ChartsSkeleton />}>
        <ChartsSection />
      </Suspense>
      <Suspense fallback={null}>
        <RecentSection />
      </Suspense>
    </div>
  );
}
