import type { Metadata } from 'next';
import { prisma } from '@/lib/db/prisma';
import { AdminStatCard } from '@/components/features/admin/admin-stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = { title: 'Admin — Advertisements' };
export const revalidate = 60;

type AdStatus = 'ACTIVE' | 'PAUSED' | 'ENDED' | 'DRAFT' | 'PENDING';
type BadgeColor = 'green' | 'muted' | 'amber' | 'red' | 'blue';

const statusColors: Record<AdStatus, BadgeColor> = {
  ACTIVE:  'green',
  PAUSED:  'amber',
  ENDED:   'muted',
  DRAFT:   'muted',
  PENDING: 'blue',
};

const statusLabels: Record<AdStatus, string> = {
  ACTIVE:  'Active',
  PAUSED:  'Paused',
  ENDED:   'Ended',
  DRAFT:   'Draft',
  PENDING: 'Pending',
};

function typeColor(type: string): BadgeColor {
  const t = type.toUpperCase();
  if (t.includes('BANNER')) return 'blue';
  if (t.includes('VIDEO')) return 'amber';
  if (t.includes('NATIVE')) return 'green';
  return 'muted';
}

export default async function AdminAdvertisementsPage() {
  const [total, active, totalImpressions, totalClicks, ads] = await Promise.all([
    prisma.advertisement.count().catch(() => 0),
    prisma.advertisement.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
    prisma.advertisement
      .aggregate({ _sum: { impressions: true } })
      .then((r) => r._sum.impressions ?? 0)
      .catch(() => 0),
    prisma.advertisement
      .aggregate({ _sum: { clicks: true } })
      .then((r) => r._sum.clicks ?? 0)
      .catch(() => 0),
    prisma.advertisement.findMany({
      take: 30,
      orderBy: { createdAt: 'desc' },
    }).catch(() => []),
  ]);

  const overallCtr = totalImpressions > 0
    ? ((totalClicks / totalImpressions) * 100).toFixed(2) + '%'
    : '0.00%';

  return (
    <div className="p-6 max-w-7xl mx-auto">

      <div className="mb-6">
        <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">Advertisements</h1>
        <p className="text-[15px] text-text-3 mt-0.5">{total.toLocaleString()} total ads</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <AdminStatCard label="Total" value={total.toLocaleString()} />
        <AdminStatCard label="Active" value={active} accent={active > 0} />
        <AdminStatCard label="Total impressions" value={totalImpressions.toLocaleString()} />
        <AdminStatCard label="Total clicks" value={totalClicks.toLocaleString()} sub={`CTR: ${overallCtr}`} />
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="grid grid-cols-[3fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-2.5 border-b border-border bg-surface-2">
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Title</p>
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Type</p>
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Status</p>
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Impressions</p>
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Clicks</p>
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">CTR</p>
        </div>

        {ads.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-xs text-text-3">No advertisements found.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {ads.map((ad) => {
              const status = ((ad as { status?: string | null }).status ?? 'DRAFT').toUpperCase() as AdStatus;
              const type = ((ad as { type?: string | null }).type ?? '').toUpperCase();
              const impressions = (ad as { impressions?: number | null }).impressions ?? 0;
              const clicks = (ad as { clicks?: number | null }).clicks ?? 0;
              const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) + '%' : '—';
              const title = (ad as { title?: string | null }).title ?? '—';

              const sColor: BadgeColor = statusColors[status] ?? 'muted';
              const sLabel = statusLabels[status] ?? status;
              const tColor: BadgeColor = typeColor(type);

              return (
                <div
                  key={ad.id}
                  className="grid grid-cols-[3fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-3 items-center hover:bg-surface-2 transition-colors duration-100"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-text font-[450] line-clamp-1">{title}</p>
                    <p className="text-[15px] text-text-3 mt-0.5">ID: {ad.id.slice(0, 8)}</p>
                  </div>

                  <div>
                    {type ? (
                      <Badge color={tColor} size="sm">{type}</Badge>
                    ) : (
                      <span className="text-[15px] text-text-3">—</span>
                    )}
                  </div>

                  <div>
                    <Badge color={sColor} size="sm" dot>{sLabel}</Badge>
                  </div>

                  <p className="text-xs text-text-2">{impressions.toLocaleString()}</p>
                  <p className="text-xs text-text-2">{clicks.toLocaleString()}</p>
                  <p className="text-xs text-text-2">{ctr}</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {ads.length === 30 && (
        <p className="text-[15px] text-text-3 text-center mt-4">Showing first 30 results.</p>
      )}
    </div>
  );
}
