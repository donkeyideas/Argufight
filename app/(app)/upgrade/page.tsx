import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/get-session';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/cn';

export const metadata: Metadata = { title: 'Upgrade' };
export const revalidate = 3600;

const TIERS = [
  {
    key: 'FREE',
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Get started with the basics',
    features: [
      '5 debates per month',
      '1 belt challenge per month',
      'Standard AI judges',
      'Community support',
    ],
    accent: false,
  },
  {
    key: 'PRO',
    name: 'Pro',
    price: '$9',
    period: 'month',
    description: 'For serious debaters',
    features: [
      'Unlimited debates',
      '3 belt challenges per month',
      'Priority AI judges',
      '3 appeals per month',
      'Custom profile badge',
      'Email support',
    ],
    accent: false,
  },
  {
    key: 'CHAMPION',
    name: 'Champion',
    price: '$29',
    period: 'month',
    description: 'For competitive champions',
    features: [
      'Unlimited debates',
      '10 belt challenges',
      'All premium judges',
      'Unlimited appeals',
      'Custom badge + border',
      'Priority support',
      'Analytics dashboard',
    ],
    accent: true,
  },
  {
    key: 'ELITE',
    name: 'Elite',
    price: '$99',
    period: 'month',
    description: 'For creators &amp; pros',
    features: [
      'Everything in Champion',
      'Revenue sharing',
      'Creator marketplace access',
      'Dedicated account manager',
      'API access',
      'White-label debates',
    ],
    accent: false,
  },
];

export default async function UpgradePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const subscription = await prisma.userSubscription.findUnique({
    where: { userId: session.userId },
    select: { tier: true, status: true },
  });

  const currentTier = subscription?.tier ?? 'FREE';

  return (
    <div className="p-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <Badge color="accent" className="mb-4">Upgrade</Badge>
        <h1 className="text-2xl font-[200] text-text mb-3">
          Level up your debate game
        </h1>
        <p className="text-sm text-text-2 font-[300] max-w-md mx-auto">
          More debates, better judges, higher stakes. Choose the plan that fits your ambition.
        </p>
      </div>

      {/* Plans grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {TIERS.map((tier) => {
          const isCurrent = tier.key === currentTier;
          return (
            <div
              key={tier.key}
              className={cn(
                'rounded-[var(--radius)] border p-5 flex flex-col relative',
                tier.accent
                  ? 'bg-surface border-[rgba(212,240,80,0.25)] shadow-[0_0_30px_rgba(212,240,80,0.05)]'
                  : 'bg-surface border-border'
              )}
            >
              {tier.accent && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <Badge color="accent" className="text-[12px]">
                    <Zap size={9} />
                    Most popular
                  </Badge>
                </div>
              )}

              <div className="mb-4">
                <p className="text-xs font-[500] text-text">{tier.name}</p>
                <div className="flex items-end gap-1 mt-1">
                  <span className="text-2xl font-[200] text-text">{tier.price}</span>
                  {tier.period !== 'forever' && (
                    <span className="text-[13px] text-text-3 mb-1">/{tier.period}</span>
                  )}
                </div>
                <p className="text-[13px] text-text-3 mt-1">{tier.description}</p>
              </div>

              <Separator className="mb-4" />

              <div className="space-y-2.5 flex-1 mb-5">
                {tier.features.map((f) => (
                  <div key={f} className="flex items-start gap-2">
                    <CheckCircle size={11} className="text-[var(--green)] flex-shrink-0 mt-0.5" />
                    <p className="text-[13px] text-text-2" dangerouslySetInnerHTML={{ __html: f }} />
                  </div>
                ))}
              </div>

              {isCurrent ? (
                <Button variant="secondary" size="sm" disabled fullWidth>
                  Current plan
                </Button>
              ) : tier.key === 'FREE' ? (
                <Button variant="ghost" size="sm" fullWidth href="/settings/subscription">
                  Downgrade
                </Button>
              ) : (
                <Button
                  variant={tier.accent ? 'accent' : 'secondary'}
                  size="sm"
                  fullWidth
                  href={`/api/stripe/checkout?tier=${tier.key}`}
                >
                  Upgrade to {tier.name}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <Card padding="lg">
        <p className="label mb-4">Frequently asked</p>
        <div className="space-y-4">
          {[
            {
              q: 'Can I cancel anytime?',
              a: 'Yes. Cancel any time from your settings. You keep access until the end of your billing period.',
            },
            {
              q: 'What happens to my belts if I downgrade?',
              a: "You keep any belts you've earned. Challenge limits apply going forward.",
            },
            {
              q: 'Do you offer annual billing?',
              a: 'Yes, annual plans save 20%. Contact support or choose annual at checkout.',
            },
          ].map((faq) => (
            <div key={faq.q}>
              <p className="text-xs font-[450] text-text mb-1">{faq.q}</p>
              <p className="text-[13px] text-text-2 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
