import type { Metadata } from 'next';
import { prisma } from '@/lib/db/prisma';
import { AdminStatCard } from '@/components/features/admin/admin-stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Admin — Marketing' };
export const revalidate = 60;

const MegaphoneIcon = (
  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 11v2a1 1 0 0 0 1 1h1l2 5h2l-1-5h8l3 3V5l-3 3H7L5 7H4a1 1 0 0 0-1 1v1" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 12h-1" strokeLinecap="round" />
  </svg>
);

const MailIcon = (
  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m2 7 10 7 10-7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UsersIcon = (
  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default async function AdminMarketingPage() {
  const [totalCampaigns, activeCampaigns, campaigns] = await Promise.all([
    (prisma as unknown as { marketingCampaign: { count: () => Promise<number> } }).marketingCampaign
      ?.count().catch(() => 0) ?? Promise.resolve(0),
    (prisma as unknown as { marketingCampaign: { count: (a: unknown) => Promise<number> } }).marketingCampaign
      ?.count({ where: { status: 'ACTIVE' } }).catch(() => 0) ?? Promise.resolve(0),
    (prisma as unknown as { marketingCampaign: { findMany: (a: unknown) => Promise<Array<{ id: string; name?: string | null; status?: string | null; createdAt: Date }>> } }).marketingCampaign
      ?.findMany({ take: 10, orderBy: { createdAt: 'desc' } }).catch(() => []) ?? Promise.resolve([]),
  ]);

  return (
    <div className="p-6 max-w-7xl mx-auto">

      <div className="mb-6">
        <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">Marketing</h1>
        <p className="text-[15px] text-text-3 mt-0.5">Campaigns, broadcasts, and referrals</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <AdminStatCard label="Total campaigns" value={totalCampaigns.toLocaleString()} />
        <AdminStatCard label="Active campaigns" value={activeCampaigns} accent={activeCampaigns > 0} />
        <AdminStatCard label="Email broadcasts" value={0} sub="Coming soon" />
      </div>

      {/* Campaigns section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-[500] text-text">Campaigns</h2>
        </div>

        {campaigns.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={MegaphoneIcon}
              title="No campaigns"
              description="Create your first marketing campaign to reach users."
            />
          </Card>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <div className="grid grid-cols-[3fr_1fr_1fr] gap-4 px-4 py-2.5 border-b border-border bg-surface-2">
              <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Name</p>
              <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Status</p>
              <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Created</p>
            </div>
            <div className="divide-y divide-border">
              {campaigns.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-[3fr_1fr_1fr] gap-4 px-4 py-3 items-center hover:bg-surface-2 transition-colors duration-100"
                >
                  <p className="text-xs text-text font-[450] truncate">{c.name ?? '—'}</p>
                  <div>
                    <Badge
                      color={c.status === 'ACTIVE' ? 'green' : c.status === 'DRAFT' ? 'muted' : 'amber'}
                      size="sm"
                      dot
                    >
                      {c.status ?? '—'}
                    </Badge>
                  </div>
                  <p className="text-[15px] text-text-3">
                    {new Date(c.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: '2-digit',
                    })}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Email broadcasts placeholder */}
      <div className="mb-8">
        <h2 className="text-xs font-[500] text-text mb-4">Email Broadcasts</h2>
        <Card padding="none">
          <EmptyState
            icon={MailIcon}
            title="Email broadcasts"
            description="Bulk email functionality is not yet configured. Set up an email provider to enable broadcasts."
          />
        </Card>
      </div>

      {/* Referrals placeholder */}
      <div>
        <h2 className="text-xs font-[500] text-text mb-4">Referrals</h2>
        <Card padding="none">
          <EmptyState
            icon={UsersIcon}
            title="Referral program"
            description="Referral tracking and rewards will appear here once the referral system is enabled."
          />
        </Card>
      </div>
    </div>
  );
}
