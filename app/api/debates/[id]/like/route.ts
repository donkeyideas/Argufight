import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

// POST /api/debates/[id]/like - Toggle like on a debate
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: debateId } = await params

    // Check if debate exists
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
    })

    if (!debate) {
      return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
    }

    // Check if already liked
    const existingLike = await prisma.debateLike.findUnique({
      where: {
        debateId_userId: {
          debateId,
          userId,
        },
      },
    })

    if (existingLike) {
      // Unlike
      await prisma.debateLike.delete({
        where: { id: existingLike.id },
      })

      return NextResponse.json({
        success: true,
        liked: false,
        message: 'Debate unliked',
      })
    } else {
      // Like
      await prisma.debateLike.create({
        data: {
          debateId,
          userId,
        },
      })

      return NextResponse.json({
        success: true,
        liked: true,
        message: 'Debate liked',
      })
    }
  } catch (error) {
    console.error('Like error:', error)
    return NextResponse.json(
      { error: 'Failed to toggle like' },
      { status: 500 }
    )
  }
}

// GET /api/debates/[id]/like - Check if user has liked this debate
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ liked: false, count: 0 })
    }

    const { id: debateId } = await params

    const [isLiked, likeCount] = await Promise.all([
      prisma.debateLike.findUnique({
        where: {
          debateId_userId: {
            debateId,
            userId,
          },
        },
      }),
      prisma.debateLike.count({
        where: { debateId },
      }),
    ])

    return NextResponse.json({
      liked: !!isLiked,
      count: likeCount,
    })
  } catch (error) {
    console.error('Get like error:', error)
    return NextResponse.json(
      { error: 'Failed to get like status' },
      { status: 500 }
    )
  }
}










