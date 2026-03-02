import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { getUserAppealLimit, adjustAppealCount, setMonthlyLimit } from '@/lib/utils/appeal-limits'

export const dynamic = 'force-dynamic'

// GET /api/admin/appeals - Get all appeal limits and statistics
export async function GET(request: NextRequest) {
  try {
    const adminUserId = await verifyAdmin()
    if (!adminUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (userId) {
      // Get specific user's appeal limit
      const appealLimit = await prisma.appealLimit.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      })

      // Get user's appeal subscriptions
      const subscriptions = await prisma.appealSubscription.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      })

      // Get user's appeal history
      const appealHistory = await prisma.debate.findMany({
        where: {
          appealedBy: userId,
          appealCount: { gt: 0 },
        },
        select: {
          id: true,
          topic: true,
          appealStatus: true,
          appealedAt: true,
          appealReason: true,
          winnerId: true,
          originalWinnerId: true,
        },
        orderBy: { appealedAt: 'desc' },
        take: 20,
      })

      return NextResponse.json({
        appealLimit,
        subscriptions,
        appealHistory,
      })
    }

    // Get all appeal limits with statistics
    const appealLimits = await prisma.appealLimit.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })

    // Get system-wide statistics
    const totalAppeals = await prisma.debate.count({
      where: { appealCount: { gt: 0 } },
    })

    const pendingAppeals = await prisma.debate.count({
      where: {
        appealStatus: 'PENDING',
        appealCount: { gt: 0 },
      },
    })

    const resolvedAppeals = await prisma.debate.count({
      where: {
        appealStatus: 'RESOLVED',
        appealCount: { gt: 0 },
      },
    })

    return NextResponse.json({
      appealLimits,
      statistics: {
        totalAppeals,
        pendingAppeals,
        resolvedAppeals,
        totalUsers: appealLimits.length,
      },
    })
  } catch (error: any) {
    console.error('Failed to fetch appeal data:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch appeal data' },
      { status: error.status || 500 }
    )
  }
}

// POST /api/admin/appeals - Adjust appeal count or limit
export async function POST(request: NextRequest) {
  try {
    const adminUserId = await verifyAdmin()
    if (!adminUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, action, value } = body

    if (!userId || !action) {
      return NextResponse.json(
        { error: 'userId and action are required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'adjust':
        if (typeof value !== 'number') {
          return NextResponse.json(
            { error: 'value must be a number for adjust action' },
            { status: 400 }
          )
        }
        const updatedLimit = await adjustAppealCount(userId, value)
        return NextResponse.json({ success: true, appealLimit: updatedLimit })

      case 'setLimit':
        if (typeof value !== 'number' || value < 0) {
          return NextResponse.json(
            { error: 'value must be a non-negative number for setLimit action' },
            { status: 400 }
          )
        }
        const updatedLimit2 = await setMonthlyLimit(userId, value)
        return NextResponse.json({ success: true, appealLimit: updatedLimit2 })

      case 'reset':
        const appealLimit = await getUserAppealLimit(userId)
        const resetDate = new Date()
        resetDate.setMonth(resetDate.getMonth() + 1)
        resetDate.setDate(1)
        
        const resetLimit = await prisma.appealLimit.update({
          where: { id: appealLimit.id },
          data: {
            currentCount: 0,
            resetDate,
          },
        })
        return NextResponse.json({ success: true, appealLimit: resetLimit })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: adjust, setLimit, or reset' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('Failed to update appeal limit:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update appeal limit' },
      { status: error.status || 500 }
    )
  }
}

