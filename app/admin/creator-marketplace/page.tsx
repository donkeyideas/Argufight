import type { Metadata } from 'next';
import { prisma } from '@/lib/db/prisma';
import { AdminStatCard } from '@/components/features/admin/admin-stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = { title: 'Admin — Creator Marketplace' };
export const revalidate = 60;

type BadgeColor = 'green' | 'muted' | 'amber' | 'blue' | 'red';

function listingTypeColor(type: string): BadgeColor {
  const t = type.toUpperCase();
  if (t.includes('BANNER')) return 'blue';
  if (t.includes('DEBATE')) return 'amber';
  if (t.includes('WIDGET')) return 'green';
  if (t.includes('PROFILE')) return 'muted';
  return 'muted';
}

function listingStatusColor(status: string): BadgeColor {
  const s = status.toUpperCase();
  if (s === 'ACTIVE') return 'green';
  if (s === 'PENDING') return 'amber';
  if (s === 'REJECTED') return 'red';
  if (s === 'SOLD') return 'blue';
  return 'muted';
}

export default async function AdminCreatorMarketplacePage() {
  const [total, active, listings] = await Promise.all([
    prisma.offer.count().catch(() => 0),
    prisma.offer.count({ where: { status: 'ACCEPTED' } }).catch(() => 0),
    prisma.offer.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        creator: { select: { username: true } },
      },
    }).catch(() => []),
  ]);

  return (
    <div className="p-6 max-w-7xl mx-auto">

      <div className="mb-6">
        <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">Creator Marketplace</h1>
        <p className="text-[15px] text-text-3 mt-0.5">{total.toLocaleString()} total listings</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 gap-3 mb-6">
        <AdminStatCard label="Total listings" value={total.toLocaleString()} />
        <AdminStatCard label="Active" value={active} accent={active > 0} />
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-4 px-4 py-2.5 border-b border-border bg-surface-2">
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Creator</p>
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Type</p>
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Price</p>
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Status</p>
          <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Date</p>
        </div>

        {listings.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-xs text-text-3">No marketplace listings found.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {listings.map((listing) => {
              const type = listing.placement ?? '';
              const status = listing.status ?? 'PENDING';
              const price = listing.amount ? Number(listing.amount) : null;

              const tColor: BadgeColor = listingTypeColor(String(type));
              const sColor: BadgeColor = listingStatusColor(String(status));

              return (
                <div
                  key={listing.id}
                  className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-4 px-4 py-3 items-center hover:bg-surface-2 transition-colors duration-100"
                >
                  <p className="text-xs text-text font-[450] truncate">
                    {listing.creator?.username ?? '—'}
                  </p>

                  <div>
                    {type ? (
                      <Badge color={tColor} size="sm">{type}</Badge>
                    ) : (
                      <span className="text-[15px] text-text-3">—</span>
                    )}
                  </div>

                  <p className="text-xs text-text-2">
                    {price != null ? `$${price.toFixed(2)}` : '—'}
                  </p>

                  <div>
                    <Badge color={sColor} size="sm" dot>
                      {status.charAt(0) + status.slice(1).toLowerCase()}
                    </Badge>
                  </div>

                  <p className="text-[15px] text-text-3">
                    {new Date(listing.createdAt).toLocaleDateString('en-US', {
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

      {listings.length === 20 && (
        <p className="text-[15px] text-text-3 text-center mt-4">Showing first 20 results.</p>
      )}
    </div>
  );
}
