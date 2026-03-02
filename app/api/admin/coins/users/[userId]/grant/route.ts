import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'
import { addCoins } from '@/lib/belts/coin-economics'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/coins/users/[userId]/grant
 * Grant coins to a user (admin)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await verifySessionWithDb()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true, username: true },
    })

    if (!admin?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userId } = await params
    const body = await request.json()
    const { amount, reason } = body

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Grant coins
    await addCoins(userId, amount, {
      type: 'ADMIN_GRANT',
      description: reason || `Coins granted by admin ${admin.username}`,
      metadata: {
        grantedBy: session.userId,
        grantedByUsername: admin.username,
        reason: reason || 'Admin grant',
      },
    })

    return NextResponse.json({ success: true, message: `Granted ${amount} coins to ${user.username}` })
  } catch (error: any) {
    console.error('[API] Error granting coins:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to grant coins' },
      { status: 500 }
    )
  }
}
