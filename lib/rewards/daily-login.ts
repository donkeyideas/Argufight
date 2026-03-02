import { prisma } from '@/lib/db/prisma'

interface DailyLoginRewardSettings {
  baseReward: number
  streakMultiplier: number
  monthlyMultiplierCap: number
}

const DEFAULT_SETTINGS: DailyLoginRewardSettings = {
  baseReward: 10,
  streakMultiplier: 0.1, // 10% increase per month
  monthlyMultiplierCap: 3.0, // Max 3x multiplier
}

/**
 * Get daily login reward settings from AdminSetting or use defaults
 */
async function getRewardSettings(): Promise<DailyLoginRewardSettings> {
  try {
    const baseRewardSetting = await prisma.adminSetting.findUnique({
      where: { key: 'DAILY_LOGIN_BASE_REWARD' },
    })
    const multiplierSetting = await prisma.adminSetting.findUnique({
      where: { key: 'DAILY_LOGIN_STREAK_MULTIPLIER' },
    })
    const capSetting = await prisma.adminSetting.findUnique({
      where: { key: 'DAILY_LOGIN_MONTHLY_CAP' },
    })

    return {
      baseReward: baseRewardSetting ? parseInt(baseRewardSetting.value) : DEFAULT_SETTINGS.baseReward,
      streakMultiplier: multiplierSetting ? parseFloat(multiplierSetting.value) : DEFAULT_SETTINGS.streakMultiplier,
      monthlyMultiplierCap: capSetting ? parseFloat(capSetting.value) : DEFAULT_SETTINGS.monthlyMultiplierCap,
    }
  } catch (error) {
    console.error('Failed to fetch reward settings, using defaults:', error)
    return DEFAULT_SETTINGS
  }
}


/**
 * Check and reward daily login for a user
 * Returns the reward amount if rewarded, 0 if already rewarded today, or null on error
 */
export async function checkAndRewardDailyLogin(userId: string): Promise<number | null> {
  try {
    // Check if user was already rewarded today (UTC day boundary)
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)

    const existingReward = await prisma.coinTransaction.findFirst({
      where: {
        userId,
        type: 'DAILY_LOGIN_REWARD',
        createdAt: { gte: todayStart },
      },
    })

    if (existingReward) {
      return 0 // Already rewarded today
    }

    const settings = await getRewardSettings()
    const dailyReward = settings.baseReward

    // Update user in a transaction
    const updatedUser = await prisma.$transaction(async (tx) => {
      // Double-check inside transaction to prevent race conditions
      const alreadyRewarded = await tx.coinTransaction.findFirst({
        where: {
          userId,
          type: 'DAILY_LOGIN_REWARD',
          createdAt: { gte: todayStart },
        },
      })

      if (alreadyRewarded) {
        return { coins: 0, alreadyRewarded: true }
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, coins: true },
      })

      if (!user) {
        console.error(`[DailyLoginReward] User not found: ${userId}`)
        return null
      }

      // Update user's coins
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          coins: { increment: dailyReward },
        },
        select: { coins: true },
      })

      // Create transaction record
      await tx.coinTransaction.create({
        data: {
          userId,
          type: 'DAILY_LOGIN_REWARD',
          status: 'COMPLETED',
          amount: dailyReward,
          balanceAfter: updated.coins,
          description: 'Daily login reward',
          metadata: {
            baseReward: settings.baseReward,
            date: new Date().toISOString(),
          },
        },
      })

      return { coins: updated.coins, alreadyRewarded: false }
    })

    if (!updatedUser) {
      return null
    }

    if (updatedUser.alreadyRewarded) {
      return 0
    }

    console.log(`[DailyLoginReward] User ${userId} rewarded ${dailyReward} coins`)
    return dailyReward
  } catch (error) {
    console.error(`[DailyLoginReward] Error rewarding user ${userId}:`, error)
    return null
  }
}

// /**
//  * Award milestone bonus for reaching streak milestones
//  * Optional feature - can be enabled later
//  */
// async function awardMilestoneBonus(userId: string, streak: number): Promise<void> {
//   if (!userId || streak <= 0) return

//   const milestoneRewards: Record<number, number> = {
//     7: 50,
//     30: 200,
//     60: 500,
//     100: 1000,
//     365: 5000,
//   }

//   const bonusAmount = milestoneRewards[streak]
//   if (!bonusAmount) {
//     return
//   }

//   try {
//     await prisma.$transaction(async (tx) => {
//       const user = await tx.user.findUnique({
//         where: { id: userId },
//         select: { coins: true },
//       })

//       if (!user) return

//       await tx.user.update({
//         where: { id: userId },
//         data: {
//           coins: { increment: bonusAmount },
//         },
//       })

//       await tx.coinTransaction.create({
//         data: {
//           userId,
//           type: 'ADMIN_GRANT', // Using ADMIN_GRANT as a fallback for now
//           status: 'COMPLETED',
//           amount: bonusAmount,
//           balanceAfter: user.coins + bonusAmount,
//           description: `${streak}-day streak milestone bonus`,
//           metadata: {
//             streak,
//             milestone: streak,
//           },
//         },
//       })

//       console.log(`[DailyLoginReward] Awarded ${bonusAmount} coins to ${userId} for ${streak}-day streak`)
//     })
//   } catch (error) {
//     console.error(`[DailyLoginReward] Error awarding milestone bonus to ${userId}:`, error)
//   }
// }
