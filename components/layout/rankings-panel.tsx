import { prisma } from '@/lib/db/prisma';
import { unstable_cache } from 'next/cache';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/avatar';
import { CreateDebateButton } from '@/components/features/debate/create-debate-button';

interface Props {
  userId: string;
}

const getRankingsData = unstable_cache(
  async (userId: string) => {
    const [leaderboard, belts, tournaments] = await Promise.all([
      prisma.user.findMany({
        where: { isAI: false, isBanned: false },
        orderBy: { eloRating: 'desc' },
        take: 5,
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          eloRating: true,
          debatesWon: true,
          debatesLost: true,
        },
      }),

      prisma.belt.findMany({
        where: {
          currentHolderId: userId,
          status: { in: ['ACTIVE', 'GRACE_PERIOD', 'MANDATORY'] },
        },
        select: { id: true, name: true, acquiredAt: true, timesDefended: true },
        take: 3,
      }),

      prisma.tournament.findMany({
        where: { status: { in: ['UPCOMING', 'REGISTRATION_OPEN', 'IN_PROGRESS'] } },
        include: { _count: { select: { participants: true } } },
        orderBy: { startDate: 'asc' },
        take: 3,
      }),
    ]);

    const currentUser = leaderboard.find((p) => p.id === userId);
    const userRank = currentUser
      ? (await prisma.user.count({
          where: { eloRating: { gt: currentUser.eloRating }, isAI: false, isBanned: false },
        })) + 1
      : null;

    return { leaderboard, belts, tournaments, userRank };
  },
  ['rankings-panel'],
  { revalidate: 60 }
);

export async function RankingsPanel({ userId }: Props) {
  const { leaderboard, belts, tournaments, userRank } = await getRankingsData(userId);

  const currentUser = leaderboard.find((p) => p.id === userId);
  const userInTop5 = leaderboard.some((p) => p.id === userId);

  return (
    <aside
      className="border-l border-border px-5 py-6 overflow-y-auto"
      style={{ position: 'sticky', top: 58, height: 'calc(100vh - 58px)' }}
    >
      {/* Rankings */}
      <div className="mb-6 pb-5 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-[600] uppercase tracking-[1.5px] text-text-3">Rankings</span>
          <Link href="/leaderboard" className="text-[13px] font-[500] text-text-3 hover:text-text-2 transition-colors">
            All
          </Link>
        </div>

        {leaderboard.map((player, i) => {
          const isYou = player.id === userId;
          const posColor = i === 0
            ? 'text-[var(--amber)]'
            : i === 1 ? 'text-text-2'
            : i === 2 ? 'text-[#8a6030]'
            : isYou  ? 'text-accent'
            : 'text-text-3';

          return (
            <Link
              key={player.id}
              href={`/profile/${player.id}`}
              className={cn(
                'flex items-center gap-2.5 py-1.5 border-b border-border hover:pl-1 transition-all last:border-none',
                isYou && 'bg-[rgba(212,240,80,0.04)] -mx-2 px-2 rounded'
              )}
            >
              <span className={cn('text-[15px] font-[300] w-4 text-center flex-shrink-0', posColor)}>
                {i + 1}
              </span>
              <Avatar
                src={player.avatarUrl}
                fallback={player.username}
                size="sm"
                className={isYou ? 'ring-1 ring-accent ring-offset-1 ring-offset-bg' : ''}
              />
              <span className={cn('text-[15px] font-[500] flex-shrink-0 ml-auto', isYou ? 'text-accent' : 'text-[var(--amber)]')}>
                {player.eloRating}
              </span>
            </Link>
          );
        })}

        {/* User's rank if outside top 5 */}
        {!userInTop5 && currentUser && userRank && (
          <>
            <div className="h-px bg-border my-1" />
            <Link
              href={`/profile/${currentUser.id}`}
              className="flex items-center gap-2.5 py-1.5 bg-[rgba(212,240,80,0.04)] -mx-2 px-2 rounded"
            >
              <span className="text-[15px] font-[300] w-4 text-center text-accent flex-shrink-0">{userRank}</span>
              <Avatar src={currentUser.avatarUrl} fallback={currentUser.username} size="sm" className="ring-1 ring-accent ring-offset-1 ring-offset-bg" />
              <span className="text-[15px] font-[500] text-accent flex-shrink-0 ml-auto">{currentUser.eloRating}</span>
            </Link>
          </>
        )}
      </div>

      {/* Championship Belts */}
      {belts.length > 0 && (
        <div className="mb-6 pb-5 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-[600] uppercase tracking-[1.5px] text-text-3">Belts</span>
            <Link href="/profile" className="text-[13px] font-[500] text-text-3 hover:text-text-2 transition-colors">
              Room
            </Link>
          </div>
          {belts.map((belt) => {
            const daysHeld = belt.acquiredAt
              ? Math.floor((Date.now() - new Date(belt.acquiredAt).getTime()) / 86400000)
              : 0;
            return (
              <div
                key={belt.id}
                className="flex items-center gap-2 py-2 border-b border-border last:border-none hover:pl-1 transition-all cursor-pointer"
              >
                <div className="flex-1 overflow-hidden">
                  <p className="text-[15px] font-[500] whitespace-nowrap overflow-hidden text-ellipsis">{belt.name}</p>
                  <p className="text-[13px] text-text-3">{daysHeld} days held</p>
                </div>
                <span className="text-[12px] font-[600] uppercase tracking-[0.5px] px-2 py-0.5 rounded-[20px] border border-[rgba(77,255,145,0.3)] text-[var(--green)] bg-[rgba(77,255,145,0.05)] flex-shrink-0 whitespace-nowrap">
                  Active
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Tournaments */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-[600] uppercase tracking-[1.5px] text-text-3">Tournaments</span>
          <Link href="/tournaments" className="text-[13px] font-[500] text-text-3 hover:text-text-2 transition-colors">
            All
          </Link>
        </div>

        {tournaments.length === 0 ? (
          <p className="text-[15px] text-text-3">No tournaments open</p>
        ) : (
          tournaments.map((t) => {
            const tagColor =
              t.status === 'REGISTRATION_OPEN'
                ? 'border-[rgba(77,255,145,0.3)] text-[var(--green)] bg-[rgba(77,255,145,0.05)]'
                : t.status === 'IN_PROGRESS'
                  ? 'border-[rgba(212,240,80,0.3)] text-accent bg-[rgba(212,240,80,0.05)]'
                  : 'border-[rgba(77,159,255,0.3)] text-[var(--blue)] bg-[rgba(77,159,255,0.05)]';
            const tagLabel =
              t.status === 'REGISTRATION_OPEN' ? 'Open'
              : t.status === 'IN_PROGRESS'      ? 'Live'
              : 'Soon';
            return (
              <Link
                key={t.id}
                href={`/tournaments/${t.id}`}
                className="flex items-center gap-2 py-2 border-b border-border last:border-none hover:pl-1 transition-all"
              >
                <div className="flex-1 overflow-hidden">
                  <p className="text-[15px] font-[500] whitespace-nowrap overflow-hidden text-ellipsis">{t.name}</p>
                  <p className="text-[13px] text-text-3">{t._count.participants}/{t.maxParticipants}</p>
                </div>
                <span className={cn('text-[12px] font-[600] uppercase tracking-[0.5px] px-2 py-0.5 rounded-[20px] border flex-shrink-0 whitespace-nowrap', tagColor)}>
                  {tagLabel}
                </span>
              </Link>
            );
          })
        )}
      </div>

      {/* Start debate CTA */}
      <CreateDebateButton label="Start a new debate" />
    </aside>
  );
}
