/**
 * ELO matching logic for belt challenges
 * Prevents abuse by ensuring fair matchups
 */

import { prisma } from '@/lib/db/prisma'
import { getBeltSettings } from './core'

/**
 * Check if a user can challenge a belt holder based on ELO
 */
export async function canChallengeByElo(
  challengerId: string,
  beltHolderId: string,
  beltType: string
): Promise<{ allowed: boolean; reason?: string }> {
  const settings = await getBeltSettings(beltType as any)

  const challenger = await prisma.user.findUnique({
    where: { id: challengerId },
    select: { eloRating: true },
  })

  const holder = await prisma.user.findUnique({
    where: { id: beltHolderId },
    select: { eloRating: true },
  })

  if (!challenger || !holder) {
    return { allowed: false, reason: 'User not found' }
  }

  const eloDifference = Math.abs(challenger.eloRating - holder.eloRating)
  const allowedRange = settings.eloRange

  if (eloDifference > allowedRange) {
    return {
      allowed: false,
      reason: `ELO difference too large (${eloDifference} > ${allowedRange}). You can only challenge users within ${allowedRange} ELO points.`,
    }
  }

  // Check win streak bonus (if challenger has a win streak, they can challenge higher ELO)
  const challengerWinStreak = await getUserWinStreak(challengerId)
  if (challengerWinStreak >= 3) {
    const bonusRange = Math.floor(allowedRange * settings.winStreakBonusMultiplier)
    if (eloDifference <= bonusRange) {
      return { allowed: true }
    }
  }

  return { allowed: true }
}

/**
 * Get user's current win streak
 */
async function getUserWinStreak(userId: string): Promise<number> {
  // Get recent debates ordered by completion date
  const recentDebates = await prisma.debate.findMany({
    where: {
      OR: [{ challengerId: userId }, { opponentId: userId }],
      status: 'VERDICT_READY',
      winnerId: { not: null },
    },
    orderBy: {
      verdictDate: 'desc',
    },
    take: 10,
    select: {
      winnerId: true,
      challengerId: true,
      opponentId: true,
    },
  })

  let streak = 0
  for (const debate of recentDebates) {
    if (debate.winnerId === userId) {
      streak++
    } else {
      break // Streak broken
    }
  }

  return streak
}

/**
 * Get top eligible challengers for an inactive belt
 */
export async function getTopEligibleChallengers(
  beltId: string,
  count: number = 2
) {
  const belt = await prisma.belt.findUnique({
    where: { id: beltId },
    include: {
      currentHolder: {
        select: { eloRating: true },
      },
    },
  })

  if (!belt || !belt.currentHolderId || belt.status !== 'INACTIVE') {
    return []
  }

  const settings = await getBeltSettings(belt.type)
  const holderElo = belt.currentHolder?.eloRating || 1500

  // Get users within ELO range who have been active recently
  const activeDate = new Date()
  activeDate.setDate(activeDate.getDate() - settings.activityRequirementDays)

  const eligibleUsers = await prisma.user.findMany({
    where: {
      id: { not: belt.currentHolderId },
      eloRating: {
        gte: holderElo - settings.eloRange,
        lte: holderElo + settings.eloRange,
      },
      // Active in last X days (has debates as challenger)
      challengerDebates: {
        some: {
          createdAt: { gte: activeDate },
        },
      },
    },
    orderBy: {
      eloRating: 'desc',
    },
    take: count,
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      eloRating: true,
    },
  })

  return eligibleUsers
}
