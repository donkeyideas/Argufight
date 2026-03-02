import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { getAllUsage, getFeatureLimit, getFeatureUsage } from '@/lib/subscriptions/subscription-utils'
import { FEATURES } from '@/lib/subscriptions/features'

export async function GET(request: NextRequest) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const appealsUsage = await getFeatureUsage(userId, FEATURES.APPEALS)
    const appealsLimit = await getFeatureLimit(userId, FEATURES.APPEALS)

    const thatsTheOneUsage = await getFeatureUsage(userId, FEATURES.THATS_THE_ONE)
    const thatsTheOneLimit = await getFeatureLimit(userId, FEATURES.THATS_THE_ONE)

    const tournamentCreditsUsage = await getFeatureUsage(userId, FEATURES.TOURNAMENT_CREDITS)
    const tournamentCreditsLimit = await getFeatureLimit(userId, FEATURES.TOURNAMENT_CREDITS)

    const tournamentsUsage = await getFeatureUsage(userId, FEATURES.TOURNAMENTS)
    const tournamentsLimit = await getFeatureLimit(userId, FEATURES.TOURNAMENTS)

    // Get all usage for formatted response
    const allUsage = await getAllUsage(userId)
    const usageArray = allUsage.map((u) => ({
      featureType: u.featureType,
      count: u.count,
    }))

    return NextResponse.json({
      usage: {
        appeals: {
          current: appealsUsage,
          limit: appealsLimit,
        },
        thatsTheOne: {
          current: thatsTheOneUsage,
          limit: thatsTheOneLimit,
        },
        tournamentCredits: {
          current: tournamentCreditsUsage,
          limit: tournamentCreditsLimit,
        },
        tournaments: {
          current: tournamentsUsage,
          limit: tournamentsLimit,
        },
      },
      usageArray: usageArray, // Array format for easy lookup
      limits: {
        APPEALS: appealsLimit,
        THATS_THE_ONE: thatsTheOneLimit,
        TOURNAMENT_CREDITS: tournamentCreditsLimit,
        TOURNAMENTS: tournamentsLimit,
      },
    })
  } catch (error: any) {
    console.error('Failed to fetch usage:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch usage' },
      { status: 500 }
    )
  }
}

