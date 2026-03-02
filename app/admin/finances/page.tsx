import type { Metadata } from 'next';
import { prisma } from '@/lib/db/prisma';
import { AdminStatCard } from '@/components/features/admin/admin-stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = { title: 'Admin — Finances' };
export const revalidate = 60;

export default async function AdminFinancesPage() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalPurchases,
    purchasesWeek,
    purchasesMonth,
    totalSpent,
    topSpenders,
    activeSubCount,
  ] = await Promise.all([
    prisma.coinTransaction
      .aggregate({ _sum: { amount: true }, where: { type: 'COIN_PURCHASE' } })
      .catch(() => ({ _sum: { amount: 0 } })),
    prisma.coinTransaction
      .aggregate({ _sum: { amount: true }, where: { type: 'COIN_PURCHASE', createdAt: { gte: weekAgo } } })
      .catch(() => ({ _sum: { amount: 0 } })),
    prisma.coinTransaction
      .aggregate({ _sum: { amount: true }, where: { type: 'COIN_PURCHASE', createdAt: { gte: monthAgo } } })
      .catch(() => ({ _sum: { amount: 0 } })),
    prisma.coinTransaction
      .aggregate({ _sum: { amount: true }, where: { type: 'ADMIN_DEDUCT' } })
      .catch(() => ({ _sum: { amount: 0 } })),
    prisma.user.findMany({
      where: { isAI: false },
      orderBy: { coins: 'desc' },
      take: 10,
      select: { id: true, username: true, coins: true },
    }),
    prisma.userSubscription
      .count({ where: { status: 'ACTIVE' } })
      .catch(() => 0),
  ]);

  const subsByTier = await prisma.userSubscription
    .groupBy({ by: ['tier'], _count: true })
    .catch(() => [] as Array<{ tier: string; _count: number }>);

  const totalPurchasedCoins = totalPurchases._sum?.amount ?? 0;
  const weekPurchasedCoins  = purchasesWeek._sum?.amount ?? 0;
  const monthPurchasedCoins = purchasesMonth._sum?.amount ?? 0;
  const totalSpentCoins     = totalSpent._sum?.amount ?? 0;
  const circulatingCoins    = totalPurchasedCoins - totalSpentCoins;

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">Finances</h1>
        <p className="text-[15px] text-text-3 mt-0.5">
          Coin economy and subscription overview
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <AdminStatCard
          label="Total coins purchased"
          value={totalPurchasedCoins.toLocaleString()}
          sub="All time"
          accent
        />
        <AdminStatCard
          label="Purchases this week"
          value={weekPurchasedCoins.toLocaleString()}
          sub="7-day window"
        />
        <AdminStatCard
          label="Purchases this month"
          value={monthPurchasedCoins.toLocaleString()}
          sub="30-day window"
        />
        <AdminStatCard
          label="Active subscriptions"
          value={activeSubCount.toLocaleString()}
          sub="Currently active"
        />
      </div>

      {/* Economy breakdown row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <AdminStatCard
          label="Total coins spent"
          value={totalSpentCoins.toLocaleString()}
          sub="All time spend"
        />
        <AdminStatCard
          label="Circulating coins"
          value={Math.max(0, circulatingCoins).toLocaleString()}
          sub="Purchased minus spent"
        />
        <AdminStatCard
          label="Spend rate"
          value={`${Math.round((totalSpentCoins / Math.max(totalPurchasedCoins, 1)) * 100)}%`}
          sub="Spent of purchased"
        />
      </div>

      <Separator className="mb-6" />

      <div className="grid lg:grid-cols-2 gap-4">

        {/* Subscription breakdown */}
        <Card padding="lg">
          <div className="flex items-center justify-between mb-4">
            <p className="label">Subscriptions by tier</p>
            <Badge color="muted" size="sm">{activeSubCount} active</Badge>
          </div>

          {subsByTier.length === 0 ? (
            <p className="text-xs text-text-3">No subscription data available.</p>
          ) : (
            <div className="overflow-hidden rounded-[var(--radius)] border border-border">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-2.5 bg-surface-2 border-b border-border">
                <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Tier</p>
                <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide text-right">Subscribers</p>
              </div>

              {/* Table rows */}
              <div className="divide-y divide-border">
                {subsByTier
                  .sort((a, b) => b._count - a._count)
                  .map((tier) => (
                    <div
                      key={tier.tier}
                      className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3 items-center"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          color={
                            tier.tier === 'PRO' ? 'accent' :
                            tier.tier === 'PREMIUM' ? 'blue' :
                            tier.tier === 'ELITE' ? 'amber' :
                            'muted'
                          }
                          size="sm"
                        >
                          {tier.tier}
                        </Badge>
                      </div>
                      <p className="text-xs font-[500] text-text text-right">
                        {tier._count.toLocaleString()}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </Card>

        {/* Top coin holders */}
        <Card padding="lg">
          <div className="flex items-center justify-between mb-4">
            <p className="label">Top coin holders</p>
            <p className="text-[15px] text-text-3">By current balance</p>
          </div>

          {topSpenders.length === 0 ? (
            <p className="text-xs text-text-3">No user data available.</p>
          ) : (
            <div className="space-y-2">
              {topSpenders.map((user, i) => (
                <div key={user.id} className="flex items-center gap-3">
                  <p className="text-[14px] text-text-3 w-5 flex-shrink-0 text-right">
                    {i + 1}
                  </p>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text truncate font-[450]">
                      {user.username ?? '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <p className="text-xs font-[500] text-text">
                      {(user.coins ?? 0).toLocaleString()}
                    </p>
                    <p className="text-[14px] text-text-3">coins</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>

      <Separator className="my-6" />

      {/* Economy health summary */}
      <Card padding="lg">
        <p className="label mb-4">Economy health</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-2xl font-[200] text-text">{totalPurchasedCoins.toLocaleString()}</p>
            <p className="text-[15px] text-text-3 mt-0.5">Total minted</p>
          </div>
          <div>
            <p className="text-2xl font-[200] text-text">{totalSpentCoins.toLocaleString()}</p>
            <p className="text-[15px] text-text-3 mt-0.5">Total burned</p>
          </div>
          <div>
            <p className="text-2xl font-[200] text-accent">{Math.max(0, circulatingCoins).toLocaleString()}</p>
            <p className="text-[15px] text-text-3 mt-0.5">In circulation</p>
          </div>
          <div>
            <p className="text-2xl font-[200] text-text">{weekPurchasedCoins.toLocaleString()}</p>
            <p className="text-[15px] text-text-3 mt-0.5">Minted this week</p>
          </div>
        </div>
      </Card>

    </div>
  );
}
