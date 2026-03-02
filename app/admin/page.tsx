import type { Metadata } from 'next';
import { prisma } from '@/lib/db/prisma';
import { AdminStatCard } from '@/components/features/admin/admin-stat-card';
import {
  AdminAreaChart,
  AdminBarChart,
  AdminDonutChart,
} from '@/components/features/admin/admin-charts';
import type { DayPoint, BarPoint, DonutSlice } from '@/components/features/admin/admin-charts';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminOverviewPage() {
  const now     = new Date();
  const weekAgo = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const dayAgo  = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const days14  = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const days30  = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers, newUsersWeek,
    totalDebates, debatesToday,
    activeDebates,
    totalBelts,
    pendingModeration,
    totalRevenue,
    // Raw data for charts
    users14, debates14, debates30,
    debateStatuses,
    coinTypes,
    topCategories,
  ] = await Promise.all([
    prisma.user.count({ where: { isAI: false } }),
    prisma.user.count({ where: { isAI: false, createdAt: { gte: weekAgo } } }),
    prisma.debate.count(),
    prisma.debate.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.debate.count({ where: { status: 'ACTIVE' } }),
    prisma.belt.count({ where: { status: 'ACTIVE' } }),
    prisma.report.count({ where: { status: 'PENDING' } }).catch(() => 0),
    prisma.coinTransaction.aggregate({ _sum: { amount: true }, where: { type: 'COIN_PURCHASE' } }),
    // Chart data
    prisma.user.findMany({ where: { isAI: false, createdAt: { gte: days14 } }, select: { createdAt: true } }),
    prisma.debate.findMany({ where: { createdAt: { gte: days14 } }, select: { createdAt: true } }),
    prisma.debate.findMany({ where: { createdAt: { gte: days30 } }, select: { createdAt: true } }),
    prisma.debate.groupBy({ by: ['status'], _count: true }),
    prisma.coinTransaction.groupBy({ by: ['type'], _count: true }).catch(() => []),
    prisma.debate.groupBy({ by: ['category'], _count: true, orderBy: { _count: { category: 'desc' } }, take: 6 }),
  ]);

  // ─── Build chart data ──────────────────────────────────────────────────────

  // Users per day (14 days)
  const userBuckets = buildDayBuckets(14);
  for (const u of users14) userBuckets.set(dayLabel(u.createdAt), (userBuckets.get(dayLabel(u.createdAt)) ?? 0) + 1);
  const userTrend: DayPoint[] = [...userBuckets.entries()].map(([day, value]) => ({ day, value }));

  // Debates per day (14 days)
  const debateBuckets = buildDayBuckets(14);
  for (const d of debates14) debateBuckets.set(dayLabel(d.createdAt), (debateBuckets.get(dayLabel(d.createdAt)) ?? 0) + 1);
  const debateTrend: DayPoint[] = [...debateBuckets.entries()].map(([day, value]) => ({ day, value }));

  // Debate status donut
  const STATUS_COLORS: Record<string, string> = {
    ACTIVE: '#d4f050', COMPLETED: '#60a5fa', WAITING: '#f59e0b',
    CANCELLED: '#6b7280', VERDICT_READY: '#a78bfa', JUDGING: '#34d399',
  };
  const debateStatusData: DonutSlice[] = debateStatuses
    .filter((s) => s._count > 0)
    .map((s) => ({
      label: s.status.charAt(0) + s.status.slice(1).toLowerCase().replace(/_/g, ' '),
      value: s._count,
      color: STATUS_COLORS[s.status] ?? '#6b7280',
    }));

  // Coin transaction types bar
  const COIN_COLORS: Record<string, string> = {
    COIN_PURCHASE: '#d4f050', ADMIN_GRANT: '#60a5fa', DAILY_LOGIN_REWARD: '#34d399',
    ADMIN_DEDUCT: '#f59e0b', REFUND: '#a78bfa', BELT_CHALLENGE_REWARD: '#f87171',
    BELT_CHALLENGE_ENTRY: '#fb923c', PLATFORM_FEE: '#6b7280',
  };
  const coinBarData: BarPoint[] = coinTypes
    .filter((c) => c._count > 0)
    .slice(0, 7)
    .map((c) => ({
      label: c.type.split('_').map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join(' '),
      value: c._count,
      color: COIN_COLORS[c.type] ?? '#6b7280',
    }));

  // Category bar
  const CAT_COLOR = '#d4f050';
  const categoryBarData: BarPoint[] = topCategories.map((c) => ({
    label: c.category.charAt(0) + c.category.slice(1).toLowerCase(),
    value: c._count,
    color: CAT_COLOR,
  }));

  // Debates per week (last 4 weeks) using debates30
  const weekBuckets: Record<string, number> = { 'Week 1': 0, 'Week 2': 0, 'Week 3': 0, 'Week 4': 0 };
  for (const d of debates30) {
    const daysAgo = Math.floor((now.getTime() - d.createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const key = `Week ${Math.min(daysAgo + 1, 4)}`;
    weekBuckets[key] = (weekBuckets[key] ?? 0) + 1;
  }
  const weeklyDebates: BarPoint[] = Object.entries(weekBuckets).reverse().map(([label, value]) => ({ label, value, color: '#60a5fa' }));

  // Recent debates + users
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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">Admin overview</h1>
        <p className="text-[15px] text-text-3 mt-0.5">
          {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* KPI cards */}
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

      {/* Trend charts */}
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

      {/* Debate status + weekly activity */}
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

      {/* Categories + Coins */}
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

      {/* Recent debates + signups */}
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

    </div>
  );
}
