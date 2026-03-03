import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/get-session';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import Link from 'next/link';
import { Trophy, TrendingUp, Swords, Bot } from 'lucide-react';
import { ChallengeButton } from './challenge-button';

export const metadata: Metadata = { title: 'Leaderboard' };
export const dynamic = 'force-dynamic';

async function LeaderboardData({ userId }: { userId: string }) {
  const [topPlayers, userRankData] = await Promise.all([
    prisma.user.findMany({
      where: { isBanned: false },
      orderBy: { eloRating: 'desc' },
      take: 100,
      select: {
        id: true, username: true, avatarUrl: true, isAI: true,
        eloRating: true, debatesWon: true, debatesLost: true, debatesTied: true,
        consecutiveLoginDays: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { eloRating: true },
    }),
  ]);

  const userRank = topPlayers.findIndex((p) => p.id === userId) + 1;

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="heading-1 mb-1">Leaderboard</h1>
        <p className="text-xs text-text-3">
          Top debaters ranked by ELO rating · updates every minute
        </p>
      </div>

      {/* Top 3 podium */}
      {topPlayers.length >= 3 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[topPlayers[1], topPlayers[0], topPlayers[2]].map((player, podiumIdx) => {
            const rank = podiumIdx === 0 ? 2 : podiumIdx === 1 ? 1 : 3;
            const heights = { 1: 'pt-0', 2: 'pt-4', 3: 'pt-6' };
            const colors = { 1: 'text-[var(--amber)]', 2: 'text-text-2', 3: 'text-[#cd7f32]' };
            return (
              <Link
                key={player.id}
                href={`/profile/${player.id}`}
                className={cn(
                  'flex flex-col items-center text-center gap-2 p-4',
                  'bg-surface border border-border rounded-[var(--radius)]',
                  'hover:border-border-2 transition-colors',
                  heights[rank as 1 | 2 | 3]
                )}
              >
                <span className={cn('text-lg font-[200]', colors[rank as 1 | 2 | 3])}>
                  {rank === 1 ? '#1' : rank === 2 ? '#2' : '#3'}
                </span>
                <Avatar src={player.avatarUrl} fallback={player.username} size="md" />
                <div>
                  <p className="text-xs font-[500] text-text">
                    {player.username}
                    {player.isAI && <Bot size={11} className="inline ml-1 text-text-3" />}
                  </p>
                  <p className="text-[13px] text-text-3 mt-0.5">{player.eloRating} ELO</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Full list */}
      <Card padding="none">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <p className="text-xs font-medium text-text">Rankings</p>
          {userRank > 0 && (
            <p className="text-xs text-text-3">
              Your rank: <span className="text-accent font-[500]">#{userRank}</span>
            </p>
          )}
        </div>
        <div className="divide-y divide-border">
          {topPlayers.map((player, i) => {
            const isCurrentUser = player.id === userId;
            const totalDebates = player.debatesWon + player.debatesLost + player.debatesTied;
            const winRate = totalDebates > 0 ? Math.round((player.debatesWon / totalDebates) * 100) : 0;
            return (
              <div
                key={player.id}
                className={cn(
                  'flex items-center gap-4 px-5 py-3 hover:bg-surface-2 transition-colors',
                  isCurrentUser && 'bg-[rgba(212,240,80,0.04)]'
                )}
              >
                <Link href={`/profile/${player.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                  <span
                    className={cn(
                      'text-xs font-[500] w-6 text-right flex-shrink-0',
                      i === 0 ? 'text-[var(--amber)]'
                      : i === 1 ? 'text-text-2'
                      : i === 2 ? 'text-[#cd7f32]'
                      : 'text-text-3'
                    )}
                  >
                    {i + 1}
                  </span>
                  <Avatar src={player.avatarUrl} fallback={player.username} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-xs font-[450] leading-tight',
                      isCurrentUser ? 'text-accent' : 'text-text'
                    )}>
                      {player.username}
                      {player.isAI && <Bot size={11} className="inline ml-1 text-text-3" />}
                      {isCurrentUser && <span className="text-text-3 font-[400] ml-1">(you)</span>}
                    </p>
                    <p className="text-[13px] text-text-3 mt-0.5">
                      {player.debatesWon}W · {player.debatesLost}L · {player.debatesTied}T
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-[500] text-text">{player.eloRating}</p>
                    <p className="text-[13px] text-text-3">{winRate}% win</p>
                  </div>
                </Link>
                {!isCurrentUser && (
                  <ChallengeButton opponentId={player.id} opponentName={player.username} />
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="p-5 max-w-3xl mx-auto">
      <div className="mb-6">
        <Skeleton height={20} width={140} className="mb-2" />
        <Skeleton height={10} width={260} />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[0,1,2].map(i => (
          <div key={i} className="bg-surface border border-border rounded-[var(--radius)] p-4 flex flex-col items-center gap-2">
            <Skeleton height={16} width={24} />
            <Skeleton width={36} height={36} rounded />
            <Skeleton height={10} width={60} />
          </div>
        ))}
      </div>
      <div className="bg-surface border border-border rounded-[var(--radius)]">
        {Array.from({length: 10}).map((_,i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-border last:border-0">
            <Skeleton width={16} height={12} />
            <Skeleton width={28} height={28} rounded />
            <div className="flex-1">
              <Skeleton height={11} width="40%" className="mb-1" />
              <Skeleton height={9} width="30%" />
            </div>
            <Skeleton height={12} width={40} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function LeaderboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return (
    <Suspense fallback={<LeaderboardSkeleton />}>
      <LeaderboardData userId={session.userId} />
    </Suspense>
  );
}
