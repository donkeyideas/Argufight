import type { Metadata } from 'next';
import { prisma } from '@/lib/db/prisma';
import { AdminStatCard } from '@/components/features/admin/admin-stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = { title: 'Admin — Plans' };
export const revalidate = 60;

export default async function AdminPlansPage() {
  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { price: 'asc' },
  }).catch(() => []);

  return (
    <div className="p-6 max-w-7xl mx-auto">

      <div className="mb-6">
        <h1 className="text-xl font-[600] text-text tracking-[-0.3px]">Subscription Plans</h1>
        <p className="text-[15px] text-text-3 mt-0.5">{plans.length} plan{plans.length !== 1 ? 's' : ''} configured</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <AdminStatCard label="Total plans" value={plans.length} />
        <AdminStatCard
          label="Free plans"
          value={plans.filter((p) => Number(p.price) === 0).length}
        />
        <AdminStatCard
          label="Paid plans"
          value={plans.filter((p) => Number(p.price) > 0).length}
        />
        <AdminStatCard
          label="Avg price"
          value={
            plans.length > 0
              ? '$' + (plans.reduce((sum, p) => sum + Number(p.price), 0) / plans.length).toFixed(2)
              : '—'
          }
        />
      </div>

      {plans.length === 0 ? (
        <Card padding="lg">
          <p className="text-xs text-text-3 text-center">No subscription plans configured.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const price = Number(plan.price);
            const billingCycle = plan.billingCycle;
            const description = plan.description;
            const featuresRaw = plan.features;
            const appealLimit = plan.appealLimit;
            const debateLimit = plan.debateLimit;
            const prioritySupport = plan.prioritySupport;
            const customBadge = plan.customBadge;

            let featuresList: string[] = [];
            if (featuresRaw) {
              try {
                const parsed = JSON.parse(featuresRaw);
                featuresList = Array.isArray(parsed)
                  ? parsed.map(String)
                  : Object.values(parsed).map(String);
              } catch {
                featuresList = [featuresRaw];
              }
            }

            return (
              <Card key={plan.id} padding="lg" className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-[600] text-text tracking-[-0.3px]">{plan.name}</p>
                    {description && (
                      <p className="text-[15px] text-text-3 mt-0.5">{description}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-[200] text-text">
                      {price === 0 ? 'Free' : `$${price.toFixed(2)}`}
                    </p>
                    {billingCycle && price > 0 && (
                      <p className="text-[14px] text-text-3 capitalize">
                        per {billingCycle.toLowerCase()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="h-px bg-border" />

                <div className="space-y-2">
                  <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Limits</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge color="muted" size="sm">
                      {debateLimit == null ? 'Unlimited debates' : `${debateLimit} debates`}
                    </Badge>
                    <Badge color="muted" size="sm">
                      {appealLimit == null ? 'Unlimited appeals' : `${appealLimit} appeals`}
                    </Badge>
                    {prioritySupport && (
                      <Badge color="blue" size="sm">Priority support</Badge>
                    )}
                    {customBadge && (
                      <Badge color="accent" size="sm">Custom badge</Badge>
                    )}
                  </div>
                </div>

                {featuresList.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[14px] font-[500] text-text-3 uppercase tracking-wide">Features</p>
                    <ul className="space-y-1">
                      {featuresList.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-accent mt-0.5 flex-shrink-0 text-[14px]">+</span>
                          <span className="text-[15px] text-text-2">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-auto pt-2">
                  <p className="text-[14px] text-text-3">ID: {plan.id.slice(0, 8)}</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
