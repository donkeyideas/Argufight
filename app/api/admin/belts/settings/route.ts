import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/belts/settings - Get all belt settings
export async function GET() {
  try {
    const session = await verifySessionWithDb()
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    })

    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const settings = await prisma.beltSettings.findMany({
      orderBy: { beltType: 'asc' },
    })

    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error('Failed to fetch belt settings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch belt settings' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/belts/settings/[type] - Update belt settings
export async function PUT(request: NextRequest) {
  try {
    const session = await verifySessionWithDb()
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    })

    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { beltType, ...updates } = body

    if (!beltType) {
      return NextResponse.json(
        { error: 'Belt type is required' },
        { status: 400 }
      )
    }

    // Build update data, excluding freeChallengesPerWeek if Prisma client doesn't support it yet
    // We'll use raw SQL as a fallback if needed
    const updateData: any = {
      updatedBy: session.userId,
    }
    
    // Add all valid fields
    const validFields = [
      'defensePeriodDays',
      'inactivityDays',
      'mandatoryDefenseDays',
      'gracePeriodDays',
      'maxDeclines',
      'challengeCooldownDays',
      'challengeExpiryDays',
      'eloRange',
      'activityRequirementDays',
      'winStreakBonusMultiplier',
      'entryFeeBase',
      'entryFeeMultiplier',
      'winnerRewardPercent',
      'loserConsolationPercent',
      'platformFeePercent',
      'tournamentBeltCostSmall',
      'tournamentBeltCostMedium',
      'tournamentBeltCostLarge',
      'inactiveCompetitorCount',
      'inactiveAcceptDays',
      'requireCoinsForChallenge',
    ]
    
    for (const key of validFields) {
      if (key in updates && updates[key] !== undefined) {
        updateData[key] = updates[key]
      }
    }

    // Try to add freeChallengesPerWeek and requireCoinsForChallenge, but handle gracefully if Prisma client doesn't support them
    let freeChallengesPerWeek: number | undefined = undefined
    if ('freeChallengesPerWeek' in updates && updates.freeChallengesPerWeek !== undefined) {
      freeChallengesPerWeek = updates.freeChallengesPerWeek
    }

    let requireCoinsForChallenge: boolean | undefined = undefined
    if ('requireCoinsForChallenge' in updates && updates.requireCoinsForChallenge !== undefined) {
      requireCoinsForChallenge = updates.requireCoinsForChallenge
    }

    try {
      // First try with all fields included
      const settings = await prisma.beltSettings.update({
        where: { beltType },
        data: {
          ...updateData,
          ...(freeChallengesPerWeek !== undefined && { freeChallengesPerWeek }),
          ...(requireCoinsForChallenge !== undefined && { requireCoinsForChallenge }),
        },
      })

      return NextResponse.json({ settings })
    } catch (prismaError: any) {
      // If fields cause an error, update without them and use raw SQL
      if (prismaError.message?.includes('freeChallengesPerWeek') || prismaError.message?.includes('requireCoinsForChallenge') || prismaError.message?.includes('Unknown argument')) {
        console.warn('[API] Prisma client doesn\'t support some fields yet, using raw SQL fallback')
        
        // Update without problematic fields first
        const settings = await prisma.beltSettings.update({
          where: { beltType },
          data: updateData,
        })

        // Then update using raw SQL if needed
        if (freeChallengesPerWeek !== undefined || requireCoinsForChallenge !== undefined) {
          const updates: string[] = []
          const values: any[] = []
          
          if (freeChallengesPerWeek !== undefined) {
            updates.push('free_challenges_per_week = $' + (values.length + 1))
            values.push(freeChallengesPerWeek)
          }
          
          if (requireCoinsForChallenge !== undefined) {
            updates.push('require_coins_for_challenge = $' + (values.length + 1))
            values.push(requireCoinsForChallenge)
          }
          
          if (updates.length > 0) {
            values.push(beltType)
            await prisma.$executeRawUnsafe(
              `UPDATE belt_settings SET ${updates.join(', ')} WHERE belt_type = $${values.length}`,
              ...values
            )
          }
          
          // Fetch updated settings
          const updatedSettings = await prisma.beltSettings.findUnique({
            where: { beltType },
          })
          
          return NextResponse.json({ settings: updatedSettings })
        }

        return NextResponse.json({ settings })
      }
      
      // Re-throw if it's a different error
      throw prismaError
    }
  } catch (error: any) {
    console.error('Failed to update belt settings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update belt settings' },
      { status: 500 }
    )
  }
}
