import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/get-session';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/ui/empty-state';
import Link from 'next/link';
import { Trophy, Users, Calendar, Swords, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = await prisma.tournament.findUnique({ where: { id }, select: { name: true } });
  return { title: t ? t.name : 'Tournament' };
}

export default async function TournamentPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, username: true, avatarUrl: true } },
      winner:  { select: { id: true, username: true, avatarUrl: true } },
      judge:   { select: { id: true, name: true, emoji: true } },
      participants: {
        include: { user: { select: { id: true, username: true, avatarUrl: true, eloRating: true } } },
        orderBy: { seed: 'asc' },
      },
      rounds: {
        include: {
          matches: {
            include: {
              participant1: { include: { user: { select: { id: true, username: true } } } },
              participant2: { include: { user: { select: { id: true, username: true } } } },
              winner:       { include: { user: { select: { id: true, username: true } } } },
            },
          },
        },
        orderBy: { roundNumber: 'asc' },
      },
      _count: { select: { participants: true } },
    },
  });

  if (!tournament) notFound();

  const isParticipant = tournament.participants.some(
    (p) => p.userId === session.userId
  );
  const isCreator = tournament.creatorId === session.userId;
  const spotsLeft = tournament.maxParticipants - tournament._count.participants;
  const canRegister =
    tournament.status === 'REGISTRATION_OPEN' && !isParticipant && spotsLeft > 0;
  const startDate = new Date(tournament.startDate).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const statusColors: Record<string, string> = {
    UPCOMING: 'muted', REGISTRATION_OPEN: 'green',
    IN_PROGRESS: 'blue', COMPLETED: 'default', CANCELLED: 'red',
  };
  const statusLabels: Record<string, string> = {
    UPCOMING: 'Upcoming', REGISTRATION_OPEN: 'Registration open',
    IN_PROGRESS: 'In progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
  };

  return (
    <div className="p-5 max-w-4xl mx-auto">
      {/* Header card */}
      <Card padding="lg" className="mb-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge color={statusColors[tournament.status] as any} dot>
                {statusLabels[tournament.status] ?? tournament.status}
              </Badge>
              {tournament.prizePool && (
                <Badge color="amber">
                  <Trophy size={10} />
                  {tournament.prizePool} coins prize
                </Badge>
              )}
            </div>
            <h1 className="text-lg font-[500] text-text mb-1">{tournament.name}</h1>
            {tournament.description && (
              <p className="text-xs text-text-2 leading-relaxed">{tournament.description}</p>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {canRegister && (
              <form action={`/api/tournaments/${tournament.id}/join`} method="POST">
                <Button variant="accent" size="sm" type="submit">
                  {tournament.entryFee ? `Join · ${tournament.entryFee} coins` : 'Join free'}
                </Button>
              </form>
            )}
            {isCreator && tournament.status === 'UPCOMING' && (
              <Button variant="secondary" size="sm" href={`/tournaments/${tournament.id}/manage`}>
                Manage
              </Button>
            )}
          </div>
        </div>

        <Separator className="mb-4" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Participants', value: `${tournament._count.participants}/${tournament.maxParticipants}` },
            { label: 'Spots left',   value: spotsLeft > 0 ? spotsLeft : 'Full' },
            { label: 'Start date',   value: new Date(tournament.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
            { label: 'Round time',   value: `${tournament.roundDuration}h` },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-sm font-[500] text-text">{String(s.value)}</p>
              <p className="text-[12px] text-text-3 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Bracket / Rounds */}
        <div className="lg:col-span-2">
          {tournament.rounds.length === 0 ? (
            <EmptyState
              icon={<Swords size={28} />}
              title="Bracket pending"
              description={`Bracket will be generated when registration closes on ${startDate}.`}
            />
          ) : (
            <div className="space-y-4">
              {tournament.rounds.map((round) => (
                <div key={round.id}>
                  <p className="label mb-3">Round {round.roundNumber}</p>
                  <div className="space-y-2">
                    {round.matches.map((match) => (
                      <Card key={match.id} padding="md">
                        <div className="flex items-center gap-3">
                          <MatchSide
                            user={match.participant1.user}
                            score={match.participant1Score}
                            isWinner={match.winnerId === match.participant1Id}
                            isCompleted={!!match.completedAt}
                          />
                          <span className="text-xs text-text-3 font-[500] flex-shrink-0">vs</span>
                          <MatchSide
                            user={match.participant2.user}
                            score={match.participant2Score}
                            isWinner={match.winnerId === match.participant2Id}
                            isCompleted={!!match.completedAt}
                          />
                          {match.debateId && (
                            <Link
                              href={`/debate/${match.debateId}`}
                              className="text-[12px] text-accent hover:underline flex-shrink-0"
                            >
                              View
                            </Link>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Participants */}
          <Card padding="md">
            <div className="flex items-center gap-2 mb-3">
              <Users size={13} className="text-text-3" />
              <p className="label">Participants ({tournament._count.participants})</p>
            </div>
            <div className="space-y-2">
              {tournament.participants.slice(0, 16).map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  {p.seed && (
                    <span className="text-[12px] text-text-3 w-4 text-right flex-shrink-0">
                      #{p.seed}
                    </span>
                  )}
                  <Avatar src={p.user.avatarUrl} fallback={p.user.username} size="xs" />
                  <p className="text-xs text-text flex-1 min-w-0 truncate">{p.user.username}</p>
                  <span className="text-[12px] text-text-3">{p.user.eloRating}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Info */}
          <Card padding="md">
            <p className="label mb-3">Info</p>
            <div className="space-y-2">
              {[
                { label: 'Format',   value: tournament.format },
                { label: 'Created by', value: tournament.creator.username },
                { label: 'Judge',    value: tournament.judge ? `${tournament.judge.emoji} ${tournament.judge.name}` : 'Auto-assigned' },
                { label: 'Min ELO',  value: tournament.minElo ?? 'None' },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between">
                  <p className="text-[13px] text-text-3">{r.label}</p>
                  <p className="text-[13px] text-text-2 font-[450]">{String(r.value)}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Winner */}
          {tournament.winner && (
            <Card padding="md" className="border-[rgba(212,240,80,0.2)]">
              <p className="label mb-3">Champion</p>
              <div className="flex items-center gap-2">
                <Avatar src={tournament.winner.avatarUrl} fallback={tournament.winner.username} size="sm" />
                <p className="text-sm font-[450] text-text">{tournament.winner.username}</p>
                <Trophy size={13} className="text-accent ml-auto" />
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function MatchSide({
  user,
  score,
  isWinner,
  isCompleted,
}: {
  user: any;
  score: number | null;
  isWinner: boolean;
  isCompleted: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-2 flex-1 min-w-0', isWinner && 'text-accent')}>
      {isCompleted && isWinner && (
        <CheckCircle size={11} className="text-[var(--green)] flex-shrink-0" />
      )}
      <p className={cn('text-xs truncate', isWinner ? 'font-[500] text-text' : 'text-text-2')}>
        {user?.username ?? 'TBD'}
      </p>
      {score !== null && (
        <span className="text-[13px] text-text-3 flex-shrink-0">{score}</span>
      )}
    </div>
  );
}
