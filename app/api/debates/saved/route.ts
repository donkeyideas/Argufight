import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

// GET /api/debates/saved - Get user's saved debates
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Get saved debates for user
    const savedDebates = await prisma.debateSave.findMany({
      where: { userId },
      include: {
        debate: {
          select: {
            id: true,
            topic: true,
            category: true,
            status: true,
            challengerId: true,
            opponentId: true,
            winnerId: true,
            endedAt: true,
            createdAt: true,
            currentRound: true,
            totalRounds: true,
            roundDeadline: true,
            spectatorCount: true,
            challengerPosition: true,
            opponentPosition: true,
            challenger: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                eloRating: true,
              }
            },
            opponent: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                eloRating: true,
              }
            },
            images: {
              select: {
                id: true,
                url: true,
                alt: true,
                caption: true,
                order: true,
              },
              orderBy: {
                order: 'asc',
              },
            },
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    })

    // Get total count
    const totalCount = await prisma.debateSave.count({
      where: { userId },
    })

    // Format response
    const debates = savedDebates.map(save => ({
      ...save.debate,
      savedAt: save.createdAt,
    }))

    return NextResponse.json({
      debates,
      total: totalCount,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Failed to fetch saved debates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch saved debates' },
      { status: 500 }
    )
  }
}

