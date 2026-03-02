import { NextRequest, NextResponse } from 'next/server'
import { checkInactiveBelts } from '@/lib/belts/core'
import { prisma } from '@/lib/db/prisma'
import { verifyCronAuth } from '@/lib/auth/cron-auth'

// POST /api/cron/belt-tasks - Run belt system maintenance tasks
export async function POST(request: NextRequest) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const results = {
      inactiveBeltsChecked: 0,
      expiredChallengesCleaned: 0,
      errors: [] as string[],
    }

    // 1. Check for inactive belts
    try {
      const inactiveResult = await checkInactiveBelts()
      results.inactiveBeltsChecked = inactiveResult.beltsMarkedInactive || 0
    } catch (error: any) {
      results.errors.push(`Inactive belt check failed: ${error.message}`)
      console.error('Failed to check inactive belts:', error)
    }

    // 2. Clean up expired challenges
    try {
      const now = new Date()
      const expiredChallenges = await prisma.beltChallenge.updateMany({
        where: {
          status: 'PENDING',
          expiresAt: {
            lt: now,
          },
        },
        data: {
          status: 'EXPIRED',
        },
      })
      results.expiredChallengesCleaned = expiredChallenges.count
    } catch (error: any) {
      results.errors.push(`Expired challenge cleanup failed: ${error.message}`)
      console.error('Failed to clean up expired challenges:', error)
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Belt tasks cron failed:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to run belt tasks' },
      { status: 500 }
    )
  }
}
