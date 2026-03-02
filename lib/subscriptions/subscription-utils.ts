import { prisma } from '@/lib/db/prisma'
import { FEATURE_LIMITS, FEATURES, TierType } from './features'

/**
 * Get user's subscription
 */
export async function getUserSubscription(userId: string) {
  const subscription = await prisma.userSubscription.findUnique({
    where: { userId },
  })

  // If no subscription exists, create a FREE one
  if (!subscription) {
    return await prisma.userSubscription.create({
      data: {
        userId,
        tier: 'FREE',
        status: 'ACTIVE',
        billingCycle: null,
      },
    })
  }

  return subscription
}

/**
 * Get user's tier
 */
export async function getUserTier(userId: string): Promise<TierType> {
  const subscription = await getUserSubscription(userId)
  return subscription.tier as TierType
}

/**
 * Check if user has feature access
 */
export async function hasFeatureAccess(
  userId: string,
  feature: string
): Promise<boolean> {
  const tier = await getUserTier(userId)

  // All users have access to free features
  const freeFeatures = [
    FEATURES.STANDARD_DEBATES,
    FEATURES.CREATE_CHALLENGES,
    FEATURES.AI_JUDGES,
    FEATURES.ELO_RANKING,
    FEATURES.WATCH_DEBATES,
    FEATURES.BASIC_STATS,
    FEATURES.FREE_TOURNAMENTS,
    FEATURES.TOURNAMENTS, // Tournament creation (with limits)
  ]

  if (freeFeatures.includes(feature as any)) {
    return true
  }

  // Pro-only features
  if (tier === 'PRO') {
    return true
  }

  return false
}

/**
 * Get feature limit for user
 */
export async function getFeatureLimit(
  userId: string,
  feature: string
): Promise<number> {
  const tier = await getUserTier(userId)
  const limits = FEATURE_LIMITS[tier]

  switch (feature) {
    case FEATURES.APPEALS:
      return limits.APPEALS
    case FEATURES.THATS_THE_ONE:
      return limits.THATS_THE_ONE
    case FEATURES.TOURNAMENT_CREDITS:
      return limits.TOURNAMENT_CREDITS
    case FEATURES.TOURNAMENTS:
      // For free users, check admin setting for custom limit
      if (tier === 'FREE') {
        try {
          const adminSetting = await prisma.adminSetting.findUnique({
            where: { key: 'FREE_TOURNAMENT_LIMIT' },
          })
          if (adminSetting && adminSetting.value) {
            const customLimit = parseInt(adminSetting.value, 10)
            if (!isNaN(customLimit) && customLimit >= 0) {
              return customLimit
            }
          }
        } catch (error) {
          console.error('Failed to fetch FREE_TOURNAMENT_LIMIT setting:', error)
          // Fall back to default
        }
      }
      return limits.TOURNAMENTS
    default:
      return -1 // Unlimited
  }
}

/**
 * Get current usage for a feature
 */
export async function getFeatureUsage(
  userId: string,
  feature: string
): Promise<number> {
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const usage = await prisma.usageTracking.findUnique({
    where: {
      userId_featureType_periodStart: {
        userId,
        featureType: feature,
        periodStart,
      },
    },
  })

  return usage?.count || 0
}

/**
 * Check if user can use a feature (within limits)
 */
export async function canUseFeature(
  userId: string,
  feature: string
): Promise<{ allowed: boolean; reason?: string; currentUsage?: number; limit?: number }> {
  // Check if user has access to the feature
  const hasAccess = await hasFeatureAccess(userId, feature)
  if (!hasAccess) {
    return {
      allowed: false,
      reason: 'This feature requires a Pro subscription',
    }
  }

  // Get limit
  const limit = await getFeatureLimit(userId, feature)

  // -1 means unlimited
  if (limit === -1) {
    return { allowed: true }
  }

  // Get current usage
  const currentUsage = await getFeatureUsage(userId, feature)

  if (currentUsage >= limit) {
    return {
      allowed: false,
      reason: `You've reached your monthly limit of ${limit}`,
      currentUsage,
      limit,
    }
  }

  return {
    allowed: true,
    currentUsage,
    limit,
  }
}

/**
 * Decrement feature usage (for refunds/cancellations)
 */
export async function decrementFeatureUsage(
  userId: string,
  feature: string,
  amount: number = 1
): Promise<void> {
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const usage = await prisma.usageTracking.findUnique({
    where: {
      userId_featureType_periodStart: {
        userId,
        featureType: feature,
        periodStart,
      },
    },
  })

  if (usage && usage.count > 0) {
    const newCount = Math.max(0, usage.count - amount)
    await prisma.usageTracking.update({
      where: {
        userId_featureType_periodStart: {
          userId,
          featureType: feature,
          periodStart,
        },
      },
      data: {
        count: newCount,
      },
    })
  }
}

/**
 * Record feature usage
 */
export async function recordFeatureUsage(
  userId: string,
  feature: string,
  amount: number = 1
): Promise<void> {
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  await prisma.usageTracking.upsert({
    where: {
      userId_featureType_periodStart: {
        userId,
        featureType: feature,
        periodStart,
      },
    },
    create: {
      userId,
      featureType: feature,
      count: amount,
      periodStart,
      periodEnd,
      periodType: 'MONTHLY',
    },
    update: {
      count: { increment: amount },
    },
  })
}

/**
 * Get all usage for user in current period
 */
export async function getAllUsage(userId: string) {
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const usage = await prisma.usageTracking.findMany({
    where: {
      userId,
      periodStart,
    },
  })

  return usage
}

