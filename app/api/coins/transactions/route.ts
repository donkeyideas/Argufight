import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'

/**
 * GET /api/coins/transactions
 * Get current user's coin transactions
 */
export async function GET(request: NextRequest) {
  try {
    const session = await verifySessionWithDb()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const transactions = await prisma.coinTransaction.findMany({
      where: {
        userId: session.userId,
      },
      include: {
        beltChallenge: {
          include: {
            belt: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        belt: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Limit to last 100 transactions
    })

    return NextResponse.json({ transactions })
  } catch (error: any) {
    console.error('[API] Error fetching coin transactions:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}
