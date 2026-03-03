import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/get-session';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import Link from 'next/link';
import { Swords, Clock, CheckCircle, XCircle, Minus } from 'lucide-react';
import { cn } from '@/lib/cn';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Debate History' };

export default async function DebateHistoryPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const userId = session.userId;

  const debates = await prisma.debate.findMany({
    where: {
      OR: [{ challengerId: userId }, { opponentId: userId }],
      status: { in: ['COMPLETED', 'VERDICT_READY', 'APPEALED', 'CANCELLED'] },
    },
    include: {
      challenger: { select: { id: true, username: true, avatarUrl: true, eloRating: true } },
      opponent:   { select: { id: true, username: true, avatarUrl: true, eloRating: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="heading-1 mb-1">Debate History</h1>
        <p className="text-xs text-text-3">{debates.length} completed debate{debates.length !== 1 ? 's' : ''}</p>
      </div>

      {debates.length === 0 ? (
        <EmptyState
          icon={<Swords size={32} />}
          title="No debates yet"
          description="Accept or create a challenge to get started."
          action={
            <Link href="/dashboard" className="text-xs text-accent hover:underline">
              Go to dashboard
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {debates.map((debate) => {
            const isChallenger = debate.challengerId === userId;
            const opponent = isChallenger ? debate.opponent : debate.challenger;
            const won = debate.winnerId === userId;
            const lost = debate.winnerId && debate.winnerId !== userId;
            const tied = debate.status === 'COMPLETED' && !debate.winnerId;
            const eloChange = isChallenger ? debate.challengerEloChange : debate.opponentEloChange;

            return (
              <Link key={debate.id} href={`/debate/${debate.id}`}>
                <Card hover padding="md" className="group">
                  <div className="flex items-center gap-4">
                    {/* Result icon */}
                    <div className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
                      won ? 'bg-[var(--green-muted)]' : lost ? 'bg-[var(--red-muted)]' : 'bg-surface-2'
                    )}>
                      {won ? <CheckCircle size={14} className="text-[var(--green)]" />
                        : lost ? <XCircle size={14} className="text-[var(--red)]" />
                        : <Minus size={14} className="text-text-3" />}
                    </div>

                    {/* Topic */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-[450] text-text leading-tight line-clamp-1 group-hover:text-accent transition-colors mb-1">
                        {debate.topic}
                      </p>
                      <div className="flex items-center gap-2">
                        <Avatar src={opponent?.avatarUrl} fallback={opponent?.username} size="xs" />
                        <span className="text-[13px] text-text-3">vs {opponent?.username ?? 'Open'}</span>
                        <span className="text-text-3">·</span>
                        <span className="text-[13px] text-text-3 flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(debate.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    {/* ELO change */}
                    <div className="text-right flex-shrink-0">
                      {eloChange !== null && eloChange !== undefined && (
                        <p className={cn(
                          'text-xs font-[500]',
                          eloChange > 0 ? 'text-[var(--green)]' : eloChange < 0 ? 'text-[var(--red)]' : 'text-text-3'
                        )}>
                          {eloChange > 0 ? '+' : ''}{eloChange}
                        </p>
                      )}
                      <Badge
                        color={won ? 'green' : lost ? 'red' : 'muted'}
                        size="sm"
                        className="mt-0.5"
                      >
                        {won ? 'Won' : lost ? 'Lost' : tied ? 'Tie' : debate.status}
                      </Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
