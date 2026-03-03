import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/get-session';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Trophy, Users, Plus, Calendar } from 'lucide-react';

export const metadata: Metadata = { title: 'Tournaments' };
export const dynamic = 'force-dynamic';

const statusColors: Record<string, string> = {
  UPCOMING:          'muted',
  REGISTRATION_OPEN: 'green',
  IN_PROGRESS:       'blue',
  COMPLETED:         'default',
  CANCELLED:         'red',
};

const statusLabels: Record<string, string> = {
  UPCOMING:          'Upcoming',
  REGISTRATION_OPEN: 'Open',
  IN_PROGRESS:       'Live',
  COMPLETED:         'Completed',
  CANCELLED:         'Cancelled',
};

function TournamentsSkeleton() {
  return (
    <div className="p-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Skeleton height={16} width={120} className="mb-1.5" />
          <Skeleton height={10} width={260} />
        </div>
        <Skeleton height={32} width={80} className="rounded-[20px]" />
      </div>
      <Skeleton height={10} width={90} className="mb-3" />
      <div className="grid sm:grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-[var(--radius)] p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Skeleton height={18} width={50} className="rounded-[20px]" />
              <Skeleton height={12} width={60} />
            </div>
            <Skeleton height={13} width="70%" />
            <Skeleton height={10} width="90%" />
            <div className="flex items-center gap-4 pt-3 border-t border-border">
              <Skeleton height={10} width={50} />
              <Skeleton height={10} width={60} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function TournamentsData({ userId }: { userId: string }) {
  const [active, upcoming, completed] = await Promise.all([
    prisma.tournament.findMany({
      where: { status: { in: ['REGISTRATION_OPEN', 'IN_PROGRESS'] }, isPrivate: false },
      include: {
        creator: { select: { username: true } },
        _count:  { select: { participants: true } },
      },
      orderBy: { startDate: 'asc' },
      take: 20,
    }),
    prisma.tournament.findMany({
      where: { status: 'UPCOMING', isPrivate: false },
      include: {
        creator: { select: { username: true } },
        _count:  { select: { participants: true } },
      },
      orderBy: { startDate: 'asc' },
      take: 10,
    }),
    prisma.tournament.findMany({
      where: { status: 'COMPLETED', isPrivate: false },
      include: {
        creator: { select: { username: true } },
        winner:  { select: { username: true } },
        _count:  { select: { participants: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
  ]);

  return (
    <div className="p-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-sm font-[500] text-text">Tournaments</h1>
          <p className="text-[13px] text-text-3 mt-0.5">Bracket competitions with ELO-based seeding</p>
        </div>
        <Button variant="accent" size="sm" href="/tournaments/create">
          <Plus size={12} />
          Create
        </Button>
      </div>

      {/* Active / Open */}
      {active.length > 0 && (
        <section className="mb-6">
          <p className="label mb-3">Active &amp; Open</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {active.map((t) => (
              <TournamentCard key={t.id} tournament={t} userId={userId} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section className="mb-6">
          <Separator className="mb-4" />
          <p className="label mb-3">Upcoming</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {upcoming.map((t) => (
              <TournamentCard key={t.id} tournament={t} userId={userId} />
            ))}
          </div>
        </section>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <section className="mb-6">
          <Separator className="mb-4" />
          <p className="label mb-3">Completed</p>
          <div className="flex flex-col gap-2">
            {completed.map((t) => (
              <Link key={t.id} href={`/tournaments/${t.id}`} className="block">
                <Card hover padding="md" className="group">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-[450] text-text line-clamp-1 group-hover:text-accent transition-colors">
                        {t.name}
                      </p>
                      <p className="text-[13px] text-text-3 mt-0.5">
                        {t._count.participants} participants
                        {t.winner && ` · Won by ${t.winner.username}`}
                      </p>
                    </div>
                    <Badge color="muted" size="sm">Completed</Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {active.length === 0 && upcoming.length === 0 && (
        <EmptyState
          icon={<Trophy size={28} />}
          title="No active tournaments"
          description="Check back soon or create your own."
        />
      )}
    </div>
  );
}

export default async function TournamentsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return (
    <Suspense fallback={<TournamentsSkeleton />}>
      <TournamentsData userId={session.userId} />
    </Suspense>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function TournamentCard({ tournament: t, userId }: { tournament: any; userId: string }) {
  const isRegistered = false; // would need participant lookup — handle with client component or pre-fetched
  const spotsLeft = t.maxParticipants - t._count.participants;
  const startDate = new Date(t.startDate).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });

  return (
    <Link href={`/tournaments/${t.id}`}>
      <Card hover padding="lg" className="group h-full flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <Badge color={statusColors[t.status] as any} dot>
            {statusLabels[t.status] ?? t.status}
          </Badge>
          {t.prizePool && (
            <span className="text-[13px] text-accent font-[500]">{t.prizePool} coins</span>
          )}
        </div>

        <p className="text-xs font-[450] text-text mb-1 flex-1 group-hover:text-accent transition-colors">
          {t.name}
        </p>
        {t.description && (
          <p className="text-[13px] text-text-3 leading-relaxed line-clamp-2 mb-3">
            {t.description}
          </p>
        )}

        <div className="flex items-center gap-4 mt-auto pt-3 border-t border-border">
          <div className="flex items-center gap-1.5 text-[13px] text-text-3">
            <Users size={11} />
            {t._count.participants}/{t.maxParticipants}
          </div>
          <div className="flex items-center gap-1.5 text-[13px] text-text-3">
            <Calendar size={11} />
            {startDate}
          </div>
          {t.entryFee && (
            <span className="text-[13px] text-text-3 ml-auto">
              {t.entryFee} coins entry
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}
