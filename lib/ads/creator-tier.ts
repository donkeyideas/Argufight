import { prisma } from '@/lib/db/prisma'
import { getPlatformFee } from './config'

/**
 * Determine creator tier based on ELO rating
 */
export function getCreatorTierFromELO(eloRating: number): 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' {
  if (eloRating >= 2500) {
    return 'PLATINUM'
  } else if (eloRating >= 2000) {
    return 'GOLD'
  } else if (eloRating >= 1500) {
    return 'SILVER'
  } else {
    return 'BRONZE'
  }
}

/**
 * Get creator tier for a user
 * Checks creatorStatus field first, then falls back to ELO-based calculation
 */
export async function getCreatorTier(userId: string): Promise<'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        creatorStatus: true,
        eloRating: true,
      },
    })

    if (!user) {
      return 'BRONZE' // Default tier
    }

    // If creatorStatus is set, use it
    if (user.creatorStatus) {
      return user.creatorStatus
    }

    // Otherwise, calculate from ELO
    return getCreatorTierFromELO(user.eloRating)
  } catch (error) {
    console.error(`[getCreatorTier] Error getting creator tier for user ${userId}:`, error)
    return 'BRONZE' // Default on error
  }
}

/**
 * Get platform fee percentage for a creator
 */
export async function getCreatorPlatformFee(userId: string): Promise<number> {
  try {
    const tier = await getCreatorTier(userId)
    return await getPlatformFee(tier)
  } catch (error) {
    console.error(`[getCreatorPlatformFee] Error getting platform fee for user ${userId}:`, error)
    return 25 // Default to highest fee (BRONZE) on error
  }
}

/**
 * Calculate platform fee and creator payout from total amount
 */
export async function calculateCreatorPayout(
  userId: string,
  totalAmount: number
): Promise<{
  platformFeePercent: number
  platformFee: number
  creatorPayout: number
}> {
  const platformFeePercent = await getCreatorPlatformFee(userId)
  const platformFee = totalAmount * (platformFeePercent / 100)
  const creatorPayout = totalAmount - platformFee

  return {
    platformFeePercent,
    platformFee,
    creatorPayout,
  }
}
