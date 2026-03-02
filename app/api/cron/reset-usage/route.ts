import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getUserSubscription } from '@/lib/subscriptions/subscription-utils'
import { FEATURE_LIMITS, FEATURES } from '@/lib/subscriptions/features'

/**
 * Monthly reset job for usage tracking
 * Should be called via Vercel Cron or similar
 */
export async function GET(request: NextRequest) {
  try {
    const { verifyCronAuth } = await import('@/lib/auth/cron-auth')
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    // Get all users with subscriptions
    const users = await prisma.user.findMany({
      where: {
        subscription: {
          isNot: null,
        },
      },
      select: {
        id: true,
      },
    })

    let resetCount = 0

    for (const user of users) {
      const subscription = await getUserSubscription(user.id)
      const tier = subscription.tier as 'FREE' | 'PRO'

      // Reset appeal limits
      const appealLimit = await prisma.appealLimit.findUnique({
        where: { userId: user.id },
      })

      if (appealLimit) {
        const newResetDate = new Date(currentYear, currentMonth + 1, 1)
        await prisma.appealLimit.update({
          where: { id: appealLimit.id },
          data: {
            currentCount: 0,
            resetDate: newResetDate,
            monthlyLimit: FEATURE_LIMITS[tier].APPEALS,
          },
        })
      }

      // Reset usage tracking for monthly features
      const periodStart = new Date(currentYear, currentMonth, 1)
      const periodEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59)

      // Reset "That's The One" usage
      if (FEATURE_LIMITS[tier].THATS_THE_ONE !== -1) {
        await prisma.usageTracking.deleteMany({
          where: {
            userId: user.id,
            featureType: FEATURES.THATS_THE_ONE,
            periodStart: { lt: periodStart },
          },
        })
      }

      // Handle tournament credits rollover (max 12)
      const tournamentCredits = await prisma.usageTracking.findUnique({
        where: {
          userId_featureType_periodStart: {
            userId: user.id,
            featureType: FEATURES.TOURNAMENT_CREDITS,
            periodStart: new Date(currentYear, currentMonth - 1, 1),
          },
        },
      })

      if (tier === 'PRO' && tournamentCredits) {
        const rolloverAmount = Math.min(tournamentCredits.count, 12)
        if (rolloverAmount > 0) {
          await prisma.usageTracking.upsert({
            where: {
              userId_featureType_periodStart: {
                userId: user.id,
                featureType: FEATURES.TOURNAMENT_CREDITS,
                periodStart,
              },
            },
            create: {
              userId: user.id,
              featureType: FEATURES.TOURNAMENT_CREDITS,
              count: rolloverAmount,
              periodStart,
              periodEnd,
              periodType: 'MONTHLY',
            },
            update: {
              count: rolloverAmount,
            },
          })
        }
      }

      resetCount++
    }

    return NextResponse.json({
      success: true,
      message: `Reset usage for ${resetCount} users`,
      resetCount,
    })
  } catch (error: any) {
    console.error('Failed to reset usage:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to reset usage' },
      { status: 500 }
    )
  }
}

