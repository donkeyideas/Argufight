/**
 * API Route: POST /api/belts/challenge/[id]/accept
 * Accept a belt challenge
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { acceptBeltChallenge } from '@/lib/belts/core'
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

    const result = await acceptBeltChallenge(id)

    // acceptBeltChallenge returns { challenge, debate }
    return NextResponse.json({
      challenge: result.challenge,
      debate: result.debate,
      message: 'Challenge accepted. Debate created successfully.',
    })
  } catch (error: any) {
    console.error('[API] Error accepting challenge:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to accept challenge' },
      { status: 500 }
    )
  }
}
