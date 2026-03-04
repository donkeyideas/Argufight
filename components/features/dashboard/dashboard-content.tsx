import { prisma } from '@/lib/db/prisma';
import { unstable_cache } from 'next/cache';

import Link from 'next/link';
import { LiveDebatesFeed } from './live-debates-feed';
import { CreateDebateButton } from '@/components/features/debate/create-debate-button';
import { DAILY_CHALLENGE_POOL } from '@/lib/daily-challenge/challenges';
import { VerdictBanner } from './verdict-banner';

// ──────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────

function formatCategory(cat: string) {
  const map: Record<string, string> = {
    SPORTS:        'Sports',
    POLITICS:      'Politics',
    TECH:          'Technology',
    ENTERTAINMENT: 'Entertainment',
    SCIENCE:       'Science',
    MUSIC:         'Music',
    OTHER:         'Other',
  };
  return map[cat] ?? cat;
}

// ──────────────────────────────────────────────
//  Cache 1 — PUBLIC data (shared across all users, 60s TTL)
//  Daily challenge, live debates, open challenges
// ──────────────────────────────────────────────

const getPublicDashboardData = unstable_cache(
  async () => {
    const [openChallenges, liveDebates, dailyChallenge] = await Promise.all([
      prisma.debate.findMany({
        where: {
          status: 'WAITING',
          opponentId: null,
          OR: [{ isPrivate: false }, { visibility: 'PUBLIC' }],
        },
        select: {
          id: true,
          topic: true,
          category: true,
          challengerId: true,
          challenger: { select: { username: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),

      prisma.debate.findMany({
        where: {
          status: { in: ['ACTIVE', 'WAITING'] },
          OR: [{ isPrivate: false }, { visibility: 'PUBLIC' }],
        },
        select: {
          id: true,
          topic: true,
          category: true,
          status: true,
          currentRound: true,
          totalRounds: true,
          spectatorCount: true,
          challenger: { select: { username: true, avatarUrl: true } },
          opponent:   { select: { username: true, avatarUrl: true } },
        },
        orderBy: [{ status: 'asc' }, { spectatorCount: 'desc' }],
        take: 15,
      }),

      (async () => {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        let challenge = await prisma.dailyChallenge.findUnique({ where: { activeDate: today } });
        if (!challenge) {
          const usedCount = await prisma.dailyChallenge.count();
          const topicData = DAILY_CHALLENGE_POOL[usedCount % DAILY_CHALLENGE_POOL.length];
          challenge = await prisma.dailyChallenge.create({
            data: {
              topic: topicData.topic,
              description: topicData.description,
              category: topicData.category as any,
              forLabel: topicData.forLabel,
              againstLabel: topicData.againstLabel,
              activeDate: today,
            },
          });
        }
        return challenge;
      })(),
    ]);

    return { openChallenges, liveDebates, dailyChallenge };
  },
  ['dashboard-public'],
  { revalidate: 30 }
);

// ──────────────────────────────────────────────
//  Cache 2 — USER-SPECIFIC data (per-user, 20s TTL)
//  Your turn + verdict alerts only — 2 fast queries
// ──────────────────────────────────────────────

const getUserAlertData = unstable_cache(
  async (userId: string) => {
    const [yourTurnDebate_raw, verdictDebate, totalDebateCount] = await Promise.all([
      prisma.debate.findMany({
        where: {
          OR: [{ challengerId: userId }, { opponentId: userId }],
          status: { in: ['WAITING', 'ACTIVE'] },
        },
        select: {
          id: true,
          topic: true,
          currentRound: true,
          totalRounds: true,
          status: true,
          challengerId: true,
          opponentId: true,
          statements: {
            where: { authorId: userId },
            select: { round: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),

      prisma.debate.findFirst({
        where: {
          OR: [{ challengerId: userId }, { opponentId: userId }],
          status: 'VERDICT_READY',
        },
        select: { id: true, topic: true, winnerId: true, challengerId: true },
        orderBy: { updatedAt: 'desc' },
      }),

      prisma.debate.count({
        where: { OR: [{ challengerId: userId }, { opponentId: userId }] },
      }),
    ]);

    const yourTurnDebate = yourTurnDebate_raw.find(d => {
      if (d.status === 'WAITING') return d.opponentId === userId;
      if (d.status === 'ACTIVE') {
        const submittedRounds = new Set(d.statements.map((s: any) => s.round));
        return !submittedRounds.has(d.currentRound ?? 1);
      }
      return false;
    }) ?? null;

    return { yourTurnDebate, verdictDebate, isNewUser: totalDebateCount === 0 };
  },
  ['dashboard-user'],
  { revalidate: 20 }
);

// ──────────────────────────────────────────────
//  User alerts — streams in via Suspense
// ──────────────────────────────────────────────

async function UserAlerts({ userId }: { userId: string }) {
  const { yourTurnDebate, verdictDebate, isNewUser } = await getUserAlertData(userId);

  if (!yourTurnDebate && !verdictDebate && !isNewUser) return null;

  return (
    <>
      {isNewUser && !yourTurnDebate && !verdictDebate && (
        <div
          className="flex items-center gap-4 rounded-[var(--radius)] mb-4"
          style={{ padding: '12px 16px', background: 'rgba(212,240,80,0.04)', border: '1px solid rgba(212,240,80,0.2)' }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-[600] text-accent">Welcome to ArguFight!</p>
            <p className="text-[13px] text-text-3 mt-0.5">Start your first debate to join the leaderboard and begin building your record.</p>
          </div>
          <CreateDebateButton label="Start first debate" variant="accent" className="flex-shrink-0 !text-[13px] !px-4 !py-1.5" />
        </div>
      )}

      {yourTurnDebate && (
        <div
          className="flex items-center gap-4 rounded-[var(--radius)] mb-4"
          style={{ padding: '9px 16px', background: 'rgba(255,77,77,0.04)', border: '1px solid rgba(255,77,77,0.2)' }}
        >
          <div
            className="flex-shrink-0 rounded-full bg-[var(--red)]"
            style={{ width: 6, height: 6, animation: 'pulse 1.5s ease-in-out infinite' }}
          />
          <span className="text-[14px] font-[600] text-[var(--red)] tracking-[0.5px] whitespace-nowrap flex-shrink-0">
            Your Turn
          </span>
          <span className="text-text-3 flex-shrink-0 text-[16px]">/</span>
          <span className="text-[15px] text-text-2 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
            &quot;{yourTurnDebate.topic}&quot;
            {yourTurnDebate.status === 'ACTIVE' && (
              <> — Round {yourTurnDebate.currentRound} of {yourTurnDebate.totalRounds}</>
            )}
          </span>
          <Link
            href={`/debate/${yourTurnDebate.id}`}
            className="flex-shrink-0 rounded-[20px] px-4 py-1.5 text-[14px] font-[600] tracking-[0.3px] transition-colors whitespace-nowrap text-white"
            style={{ background: 'var(--red)' }}
          >
            {yourTurnDebate.status === 'WAITING' ? 'Accept' : 'Respond'}
          </Link>
        </div>
      )}

      {verdictDebate && (
        <VerdictBanner debate={verdictDebate} userId={userId} />
      )}
    </>
  );
}

// Thin placeholder for alerts while they stream in
function AlertsSkeleton() {
  return (
    <div className="skeleton rounded-[var(--radius)] mb-4" style={{ height: 38 }} />
  );
}

// ──────────────────────────────────────────────
//  Component
// ──────────────────────────────────────────────

export async function DashboardContent({ userId }: { userId: string }) {
  const { openChallenges, liveDebates, dailyChallenge } =
    await getPublicDashboardData();

  // Filter out user's own challenges from the open challenges list
  const filteredChallenges = openChallenges.filter(d => d.challengerId !== userId);

  // Daily challenge headline — bold the last 3 words
  const headline =
    dailyChallenge?.topic ??
    'Should governments mandate universal basic income for all citizens?';
  const words    = headline.split(' ');
  const splitAt  = Math.max(words.length - 3, Math.floor(words.length / 2));
  const headStart = words.slice(0, splitAt).join(' ');
  const headBold  = words.slice(splitAt).join(' ');

  return (
    <div className="px-4 py-5 lg:px-7 lg:py-6 min-w-0">

      {/* ── User Alerts ──────────────────────────────────── */}
      <UserAlerts userId={userId} />

      {/* ── Daily Challenge ────────────────────────────── */}
      <div className="mb-8 pb-8 border-b border-border">
        <p className="text-[13px] font-[600] uppercase tracking-[2px] text-text-3 mb-2">
          Daily Challenge
        </p>
        <h1
          className="text-text mb-2"
          style={{ fontSize: 38, fontWeight: 200, letterSpacing: '-2px', lineHeight: 1.1 }}
        >
          {headStart}{' '}
          <strong className="font-[600] text-accent">{headBold}</strong>
        </h1>
        <div className="flex items-center gap-2 text-[15px] text-text-2 mt-2 flex-wrap">
          <span>Community debate</span>
          <span className="text-border-2">/</span>
          <span>Open for discussion</span>
          <span className="text-border-2">/</span>
          <span className="text-[13px] font-[600] tracking-[0.5px] px-2 py-0.5 rounded-[20px] border border-[rgba(212,240,80,0.3)] text-accent bg-[rgba(212,240,80,0.06)]">
            Today only
          </span>
        </div>
        <CreateDebateButton
          label="Join Discussion"
          prefillTopic={headline}
          variant="accent"
          className="mt-4"
        />
      </div>

      {/* ── Open Challenges Table ─────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-[600] uppercase tracking-[1.5px] text-text-3">
            Open Challenges{' '}
            <span className="font-[400]">{filteredChallenges.length}</span>
          </span>
          <Link href="/trending" className="text-[13px] font-[500] text-text-3 hover:text-text-2 transition-colors">
            View All
          </Link>
        </div>

        {filteredChallenges.length === 0 ? (
          <p className="text-[16px] text-text-3 py-4">No open challenges right now</p>
        ) : (
          filteredChallenges.map((debate, i) => (
            <div
              key={debate.id}
              className="flex items-center gap-3.5 py-3 border-b border-border hover:pl-1.5 transition-all first:border-t first:border-border cursor-pointer"
            >
              <span className="text-[14px] font-[300] text-text-3 w-[18px] text-right flex-shrink-0">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-[12px] font-[600] uppercase tracking-[1px] text-text-3 w-[72px] flex-shrink-0">
                {formatCategory(debate.category)}
              </span>
              <span className="flex-1 text-[16px] text-text overflow-hidden text-ellipsis whitespace-nowrap">
                &ldquo;{debate.topic}&rdquo;
              </span>
              <span className="text-[14px] text-text-3 whitespace-nowrap flex-shrink-0">
                {debate.challenger.username}
              </span>
              <span className="text-[13px] font-[500] text-[var(--amber)] whitespace-nowrap flex-shrink-0 w-[55px] text-right">
                Free
              </span>
              <div className="w-[65px] flex-shrink-0 text-right">
                <Link
                  href={`/debate/${debate.id}`}
                  className="border border-accent text-accent rounded-[20px] px-3 py-1 text-[14px] font-[500] hover:bg-accent hover:text-bg transition-colors whitespace-nowrap"
                >
                  Accept
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Live Debates Feed ─────────────────────────── */}
      <LiveDebatesFeed debates={liveDebates} />
    </div>
  );
}
