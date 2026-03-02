import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'


/**
 * GET /api/admin/coins/users
 * Get users who have purchased coins (admin)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await verifySessionWithDb()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all users who have made coin purchases
    const purchaseTransactions = await prisma.coinTransaction.findMany({
      where: {
        type: 'COIN_PURCHASE',
        status: 'COMPLETED',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatarUrl: true,
            coins: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Group by user and calculate totals
    const userMap = new Map<string, {
      id: string
      username: string
      email: string
      avatarUrl: string | null
      coins: number
      totalPurchased: number
      purchaseCount: number
      lastPurchase: string | null
    }>()

    purchaseTransactions.forEach((tx) => {
      const userId = tx.userId
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          id: tx.user.id,
          username: tx.user.username,
          email: tx.user.email,
          avatarUrl: tx.user.avatarUrl,
          coins: tx.user.coins,
          totalPurchased: 0,
          purchaseCount: 0,
          lastPurchase: null,
        })
      }

      const userData = userMap.get(userId)!
      userData.totalPurchased += tx.amount
      userData.purchaseCount += 1
      
      // Update last purchase date
      if (!userData.lastPurchase || new Date(tx.createdAt) > new Date(userData.lastPurchase)) {
        userData.lastPurchase = tx.createdAt.toISOString()
      }
    })

    const users = Array.from(userMap.values()).sort((a, b) => {
      // Sort by total purchased (descending)
      return b.totalPurchased - a.totalPurchased
    })

    return NextResponse.json({ users })
  } catch (error: any) {
    console.error('[API] Error fetching coin users:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
