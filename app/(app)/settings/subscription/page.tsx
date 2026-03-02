import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/get-session';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, CreditCard } from 'lucide-react';

export const metadata: Metadata = { title: 'Subscription' };

export default async function SubscriptionPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const subscription = await prisma.userSubscription.findUnique({
    where: { userId: session.userId },
  });

  const tierLabel: Record<string, string> = {
    FREE:         'Free',
    PRO:          'Pro',
    CHAMPION:     'Champion',
    ELITE:        'Elite',
  };

  const tierFeatures: Record<string, string[]> = {
    FREE:     ['5 debates per month', '1 belt challenge per month', 'Standard judge access', 'Community support'],
    PRO:      ['Unlimited debates', '3 belt challenges per month', 'Priority judges', 'Appeal limit: 3/month', 'Email support'],
    CHAMPION: ['Unlimited debates', '10 belt challenges', 'Premium judges', 'Unlimited appeals', 'Priority support', 'Custom badge'],
    ELITE:    ['Unlimited everything', 'All judges', 'Unlimited appeals', 'Dedicated support', 'Custom badge', 'Revenue sharing'],
  };

  const tier = subscription?.tier ?? 'FREE';
  const features = tierFeatures[tier] ?? tierFeatures.FREE;
  const periodEnd = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null;

  return (
    <div className="p-5 max-w-2xl mx-auto">
      <h1 className="text-sm font-[500] text-text mb-6">Subscription</h1>

      {/* Current plan */}
      <Card padding="lg" className="mb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-text-3 mb-1">Current plan</p>
            <p className="text-2xl font-[200] text-text">{tierLabel[tier] ?? tier}</p>
            {subscription?.billingCycle && (
              <p className="text-[13px] text-text-3 mt-1 capitalize">{subscription.billingCycle}</p>
            )}
          </div>
          <Badge color={tier === 'FREE' ? 'muted' : 'accent'}>
            {subscription?.status ?? 'Active'}
          </Badge>
        </div>

        <div className="space-y-2 mb-5">
          {features.map((f) => (
            <div key={f} className="flex items-center gap-2">
              <CheckCircle size={12} className="text-[var(--green)] flex-shrink-0" />
              <p className="text-xs text-text-2">{f}</p>
            </div>
          ))}
        </div>

        {periodEnd && (
          <p className="text-[13px] text-text-3 mb-4">
            Renews {periodEnd}
          </p>
        )}

        <div className="flex gap-2">
          {tier === 'FREE' ? (
            <Button variant="accent" size="sm" href="/upgrade">
              Upgrade plan
            </Button>
          ) : (
            <>
              <Button variant="secondary" size="sm" href="/upgrade">
                Change plan
              </Button>
              <Button variant="ghost" size="sm">
                Cancel subscription
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* Billing */}
      {subscription?.stripeCustomerId && (
        <Card padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={14} className="text-text-3" />
            <h2 className="text-sm font-[500] text-text">Billing</h2>
          </div>
          <Separator className="mb-4" />
          <Button variant="secondary" size="sm">
            Manage billing
          </Button>
        </Card>
      )}
    </div>
  );
}
