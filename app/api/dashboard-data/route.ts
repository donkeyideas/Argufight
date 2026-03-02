import { NextResponse, after } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { getFeatureFlags, FEATURE_KEYS } from '@/lib/features'

export const dynamic = 'force-dynamic'

// Full select for debates that need all details (active battles, user's active, recent)
const fullDebateSelect = {
  id: true,
  topic: true,
  category: true,
  status: true,
  challengerId: true,
  opponentId: true,
  winnerId: true,
  endedAt: true,
  createdAt: true,
  verdictReached: true,
  verdictDate: true,
  challengeType: true,
  invitedUserIds: true,
  currentRound: true,
  totalRounds: true,
  roundDuration: true,
  roundDeadline: true,
  spectatorCount: true,
  challengerPosition: true,
  opponentPosition: true,
  isPrivate: true,
  shareToken: true,
  description: true,
  challenger: {
    select: { id: true, username: true, avatarUrl: true, eloRating: true },
  },
  opponent: {
    select: { id: true, username: true, avatarUrl: true, eloRating: true },
  },
  images: {
    select: { id: true, url: true, alt: true, caption: true, order: true },
    orderBy: { order: 'asc' as const },
  },
  statements: {
    select: { id: true, round: true, authorId: true },
  },
  tournamentMatch: {
    select: {
      id: true,
      tournament: {
        select: { id: true, name: true, format: true, currentRound: true, totalRounds: true },
      },
      round: { select: { roundNumber: true } },
    },
  },
  participants: {
    select: {
      id: true,
      userId: true,
      status: true,
      user: {
        select: { id: true, username: true, avatarUrl: true, eloRating: true },
      },
    },
  },
} as const

// Lightweight select for waiting/challenge cards — skip statements, tournamentMatch, participants
const challengeDebateSelect = {
  id: true,
  topic: true,
  category: true,
  status: true,
  challengerId: true,
  opponentId: true,
  createdAt: true,
  challengeType: true,
  invitedUserIds: true,
  isPrivate: true,
  description: true,
  challenger: {
    select: { id: true, username: true, avatarUrl: true, eloRating: true },
  },
  images: {
    select: { id: true, url: true, alt: true, order: true },
    orderBy: { order: 'asc' as const },
  },
} as const

// Lightweight select for recent debates in profile panel
const recentDebateSelect = {
  id: true,
  topic: true,
  category: true,
  status: true,
  challengerId: true,
  opponentId: true,
  winnerId: true,
  endedAt: true,
  createdAt: true,
  verdictReached: true,
  challenger: {
    select: { id: true, username: true },
  },
  opponent: {
    select: { id: true, username: true },
  },
  statements: {
    select: { id: true },
  },
} as const

