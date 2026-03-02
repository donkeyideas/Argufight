import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/notifications/clear-tokens - Get push subscription stats
export async function GET() {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized', reason: 'no_session' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', reason: 'no_user_id' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden', reason: 'not_admin', userId }, { status: 403 })
    }

    const totalTokens = await prisma.fCMToken.count()
    const uniqueUsers = await prisma.fCMToken.groupBy({
      by: ['userId'],
    })

    const allTokens = await prisma.fCMToken.findMany({
      select: { token: true, createdAt: true, updatedAt: true },
      take: 200,
    })

    let validSubscriptions = 0
    let invalidTokens = 0
    for (const t of allTokens) {
      try {
        const parsed = JSON.parse(t.token)
        if (parsed.endpoint && parsed.keys?.p256dh && parsed.keys?.auth) {
          validSubscriptions++
        } else {
          invalidTokens++
        }
      } catch {
        invalidTokens++
      }
    }

    return NextResponse.json({
      totalTokens,
      uniqueUsers: uniqueUsers.length,
      sampleSize: allTokens.length,
      validSubscriptions,
      invalidTokens,
    })
  } catch (error: any) {
    console.error('Failed to get push subscription stats:', error)
    return NextResponse.json({ error: 'Failed to get stats', details: error.message }, { status: 500 })
  }
}

// DELETE /api/admin/notifications/clear-tokens - Purge all push subscriptions
export async function DELETE() {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized', reason: 'no_session' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', reason: 'no_user_id' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden', reason: 'not_admin', userId }, { status: 403 })
    }

    const deleted = await prisma.fCMToken.deleteMany({})

    console.log(`[Admin] Cleared ${deleted.count} push notification subscriptions`)

    return NextResponse.json({
      success: true,
      deletedCount: deleted.count,
      message: `Cleared ${deleted.count} push notification subscription(s). Users will need to reload the page to re-register.`,
    })
  } catch (error: any) {
    console.error('Failed to clear push subscriptions:', error)
    return NextResponse.json({ error: 'Failed to clear push subscriptions', details: error.message }, { status: 500 })
  }
}
