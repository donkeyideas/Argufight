import { prisma } from '@/lib/db/prisma';
import { unstable_cache } from 'next/cache';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { CreateDebateButton } from '@/components/features/debate/create-debate-button';

interface Props {
  userId: string;
}

function formatDate(d: Date | string) {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const getProfileData = unstable_cache(
  async (userId: string) => {
    const [user, recentDebates] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          eloRating: true,
          debatesWon: true,
          debatesLost: true,
          debatesTied: true,
          consecutiveLoginDays: true,
          subscription: { select: { tier: true } },
        },
      }),

      prisma.debate.findMany({
        where: {
          OR: [{ challengerId: userId }, { opponentId: userId }],
          status: { in: ['WAITING', 'ACTIVE', 'VERDICT_READY', 'COMPLETED'] },
        },
        select: {
          id: true,
          topic: true,
          status: true,
          winnerId: true,
          challengerId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const userRank = user
      ? (await prisma.user.count({
          where: { eloRating: { gt: user.eloRating }, isAI: false, isBanned: false },
        })) + 1
      : null;

    return { user, recentDebates, userRank };
  },
  ['profile-panel'],
  { revalidate: 30 }
);

export async function ProfilePanel({ userId }: Props) {
  const { user, recentDebates, userRank } = await getProfileData(userId);

  if (!user) return null;

  const totalDebates = user.debatesWon + user.debatesLost + user.debatesTied;
  const winRate = totalDebates > 0 ? Math.round((user.debatesWon / totalDebates) * 100) : 0;
  const tier = user.subscription?.tier ?? 'Free';
  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <aside
      className="border-r border-border px-5 py-6 overflow-y-auto"
      style={{ position: 'sticky', top: 58, height: 'calc(100vh - 58px)' }}
    >
      {/* Profile card */}
      <div className="pb-5 mb-5 border-b border-border">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full border border-border-2 bg-surface-2 flex items-center justify-center text-[17px] font-[600] text-text-2 mb-3 overflow-hidden">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>

        <p className="text-[19px] font-[600] text-text tracking-[-0.3px] mb-1">{user.username}</p>
        <p className="text-[14px] text-text-3 mb-3">{tier} Tier</p>
        <p className="text-[14px] font-[500] text-[var(--amber)] tracking-[0.3px] mb-4">
          {user.eloRating.toLocaleString()} ELO &nbsp;·&nbsp; Rank #{userRank}
        </p>

        {/* 2×2 stats grid */}
        <div className="grid grid-cols-2 gap-1.5 mb-4">
          {[
            { val: totalDebates,     color: '',                      label: 'Total' },
            { val: user.debatesWon,  color: 'text-[var(--green)]',   label: 'Wins' },
            { val: user.debatesLost, color: 'text-[var(--red)]',     label: 'Losses' },
            { val: `${winRate}%`,    color: 'text-accent',           label: 'Win Rate' },
          ].map((s) => (
            <div key={s.label} className="p-2.5 border border-border rounded-[var(--radius)] bg-surface hover:border-border-2 transition-colors cursor-default">
              <div className={cn('text-[26px] font-[300] leading-none tracking-[-1px] mb-1', s.color)}>
                {s.val}
              </div>
              <div className="text-[12px] text-text-3 uppercase tracking-[1px]">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Streak */}
        <div className="flex items-center justify-between text-[14px] text-text-3 px-3 py-2 border border-border rounded-[var(--radius)] bg-surface">
          <span>Streak</span>
          <span className="text-[var(--amber)] font-[600] text-[16px]">
            {user.consecutiveLoginDays} days
          </span>
        </div>
      </div>

      {/* Recent debates */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-[600] uppercase tracking-[1.5px] text-text-3">Recent</span>
        <Link href="/debates/history" className="text-[13px] font-[500] text-text-3 hover:text-text-2 transition-colors">
          History
        </Link>
      </div>

      {recentDebates.length === 0 ? (
        <p className="text-[15px] text-text-3">No debates yet</p>
      ) : (
        recentDebates.map((d) => {
          const isCompleted   = d.status === 'COMPLETED' || d.status === 'VERDICT_READY';
          const isWin         = isCompleted && d.winnerId === userId;
          const isTie         = isCompleted && d.winnerId === null;
          const result        = d.status === 'WAITING'      ? 'OPEN'
                              : d.status === 'ACTIVE'       ? 'LIVE'
                              : d.status === 'VERDICT_READY'? 'VRD'
                              : isTie ? 'T' : isWin ? 'W' : 'L';
          const resultColor   = d.status === 'WAITING'      ? 'text-[var(--amber)]'
                              : d.status === 'ACTIVE'       ? 'text-[var(--green)]'
                              : d.status === 'VERDICT_READY'? 'text-[var(--blue)]'
                              : isTie ? 'text-[var(--blue)]'
                              : isWin ? 'text-[var(--green)]' : 'text-[var(--red)]';
          return (
            <Link
              key={d.id}
              href={`/debate/${d.id}`}
              className="flex items-center gap-2 py-2 cursor-pointer group"
            >
              <span className={cn('text-[12px] font-[600] uppercase w-[30px] text-center flex-shrink-0', resultColor)}>
                {result}
              </span>
              <span className="flex-1 text-[14px] text-text-2 overflow-hidden text-ellipsis whitespace-nowrap group-hover:text-text transition-colors">
                {d.topic}
              </span>
              <span className="text-[13px] text-text-3 flex-shrink-0">{formatDate(d.createdAt)}</span>
            </Link>
          );
        })
      )}

      {/* Start debate CTA */}
      <div className="mt-5 pt-5 border-t border-border">
        <CreateDebateButton label="Start a debate" />
      </div>
    </aside>
  );
}
