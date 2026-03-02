import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifySessionWithDb } from '@/lib/auth/session-verify'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySessionWithDb()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const beltId = id

    const belt = await prisma.belt.findUnique({
      where: { id: beltId },
      select: {
        id: true,
        name: true,
        type: true,
        category: true,
        status: true,
        coinValue: true,
        designImageUrl: true,
        currentHolderId: true,
        acquiredAt: true,
        lastDefendedAt: true,
        timesDefended: true,
        successfulDefenses: true,
        isStaked: true,
        currentHolder: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            eloRating: true,
          },
        },
        challenges: {
          where: {
            status: 'PENDING',
          },
          select: {
            id: true,
            challenger: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                eloRating: true,
              },
            },
            status: true,
            entryFee: true,
            coinReward: true,
            expiresAt: true,
            createdAt: true,
            debateTopic: true,
            debateDescription: true,
            debateCategory: true,
            debateChallengerPosition: true,
            debateTotalRounds: true,
            debateRoundDuration: true,
            debateSpeedMode: true,
            debateAllowCopyPaste: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    })

    if (!belt) {
      return NextResponse.json({ error: 'Belt not found' }, { status: 404 })
    }

    return NextResponse.json({ belt })
  } catch (error) {
    console.error('Failed to fetch belt:', error)
    return NextResponse.json(
      { error: 'Failed to fetch belt' },
      { status: 500 }
    )
  }
}
