import type { Metadata } from 'next';
import { prisma } from '@/lib/db/prisma';
import { AdminStatCard } from '@/components/features/admin/admin-stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Admin — Creator Taxes' };
export const revalidate = 60;

type BadgeColor = 'green' | 'muted' | 'amber' | 'red' | 'blue';

const ReceiptIcon = (
  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M4 2v20l3-3 3 3 3-3 3 3 3-3V2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 7h6M9 11h6M9 15h4" strokeLinecap="round" />
  </svg>
);

function taxStatusColor(status: string): BadgeColor {
  const s = status.toUpperCase();
  if (s === 'COMPLETE' || s === 'FILED' || s === 'SUBMITTED') return 'green';
  if (s === 'PENDING' || s === 'AWAITING') return 'amber';
  if (s === 'OVERDUE' || s === 'REJECTED') return 'red';
  if (s === 'DRAFT') return 'muted';
  return 'muted';
}

export default async function AdminCreatorTaxesPage() {
  let taxDocs: Array<{
    id: string;
    userId?: string | null;
    year?: number | null;
    formType?: string | null;
    status?: string | null;
    createdAt?: Date | null;
  }> = [];
  let total = 0;

  try {
    const model = (prisma as unknown as {
      creatorTaxDocument?: {
        count: () => Promise<number>;
        findMany: (a: unknown) => Promise<typeof taxDocs>;
      };
    }).creatorTaxDocument;

    if (model) {
      [total, taxDocs] = await Promise.all([
        model.count().catch(() => 0),
        model.findMany({ take: 20, orderBy: { createdAt: 'desc' } }).catch(() => []),
      ]);
    }
  } catch {
    // Model may not exist
  }

  const pending = taxDocs.filter(
    (d) => (d.status ?? '').toUpperCase() === 'PENDING' || (d.status ?? '').toUpperCase() === 'AWAITING'
  ).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">

      <div className="mb-6">
        <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">Creator Taxes</h1>
        <p className="text-[15px] text-text-3 mt-0.5">{total.toLocaleString()} tax document{total !== 1 ? 's' : ''}</p>
      </div>

      {taxDocs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <AdminStatCard label="Total documents" value={total.toLocaleString()} />
          <AdminStatCard label="Pending" value={pending} accent={pending > 0} sub={pending > 0 ? 'Awaiting action' : 'None'} />
          <AdminStatCard
            label="Filed"
            value={taxDocs.filter((d) => {
              const s = (d.status ?? '').toUpperCase();
              return s === 'FILED' || s === 'COMPLETE' || s === 'SUBMITTED';
            }).length}
          />
        </div>
      )}

      <Card padding="none" className="overflow-hidden">
        {taxDocs.length === 0 ? (
          <EmptyState
            icon={ReceiptIcon}
            title="No tax documents"
            description="Creator tax documents appear here once creators submit their information."
          />
        ) : (
          <>
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-2.5 border-b border-border bg-surface-2">
              <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">User ID</p>
              <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Year</p>
              <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Form type</p>
              <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Status</p>
              <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Date</p>
            </div>

            <div className="divide-y divide-border">
              {taxDocs.map((doc) => {
                const status = doc.status ?? 'PENDING';
                const sColor: BadgeColor = taxStatusColor(status);

                return (
                  <div
                    key={doc.id}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-3 items-center hover:bg-surface-2 transition-colors duration-100"
                  >
                    <p className="text-xs text-text-2 font-mono truncate">
                      {doc.userId ? doc.userId.slice(0, 12) + '…' : '—'}
                    </p>

                    <p className="text-xs text-text-2">{doc.year ?? '—'}</p>

                    <p className="text-xs text-text-2">{doc.formType ?? '—'}</p>

                    <div>
                      <Badge color={sColor} size="sm" dot>
                        {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
                      </Badge>
                    </div>

                    <p className="text-[15px] text-text-3">
                      {doc.createdAt
                        ? new Date(doc.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: '2-digit',
                          })
                        : '—'}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {taxDocs.length === 20 && (
        <p className="text-[15px] text-text-3 text-center mt-4">Showing first 20 results.</p>
      )}
    </div>
  );
}