// GET /api/dashboard-data — single endpoint for all dashboard panel data
export async function GET() {
  // Trigger AI auto-accept and expired debate processing after response is sent
  after(async () => {
    try {
      const { triggerAIAutoAccept } = await import('@/lib/ai/trigger-ai-accept')
      await triggerAIAutoAccept()
    } catch {
      // Background task failure is non-critical
    }
  })

  try {
    const session = await verifySession()
    const userId = session ? getUserIdFromSession(session) : null

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Feature flags — skip queries for disabled modules
    const flags = await getFeatureFlags()
    const beltsEnabled = flags[FEATURE_KEYS.BELTS]
    const tournamentsEnabled = flags[FEATURE_KEYS.TOURNAMENTS]
    const advertisingEnabled = flags[FEATURE_KEYS.ADVERTISING]
    const subscriptionsEnabled = flags[FEATURE_KEYS.SUBSCRIPTIONS]
    const streaksEnabled = flags[FEATURE_KEYS.STREAKS]

    // Run ALL dashboard queries in parallel — skip disabled module queries
    const [
      categories,
      activeDebates,
      userActiveDebates,
      waitingDebates,
      userWaitingDebates,
      recentDebates,
      leaderboardUsers,
      userRankData,
      userBelts,
      beltChallengesRaw,
      tournaments,
      navUnread,
      navSubscription,
      navUser,
      navBeltCount,
      yourTurnDebates,
      userRankCount,
      pendingRematches,
    ] = await Promise.all([
      // 1. Categories
      prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, label: true, description: true, color: true, icon: true, sortOrder: true },
      }),

      // 2. Active debates (Live Battles - public only)
      prisma.debate.findMany({
        where: { status: 'ACTIVE', isPrivate: false },
        select: fullDebateSelect,
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),

      // 3. User's active debates (My Battle) — needs full select for turn detection
      prisma.debate.findMany({
        where: {
          status: 'ACTIVE',
          OR: [{ challengerId: userId }, { opponentId: userId }],
        },
        select: fullDebateSelect,
        orderBy: { createdAt: 'desc' },
      }),

      // 4. Waiting debates (Open Challenges) — lightweight select
      prisma.debate.findMany({
        where: { status: 'WAITING', isPrivate: false },
        select: challengeDebateSelect,
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),

      // 5. User's waiting debates (My Challenges) — lightweight select
      prisma.debate.findMany({
        where: {
          status: 'WAITING',
          OR: [{ challengerId: userId }, { opponentId: userId }],
        },
        select: challengeDebateSelect,
        orderBy: { createdAt: 'desc' },
      }),

      // 6. Recent debates (Profile panel) — lightweight select
      prisma.debate.findMany({
        where: {
          OR: [{ challengerId: userId }, { opponentId: userId }],
          status: { not: 'WAITING' },
        },
        select: recentDebateSelect,
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),

      // 7. Leaderboard top 3
      prisma.user.findMany({
        where: { isAdmin: false, isBanned: false },
        select: {
          id: true, username: true, avatarUrl: true, eloRating: true,
          debatesWon: true, debatesLost: true, debatesTied: true,
          totalDebates: true, totalScore: true, totalMaxScore: true,
        },
        orderBy: { eloRating: 'desc' },
        take: 3,
      }),

      // 8. User's rank data
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, username: true, avatarUrl: true, eloRating: true,
          debatesWon: true, debatesLost: true, debatesTied: true,
          totalDebates: true, totalScore: true, totalMaxScore: true,
          email: true, coins: true,
          debateStreak: true, longestDebateStreak: true,
        },
      }),

      // 9. User's belts (skip when BELTS off)
      beltsEnabled
        ? prisma.belt.findMany({
            where: {
              currentHolderId: userId,
              status: { in: ['ACTIVE', 'MANDATORY', 'STAKED', 'GRACE_PERIOD'] },
            },
            include: {
              currentHolder: { select: { id: true, username: true, avatarUrl: true } },
            },
          })
        : Promise.resolve([]),

      // 10. Belt challenges (skip when BELTS off)
      beltsEnabled
        ? Promise.all([
            prisma.beltChallenge.findMany({
              where: {
                belt: { currentHolderId: userId },
                status: { notIn: ['COMPLETED', 'DECLINED', 'EXPIRED'] },
              },
              include: {
                belt: true,
                challenger: { select: { id: true, username: true, avatarUrl: true } },
                beltHolder: { select: { id: true, username: true, avatarUrl: true } },
              },
              orderBy: { createdAt: 'desc' },
            }),
            prisma.beltChallenge.findMany({
              where: {
                challengerId: userId,
                status: { notIn: ['COMPLETED', 'DECLINED', 'EXPIRED'] },
              },
              include: {
                belt: true,
                challenger: { select: { id: true, username: true, avatarUrl: true } },
                beltHolder: { select: { id: true, username: true, avatarUrl: true } },
              },
              orderBy: { createdAt: 'desc' },
            }),
          ])
        : Promise.resolve([[], []]),

      // 11. Active tournaments (skip when TOURNAMENTS off)
      tournamentsEnabled
        ? prisma.tournament.findMany({
            where: { status: { in: ['UPCOMING', 'REGISTRATION_OPEN', 'IN_PROGRESS'] } },
            orderBy: { startDate: 'asc' },
            take: 3,
          }).catch(() => [])
        : Promise.resolve([]),

      // 12. Nav: unread notifications
      prisma.notification.count({ where: { userId, read: false } }),

      // 13. Nav: subscription tier (skip when SUBSCRIPTIONS off)
      subscriptionsEnabled
        ? prisma.userSubscription.findUnique({ where: { userId }, select: { tier: true } })
        : Promise.resolve(null),

      // 14. Nav: user data (REMOVED — reuse query #8 userRankData which now includes email+coins)
      Promise.resolve(null),

      // 15. Nav: belt count (skip when BELTS off)
      beltsEnabled
        ? prisma.belt.count({
            where: { currentHolderId: userId, status: { in: ['ACTIVE', 'MANDATORY', 'STAKED', 'GRACE_PERIOD'] } },
          })
        : Promise.resolve(0),

      // 16. Your-turn check — reuse query #3 (userActiveDebates) instead of separate query
      Promise.resolve(null),

      // 17. User rank count (was sequential — now parallel)
      prisma.user.count({
        where: { isAdmin: false, isBanned: false, eloRating: { gt: 0 } },
      }).catch(() => 0),

      // 18. Pending rematches (consolidated — was separate API call)
      prisma.$queryRaw<Array<{
        id: string
        topic: string
        category: string
        challenger_id: string
        opponent_id: string | null
        winner_id: string | null
        rematch_requested_by: string | null
      }>>`
        SELECT d.id, d.topic, d.category, d.challenger_id, d.opponent_id,
               d.winner_id, d.rematch_requested_by
        FROM debates d
        WHERE d.winner_id = ${userId}
          AND d.rematch_status = 'PENDING'
          AND d.rematch_requested_by != ${userId}
      `.catch(() => []),
    ])

    // Process belt challenges
    const [challengesToMyBelts, challengesMade] = beltChallengesRaw

    // Process leaderboard with computed fields
    const leaderboard = leaderboardUsers.map((u, i) => ({
      ...u,
      rank: i + 1,
      winRate: u.totalDebates > 0 ? Math.round((u.debatesWon / u.totalDebates) * 1000) / 10 : 0,
      overallScore: u.totalScore,
      overallScorePercent: u.totalMaxScore > 0 ? Math.round((u.totalScore / u.totalMaxScore) * 1000) / 10 : 0,
    }))

    // Process user rank — use userRankData (query #8) which now includes email+coins
    let userRank = null
    if (userRankData && !leaderboard.some(u => u.id === userId)) {
      // Compute rank from the parallel count query instead of sequential
      const higherRanked = await prisma.user.count({
        where: { isAdmin: false, isBanned: false, eloRating: { gt: userRankData.eloRating } },
      })
      userRank = {
        ...userRankData,
        rank: higherRanked + 1,
        winRate: userRankData.totalDebates > 0 ? Math.round((userRankData.debatesWon / userRankData.totalDebates) * 1000) / 10 : 0,
        overallScore: userRankData.totalScore,
        overallScorePercent: userRankData.totalMaxScore > 0 ? Math.round((userRankData.totalScore / userRankData.totalMaxScore) * 1000) / 10 : 0,
      }
    }

    // Process your-turn — reuse userActiveDebates (query #3) instead of separate query
    let yourTurn = null
    for (const debate of userActiveDebates) {
      const submitted = debate.statements.some(
        (s: any) => s.authorId === userId && s.round === debate.currentRound
      )
      if (!submitted) {
        yourTurn = { debateId: debate.id, topic: debate.topic, round: debate.currentRound, deadline: debate.roundDeadline }
        break
      }
    }

    // Advertiser check (skip when ADVERTISING off)
    let isAdvertiser = false
    if (advertisingEnabled && userRankData?.email) {
      const adv = await prisma.advertiser.findUnique({
        where: { contactEmail: userRankData.email },
        select: { id: true },
      })
      isAdvertiser = !!adv
    }

    // Add hasNoStatements flag to debate arrays
    const addFlags = (debates: any[]) => debates.map(d => ({
      ...d,
      hasNoStatements: !d.statements || d.statements.length === 0,
    }))

    // Process pending rematches: fetch requester usernames in batch
    let rematchData: any[] = []
    if (pendingRematches.length > 0) {
      const requesterIds = [...new Set(pendingRematches.map((r: any) => r.rematch_requested_by).filter(Boolean))]
      const requesters = requesterIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: requesterIds as string[] } },
            select: { id: true, username: true, avatarUrl: true },
          })
        : []
      const requesterMap = new Map(requesters.map(u => [u.id, u]))

      rematchData = pendingRematches.map((r: any) => ({
        id: r.id,
        topic: r.topic,
        category: r.category,
        requester: requesterMap.get(r.rematch_requested_by) || null,
      }))
    }

    return NextResponse.json({
      categories: { categories },
      activeDebates: { debates: addFlags(activeDebates) },
      userActiveDebates: { debates: addFlags(userActiveDebates) },
      waitingDebates: { debates: addFlags(waitingDebates as any[]) },
      userWaitingDebates: { debates: addFlags(userWaitingDebates as any[]) },
      recentDebates: { debates: addFlags(recentDebates as any[]) },
      leaderboard: { leaderboard, userRank },
      belts: beltsEnabled ? { currentBelts: userBelts, challengesToMyBelts, challengesMade } : null,
      tournaments: tournamentsEnabled ? { tournaments } : null,
      nav: {
        unreadCount: navUnread,
        tier: subscriptionsEnabled ? (navSubscription?.tier || 'FREE') : null,
        isAdvertiser,
        beltCount: beltsEnabled ? navBeltCount : 0,
        coinBalance: userRankData?.coins || 0,
      },
      yourTurn: yourTurn ? { hasTurn: true, ...yourTurn } : { hasTurn: false },
      pendingRematches: rematchData,
      streak: streaksEnabled ? {
        debateStreak: userRankData?.debateStreak || 0,
        longestDebateStreak: userRankData?.longestDebateStreak || 0,
      } : null,
      featureFlags: flags,
    })
  } catch (error) {
    console.error('[dashboard-data] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
