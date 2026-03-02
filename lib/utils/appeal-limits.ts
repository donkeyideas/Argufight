import { prisma } from '@/lib/db/prisma'
import { getUserSubscription } from '@/lib/subscriptions/subscription-utils'
import { FEATURE_LIMITS } from '@/lib/subscriptions/features'

/**
 * Get or create appeal limit for a user
 */
export async function getUserAppealLimit(userId: string) {
  let appealLimit = await prisma.appealLimit.findUnique({
    where: { userId },
  })

  // Get user's subscription to determine limit
  const subscription = await getUserSubscription(userId)
  const tier = subscription.tier as 'FREE' | 'PRO'
  const monthlyLimit = FEATURE_LIMITS[tier].APPEALS

  // Create default limit if doesn't exist
  if (!appealLimit) {
    const resetDate = new Date()
    resetDate.setMonth(resetDate.getMonth() + 1)
    resetDate.setDate(1) // First of next month

    appealLimit = await prisma.appealLimit.create({
      data: {
        userId,
        monthlyLimit,
        currentCount: 0,
        resetDate,
      },
    })
  } else {
    // Update limit if subscription tier changed
    if (appealLimit.monthlyLimit !== monthlyLimit) {
      appealLimit = await prisma.appealLimit.update({
        where: { id: appealLimit.id },
        data: {
          monthlyLimit,
        },
      })
    }
  }

  // Check if we need to reset (new month)
  const now = new Date()
  if (now >= appealLimit.resetDate) {
    // Reset to new month
    const newResetDate = new Date()
    newResetDate.setMonth(newResetDate.getMonth() + 1)
    newResetDate.setDate(1)

    appealLimit = await prisma.appealLimit.update({
      where: { id: appealLimit.id },
      data: {
        currentCount: 0,
        resetDate: newResetDate,
      },
    })
  }

  return appealLimit
}

/**
 * Check if user can appeal (has remaining appeals)
 */
export async function canUserAppeal(userId: string): Promise<{ canAppeal: boolean; remaining: number; limit: number }> {
  const appealLimit = await getUserAppealLimit(userId)
  
  // Appeal limit is now based on subscription tier (already set in monthlyLimit)
  const totalLimit = appealLimit.monthlyLimit
  const remaining = Math.max(0, totalLimit - appealLimit.currentCount)

  return {
    canAppeal: remaining > 0,
    remaining,
    limit: totalLimit,
  }
}

/**
 * Increment appeal count for user
 */
export async function incrementAppealCount(userId: string) {
  const appealLimit = await getUserAppealLimit(userId)
  
  await prisma.appealLimit.update({
    where: { id: appealLimit.id },
    data: {
      currentCount: { increment: 1 },
    },
  })
}

/**
 * Manually adjust appeal count (admin only)
 */
export async function adjustAppealCount(userId: string, adjustment: number) {
  const appealLimit = await getUserAppealLimit(userId)
  
  const newCount = Math.max(0, appealLimit.currentCount + adjustment)
  
  return await prisma.appealLimit.update({
    where: { id: appealLimit.id },
    data: {
      currentCount: newCount,
    },
  })
}

/**
 * Set monthly limit for user (admin only)
 */
export async function setMonthlyLimit(userId: string, limit: number) {
  const appealLimit = await getUserAppealLimit(userId)
  
  return await prisma.appealLimit.update({
    where: { id: appealLimit.id },
    data: {
      monthlyLimit: limit,
    },
  })
}

