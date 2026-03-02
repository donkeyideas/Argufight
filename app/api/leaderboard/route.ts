import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db/prisma'

const leaderboardSelect = {
  id: true,
  username: true,
  avatarUrl: true,
  eloRating: true,
  debatesWon: true,
  debatesLost: true,
  debatesTied: true,
  totalDebates: true,
  totalScore: true,
  totalMaxScore: true,
} as const

function addRankAndStats(users: any[], startRank: number) {
  return users.map((user, index) => {
    const winRate = user.totalDebates > 0
      ? ((user.debatesWon / user.totalDebates) * 100).toFixed(1)
      : '0.0'
    const overallScore = user.totalMaxScore > 0
      ? `${user.totalScore}/${user.totalMaxScore}`
      : '0/0'
    const overallScorePercent = user.totalMaxScore > 0
      ? ((user.totalScore / user.totalMaxScore) * 100).toFixed(1)
      : '0.0'
    return {
      rank: startRank + index + 1,
      ...user,
      winRate: parseFloat(winRate),
      overallScore,
      overallScorePercent: parseFloat(overallScorePercent),
    }
  })
}

// Cache first page of leaderboard for 10 minutes (survives Vercel cold starts)
const getCachedLeaderboardPage1 = unstable_cache(
  async () => {
    const where = { isAdmin: false, isBanned: false }
    const [total, leaderboard] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: leaderboardSelect,
        orderBy: { eloRating: 'desc' },
        take: 25,
      }),
    ])
    return {
      leaderboard: addRankAndStats(leaderboard, 0),
      pagination: { page: 1, limit: 25, total, totalPages: Math.ceil(total / 25) },
      userRank: null,
    }
  },
  ['leaderboard-page1'],
  { revalidate: 600, tags: ['leaderboard'] }
)

// GET /api/leaderboard - Get ELO leaderboard
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100)
    const skip = (page - 1) * limit
    const category = searchParams.get('category')
    const userId = searchParams.get('userId')
    const skipCache = searchParams.get('t') !== null

    // Use cached data for default first page request
    if (!skipCache && page === 1 && limit === 25 && !userId && !category) {
      const cached = await getCachedLeaderboardPage1()
      return NextResponse.json(cached)
    }

    const where: any = { isAdmin: false, isBanned: false }

    const [total, leaderboard] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: leaderboardSelect,
        orderBy: { eloRating: 'desc' },
        skip,
        take: limit,
      }),
    ])

    const leaderboardWithRank = addRankAndStats(leaderboard, skip)

    // If userId is provided, get that user's rank
    let userRank: any = null
    if (userId) {
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { ...leaderboardSelect, isBanned: true, isAdmin: true },
      })

      if (targetUser && !targetUser.isBanned && !targetUser.isAdmin && targetUser.eloRating !== null && targetUser.eloRating !== undefined) {
        const rankCount = await prisma.user.count({
          where: {
            isAdmin: false,
            isBanned: false,
            eloRating: { gt: targetUser.eloRating },
          },
        })
        const ranked = addRankAndStats([targetUser], rankCount - 1)
        userRank = ranked[0]
      }
    }

    return NextResponse.json({
      leaderboard: leaderboardWithRank,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      userRank,
    })
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}
