import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

// GET /api/nav-data — consolidated endpoint for TopNav
// Replaces 6 separate API calls with 1
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse linked account IDs from header (for account count)
    let linkedAccountIds: string[] = []
    try {
      const header = request.headers.get('x-linked-accounts')
      if (header) {
        linkedAccountIds = JSON.parse(header)
      }
    } catch {
      // ignore parse errors
    }

    // Run all queries in parallel — single DB round-trip batch
    const [
      unreadCount,
      subscription,
      user,
      beltCount,
      accountSessions,
    ] = await Promise.all([
      // 1. Unread notification count
      prisma.notification.count({
        where: { userId, read: false },
      }),

      // 2. User subscription tier
      prisma.userSubscription.findUnique({
        where: { userId },
        select: { tier: true },
      }),

      // 3. User profile (email for advertiser check + coins)
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, coins: true },
      }),

      // 4. Belt count
      prisma.belt.count({
        where: {
          currentHolderId: userId,
          status: { in: ['ACTIVE', 'MANDATORY', 'STAKED', 'GRACE_PERIOD'] },
        },
      }),

      // 5. Account count (linked accounts)
      linkedAccountIds.length > 0
        ? prisma.session.findMany({
            where: {
              userId: { in: linkedAccountIds },
              expiresAt: { gt: new Date() },
            },
            select: { userId: true },
            distinct: ['userId'],
          })
        : Promise.resolve([]),
    ])

    // 6. Advertiser check (depends on user.email from query 3)
    let isAdvertiser = false
    if (user?.email) {
      const advertiser = await prisma.advertiser.findUnique({
        where: { contactEmail: user.email },
        select: { id: true },
      })
      isAdvertiser = !!advertiser
    }

    return NextResponse.json({
      unreadCount,
      tier: subscription?.tier || 'FREE',
      isAdvertiser,
      accountCount: Math.max(accountSessions.length, 1),
      beltCount,
      coinBalance: user?.coins || 0,
    })
  } catch (error) {
    console.error('[nav-data] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
