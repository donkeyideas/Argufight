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
import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = { title: 'Admin — Analytics' };
export const dynamic = 'force-dynamic';

// ─── helpers ──────────────────────────────────────────────────────────────────

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

export default async function AdminAnalyticsPage() {
  const now      = new Date();
  const dayAgo   = new Date(now.getTime() - 24  * 60 * 60 * 1000);
  const weekAgo  = new Date(now.getTime() - 7   * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30  * 24 * 60 * 60 * 1000);
  const days30   = new Date(now.getTime() - 30  * 24 * 60 * 60 * 1000);
  const days14   = new Date(now.getTime() - 14  * 24 * 60 * 60 * 1000);
  const days90   = new Date(now.getTime() - 90  * 24 * 60 * 60 * 1000);

  const [
    usersToday, usersWeek, usersMonth, totalUsers,
    debatesToday, debatesWeek, debatesMonth, totalDebates,
    completedDebates, activeDebates, activeUsers7d,
    // chart raw data
    users30raw, debates30raw,
    debateStatuses, debateCategories,
    users90raw, debates90raw,
    retentionD1, retentionD7, retentionD30,
  ] = await Promise.all([
    prisma.user.count({ where: { isAI: false, createdAt: { gte: dayAgo } } }),
    prisma.user.count({ where: { isAI: false, createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { isAI: false, createdAt: { gte: monthAgo } } }),
    prisma.user.count({ where: { isAI: false } }),
    prisma.debate.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.debate.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.debate.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.debate.count(),
    prisma.debate.count({ where: { status: 'COMPLETED' } }),
    prisma.debate.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
    prisma.user.count({ where: { isAI: false, updatedAt: { gte: weekAgo } } }).catch(() => 0),
    // 30-day daily trends
    prisma.user.findMany({ where: { isAI: false, createdAt: { gte: days30 } }, select: { createdAt: true } }),
    prisma.debate.findMany({ where: { createdAt: { gte: days30 } }, select: { createdAt: true } }),
    // status + category breakdown
    prisma.debate.groupBy({ by: ['status'], _count: true }),
    prisma.debate.groupBy({ by: ['category'], _count: true, orderBy: { _count: { category: 'desc' } }, take: 8 }),
    // 90-day weekly trend
    prisma.user.findMany({ where: { isAI: false, createdAt: { gte: days90 } }, select: { createdAt: true } }),
    prisma.debate.findMany({ where: { createdAt: { gte: days90 } }, select: { createdAt: true } }),
    // retention proxy: users active in last 1d / 7d / 30d
    prisma.user.count({ where: { isAI: false, updatedAt: { gte: dayAgo } } }).catch(() => 0),
    prisma.user.count({ where: { isAI: false, updatedAt: { gte: weekAgo } } }).catch(() => 0),
    prisma.user.count({ where: { isAI: false, updatedAt: { gte: monthAgo } } }).catch(() => 0),
  ]);

  const completionPct = Math.round((completedDebates / Math.max(totalDebates, 1)) * 100);

  // ─── chart data ─────────────────────────────────────────────────────────────

  // 30-day user trend
  const uBuckets = buildDayBuckets(30);
  for (const u of users30raw) uBuckets.set(dayLabel(u.createdAt), (uBuckets.get(dayLabel(u.createdAt)) ?? 0) + 1);
  const userTrend30: DayPoint[] = [...uBuckets.entries()].map(([day, value]) => ({ day, value }));

  // 30-day debate trend
  const dBuckets = buildDayBuckets(30);
  for (const d of debates30raw) dBuckets.set(dayLabel(d.createdAt), (dBuckets.get(dayLabel(d.createdAt)) ?? 0) + 1);
  const debateTrend30: DayPoint[] = [...dBuckets.entries()].map(([day, value]) => ({ day, value }));

  // 14-day user trend (sliced from 30)
  const userTrend14 = userTrend30.slice(-14);
  const debateTrend14 = debateTrend30.slice(-14);

  // Debate status donut
  const STATUS_COLORS: Record<string, string> = {
    ACTIVE: '#d4f050', COMPLETED: '#60a5fa', WAITING: '#f59e0b',
    CANCELLED: '#6b7280', VERDICT_READY: '#a78bfa', JUDGING: '#34d399',
  };
  const statusData: DonutSlice[] = debateStatuses
    .filter(s => s._count > 0)
    .map(s => ({
      label: s.status.charAt(0) + s.status.slice(1).toLowerCase().replace(/_/g, ' '),
      value: s._count,
      color: STATUS_COLORS[s.status] ?? '#6b7280',
    }));

  // Category bar
  const CAT_COLORS: Record<string, string> = {
    SPORTS: '#f87171', POLITICS: '#60a5fa', TECH: '#34d399',
    ENTERTAINMENT: '#fb923c', SCIENCE: '#a78bfa', MUSIC: '#f59e0b',
    OTHER: '#6b7280',
  };
  const categoryBar: BarPoint[] = debateCategories.map(c => ({
    label: c.category.charAt(0) + c.category.slice(1).toLowerCase(),
    value: c._count,
    color: CAT_COLORS[c.category] ?? '#6b7280',
  }));

  // Weekly user + debate bars (last 13 weeks from 90-day data)
  const WEEK_COUNT = 13;
  const weeklyUsers   = Array.from({ length: WEEK_COUNT }, (_, i) => ({ label: `W${WEEK_COUNT - i}`, value: 0, color: '#d4f050' }));
  const weeklyDebates = Array.from({ length: WEEK_COUNT }, (_, i) => ({ label: `W${WEEK_COUNT - i}`, value: 0, color: '#60a5fa' }));
  for (const u of users90raw) {
    const w = Math.min(Math.floor((now.getTime() - u.createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000)), WEEK_COUNT - 1);
    weeklyUsers[w].value += 1;
  }
  for (const d of debates90raw) {
    const w = Math.min(Math.floor((now.getTime() - d.createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000)), WEEK_COUNT - 1);
    weeklyDebates[w].value += 1;
  }
  weeklyUsers.reverse();
  weeklyDebates.reverse();

  // Retention bar (D1 / D7 / D30 as % of total)
  const retentionBar: BarPoint[] = [
    { label: 'DAU (1d)',  value: retentionD1,  color: '#d4f050' },
    { label: 'WAU (7d)',  value: retentionD7,  color: '#60a5fa' },
    { label: 'MAU (30d)', value: retentionD30, color: '#a78bfa' },
    { label: 'Total',     value: totalUsers,   color: '#6b7280' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">Analytics</h1>
        <p className="text-[17px] text-text-3 mt-0.5">Platform metrics and growth data</p>
      </div>

      {/* Top KPIs */}
      <div>
        <p className="label mb-3">Top metrics</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <AdminStatCard label="Total users"       value={totalUsers.toLocaleString()}   sub={`+${usersMonth} this month`}      accent />
          <AdminStatCard label="Total debates"     value={totalDebates.toLocaleString()} sub={`${debatesMonth} this month`} />
          <AdminStatCard label="Debate completion" value={`${completionPct}%`}           sub={`${completedDebates.toLocaleString()} completed`} />
          <AdminStatCard label="Active debates"    value={activeDebates.toLocaleString()} sub="Right now" />
        </div>
      </div>

      {/* 30-day trend charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card padding="lg">
          <p className="label mb-1">User signups</p>
          <p className="text-[15px] text-text-3 mb-4">Last 30 days</p>
          <AdminAreaChart data={userTrend30} color="#d4f050" height={140} />
        </Card>
        <Card padding="lg">
          <p className="label mb-1">Debates created</p>
          <p className="text-[15px] text-text-3 mb-4">Last 30 days</p>
          <AdminAreaChart data={debateTrend30} color="#60a5fa" height={140} />
        </Card>
      </div>

      <Separator />

      {/* Users section */}
      <div>
        <p className="label mb-3">Users</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <AdminStatCard label="Today"      value={usersToday.toLocaleString()} sub="New signups (24h)" />
          <AdminStatCard label="This week"  value={usersWeek.toLocaleString()}  sub="New signups (7d)" />
          <AdminStatCard label="This month" value={usersMonth.toLocaleString()} sub="New signups (30d)" />
          <AdminStatCard label="All time"   value={totalUsers.toLocaleString()} sub="Total registered"  accent />
        </div>
        {/* 14-day + weekly user charts */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card padding="lg">
            <p className="label mb-1">Signup trend</p>
            <p className="text-[15px] text-text-3 mb-4">Last 14 days</p>
            <AdminAreaChart data={userTrend14} color="#d4f050" height={120} />
          </Card>
          <Card padding="lg">
            <p className="label mb-1">Weekly signups</p>
            <p className="text-[15px] text-text-3 mb-4">Last 13 weeks</p>
            <AdminBarChart data={weeklyUsers} height={120} />
          </Card>
        </div>
      </div>

      <Separator />

      {/* Debates section */}
      <div>
        <p className="label mb-3">Debates</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <AdminStatCard label="Today"      value={debatesToday.toLocaleString()} sub="New debates (24h)" />
          <AdminStatCard label="This week"  value={debatesWeek.toLocaleString()}  sub="New debates (7d)" />
          <AdminStatCard label="This month" value={debatesMonth.toLocaleString()} sub="New debates (30d)" />
          <AdminStatCard label="All time"   value={totalDebates.toLocaleString()} sub="Total debates"     accent />
        </div>
        {/* 14-day + weekly debate charts */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card padding="lg">
            <p className="label mb-1">Debate creation trend</p>
            <p className="text-[15px] text-text-3 mb-4">Last 14 days</p>
            <AdminAreaChart data={debateTrend14} color="#60a5fa" height={120} />
          </Card>
          <Card padding="lg">
            <p className="label mb-1">Weekly debates</p>
            <p className="text-[15px] text-text-3 mb-4">Last 13 weeks</p>
            <AdminBarChart data={weeklyDebates} height={120} />
          </Card>
        </div>
      </div>

      <Separator />

      {/* Status + Category */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card padding="lg">
          <p className="label mb-4">Debate status breakdown</p>
          {statusData.length > 0
            ? <AdminDonutChart data={statusData} height={170} />
            : <p className="text-[15px] text-text-3">No debate data yet</p>}
        </Card>
        <Card padding="lg">
          <p className="label mb-1">Debates by category</p>
          <p className="text-[15px] text-text-3 mb-4">All time, top 8</p>
          {categoryBar.length > 0
            ? <AdminBarChart data={categoryBar} height={170} />
            : <p className="text-[15px] text-text-3">No category data yet</p>}
        </Card>
      </div>

      <Separator />

      {/* Engagement */}
      <div>
        <p className="label mb-3">Engagement overview</p>
        <div className="grid md:grid-cols-3 gap-4">

          {/* Debate outcomes */}
          <Card padding="lg">
            <p className="text-[15px] font-[500] text-text-3 uppercase tracking-wide mb-4">Debate outcomes</p>
            <div className="space-y-3">
              {[
                { label: 'Completed', val: completedDebates, color: 'var(--blue)' },
                { label: 'Active',    val: activeDebates,    color: 'var(--green)' },
                { label: 'Other',     val: Math.max(0, totalDebates - completedDebates - activeDebates), color: 'var(--text-3)' },
              ].map(({ label, val, color }) => {
                const pct = Math.round((val / Math.max(totalDebates, 1)) * 100);
                return (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[15px] text-text-2">{label}</p>
                      <p className="text-[15px] font-[500] text-text">{val.toLocaleString()} <span className="text-[13px] text-text-3">({pct}%)</span></p>
                    </div>
                    <div className="w-full bg-surface-2 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
              <Separator />
              <div className="flex items-center justify-between">
                <p className="text-[15px] text-text-2">Total</p>
                <p className="text-[15px] font-[500] text-text">{totalDebates.toLocaleString()}</p>
              </div>
            </div>
          </Card>

          {/* Active users */}
          <Card padding="lg">
            <p className="text-[15px] font-[500] text-text-3 uppercase tracking-wide mb-4">Active users</p>
            <AdminBarChart data={retentionBar} height={130} />
            <div className="space-y-2 mt-4">
              {[
                { label: 'DAU',   val: retentionD1,  note: 'Active today' },
                { label: 'WAU',   val: retentionD7,  note: 'Active this week' },
                { label: 'MAU',   val: retentionD30, note: 'Active this month' },
              ].map(({ label, val, note }) => (
                <div key={label} className="flex items-center justify-between">
                  <p className="text-[15px] text-text-2">{note}</p>
                  <p className="text-[15px] font-[500] text-text">{val.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Completion rate */}
          <Card padding="lg">
            <p className="text-[15px] font-[500] text-text-3 uppercase tracking-wide mb-4">Completion rate</p>
            <div className="flex flex-col items-center justify-center h-24">
              <p className="text-4xl font-[200] text-text">{completionPct}%</p>
              <p className="text-[15px] text-text-3 mt-1">of all debates finished</p>
            </div>
            <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden mb-3">
              <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${completionPct}%` }} />
            </div>
            <div className="flex justify-between mb-4">
              <p className="text-[14px] text-text-3">0%</p>
              <p className="text-[14px] text-text-3">100%</p>
            </div>
            <Separator className="mb-3" />
            <div className="space-y-2">
              <div className="flex justify-between">
                <p className="text-[15px] text-text-2">Completion rate</p>
                <p className="text-[15px] font-[500] text-[var(--green)]">{completionPct}%</p>
              </div>
              <div className="flex justify-between">
                <p className="text-[15px] text-text-2">Active users (7d)</p>
                <p className="text-[15px] font-[500] text-text">{activeUsers7d.toLocaleString()}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-[15px] text-text-2">Engagement rate</p>
                <p className="text-[15px] font-[500] text-text">
                  {totalUsers > 0 ? Math.round((activeUsers7d / totalUsers) * 100) : 0}%
                </p>
              </div>
            </div>
          </Card>

        </div>
      </div>

    </div>
  );
}
