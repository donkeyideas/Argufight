import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/get-session';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { FollowButton } from '@/components/features/profile/follow-button';
import { MessageButton } from '@/components/features/profile/message-button';
import { ChallengeButton } from '@/app/(app)/leaderboard/challenge-button';
import Link from 'next/link';
import { Swords, Award, CheckCircle, XCircle, Minus } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { username: true } });
  return { title: user ? `${user.username}'s Profile` : 'Profile' };
}

export default async function ProfilePage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();

  const [user, recentDebates, heldBelts, isFollowing] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true, username: true, avatarUrl: true, bio: true,
        eloRating: true, debatesWon: true, debatesLost: true, debatesTied: true,
        averageWordCount: true,
        consecutiveLoginDays: true, longestLoginStreak: true,
        isAdmin: true, isAI: true, isBanned: true,
        isCreator: true,
        totalBeltDefenses: true, longestBeltHeld: true,
        currentBeltsCount: true,
        createdAt: true,
        _count: { select: { followers: true, following: true } },
      },
    }),
    prisma.debate.findMany({
      where: {
        OR: [{ challengerId: id }, { opponentId: id }],
        status: { in: ['COMPLETED', 'VERDICT_READY', 'APPEALED'] },
        // No visibility filter — show all completed debates on profile
        // (debate room page handles access control for truly private debates)
      },
      include: {
        challenger: { select: { id: true, username: true, avatarUrl: true } },
        opponent:   { select: { id: true, username: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.belt.findMany({
      where: { currentHolderId: id, status: { in: ['ACTIVE', 'GRACE_PERIOD'] } },
      select: { id: true, name: true, timesDefended: true, acquiredAt: true },
    }),
    session
      ? prisma.follow.findFirst({ where: { followerId: session.userId, followingId: id } })
      : null,
  ]);

  if (!user) notFound();

  const isSelf = session?.userId === id;
  const totalDebates = user.debatesWon + user.debatesLost + user.debatesTied;
  const winRate = totalDebates > 0 ? Math.round((user.debatesWon / totalDebates) * 100) : 0;
  const memberSince = new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="px-4 py-5 lg:px-7 lg:py-6 max-w-3xl mx-auto">
      {/* Profile header */}
      <Card padding="lg" className="mb-6">
        <div className="flex items-start gap-5">
          <Avatar src={user.avatarUrl} fallback={user.username} size="xl" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <h1 className="text-[24px] font-[600] text-text leading-tight">{user.username}</h1>
              {user.isAdmin && <Badge color="accent">Admin</Badge>}
              {user.isCreator && <Badge color="amber">Creator</Badge>}
              {user.isBanned && <Badge color="red">Banned</Badge>}
            </div>
            {user.bio && (
              <p className="text-[16px] text-text-2 leading-relaxed mb-3">{user.bio}</p>
            )}
            <p className="text-[14px] text-text-3">Member since {memberSince}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isSelf ? (
              <Button variant="secondary" size="sm" href="/settings">
                Edit profile
              </Button>
            ) : (
              <>
                <FollowButton
                  targetId={id}
                  isFollowing={!!isFollowing}
                  currentUserId={session?.userId ?? null}
                />
                <MessageButton targetId={id} />
                <ChallengeButton opponentId={id} opponentName={user.username} />
              </>
            )}
          </div>
        </div>

        <Separator className="my-4" />

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 sm:grid-cols-8">
          {[
            { label: 'ELO',       value: user.eloRating },
            { label: 'W',         value: user.debatesWon },
            { label: 'L',         value: user.debatesLost },
            { label: 'T',         value: user.debatesTied },
            { label: 'Win%',      value: `${winRate}%` },
            { label: 'Belts',     value: user.currentBeltsCount },
            { label: 'Followers', value: user._count.followers },
            { label: 'Following', value: user._count.following },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-[18px] font-[500] text-text">{stat.value}</p>
              <p className="text-[13px] text-text-3 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="debates">
        <TabsList className="mb-5">
          <TabsTrigger value="debates">Debates ({recentDebates.length})</TabsTrigger>
          <TabsTrigger value="belts">Belts ({heldBelts.length})</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="debates">
          {recentDebates.length === 0 ? (
            <EmptyState
              icon={<Swords size={28} />}
              title="No debates yet"
              description="This user hasn't completed any debates yet."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {recentDebates.map((debate) => {
                const isChallenger = debate.challengerId === id;
                const opponent = isChallenger ? debate.opponent : debate.challenger;
                const won = debate.winnerId === id;
                const lost = !!(debate.winnerId && debate.winnerId !== id);
                const isTied = !debate.winnerId;
                return (
                  <Link key={debate.id} href={`/debate/${debate.id}`}>
                    <Card hover padding="md" className="group">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-[14px] font-[700]',
                          won   ? 'bg-[rgba(77,255,145,0.1)] text-[var(--green)]'
                          : lost ? 'bg-[rgba(255,77,77,0.1)] text-[var(--red)]'
                          : 'bg-surface-2 text-text-3'
                        )}>
                          {won ? 'W' : lost ? 'L' : 'T'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[16px] font-[450] text-text line-clamp-1 group-hover:text-accent transition-colors">
                            {debate.topic}
                          </p>
                          <p className="text-[14px] text-text-3 mt-0.5">
                            vs {opponent?.username ?? 'Open'}
                          </p>
                        </div>
                        <Badge color={won ? 'green' : isTied ? 'muted' : 'red'} size="sm">
                          {won ? 'Won' : isTied ? 'Tied' : 'Lost'}
                        </Badge>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="belts">
          {heldBelts.length === 0 ? (
            <EmptyState
              icon={<Award size={28} />}
              title="No belts held"
              description="Win belt challenges to earn championship belts."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {heldBelts.map((belt) => (
                <Card key={belt.id} padding="md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[16px] font-[500] text-text">{belt.name}</p>
                      <p className="text-[14px] text-text-3 mt-0.5">
                        {belt.timesDefended} defense{belt.timesDefended !== 1 ? 's' : ''}
                        {belt.acquiredAt && ` · held since ${new Date(belt.acquiredAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
                      </p>
                    </div>
                    <Badge color="amber">
                      <Award size={11} />
                      Champion
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="stats">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total debates',     value: totalDebates },
              { label: 'Win rate',          value: `${winRate}%` },
              { label: 'Belt defenses',     value: user.totalBeltDefenses },
              { label: 'Longest belt held', value: user.longestBeltHeld ? `${user.longestBeltHeld}d` : '—' },
              { label: 'Avg word count',    value: user.averageWordCount ? Math.round(user.averageWordCount) : '—' },
              { label: 'Login streak',      value: `${user.consecutiveLoginDays}d` },
              { label: 'Longest streak',    value: `${user.longestLoginStreak}d` },
            ].map((stat) => (
              <Card key={stat.label} padding="md">
                <p className="text-[26px] font-[200] text-text">{stat.value}</p>
                <p className="text-[14px] text-text-3 mt-1">{stat.label}</p>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
