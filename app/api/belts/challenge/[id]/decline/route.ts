/**
 * API Route: POST /api/belts/challenge/[id]/decline
 * Decline a belt challenge
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { declineBeltChallenge } from '@/lib/belts/core'
import { prisma } from '@/lib/db/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySessionWithDb()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check feature flag
    if (process.env.ENABLE_BELT_SYSTEM !== 'true') {
      return NextResponse.json({ error: 'Belt system is not enabled' }, { status: 403 })
    }

    const { id } = await params

    const challenge = await prisma.beltChallenge.findUnique({
      where: { id },
      include: {
        belt: true,
      },
    })

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    // Verify user is the belt holder
    if (challenge.beltHolderId !== session.userId) {
      return NextResponse.json(
        { error: 'You are not the belt holder' },
        { status: 403 }
      )
    }

    const declinedChallenge = await declineBeltChallenge(id)

    // TODO: Refund coins to challenger (if challenge was declined before debate)
    // await addCoins(challenge.challengerId, challenge.entryFee)

    return NextResponse.json({
      challenge: declinedChallenge,
      message: 'Challenge declined',
    })
  } catch (error: any) {
    console.error('[API] Error declining challenge:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to decline challenge' },
      { status: 500 }
    )
  }
}
