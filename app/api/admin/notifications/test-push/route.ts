import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { sendPushNotifications } from '@/lib/web-push/vapid-push'

export const dynamic = 'force-dynamic'

// POST /api/admin/notifications/test-push - Send test push to current admin
export async function POST() {
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

    // Get admin's subscriptions
    const tokens = await prisma.fCMToken.findMany({
      where: { userId },
      select: { id: true, token: true, createdAt: true, updatedAt: true },
    })

    if (tokens.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No push subscriptions found for your account. Please enable notifications and reload the page first.',
        diagnostics: { tokenCount: 0 },
      })
    }

    // Parse and validate subscriptions
    const subscriptions: Array<{ endpoint: string; keys: { p256dh: string; auth: string } }> = []
    const invalidTokenIds: string[] = []
    for (const t of tokens) {
      try {
        const parsed = JSON.parse(t.token)
        if (parsed?.endpoint && parsed?.keys?.p256dh && parsed?.keys?.auth) {
          subscriptions.push(parsed)
        } else {
          invalidTokenIds.push(t.id)
        }
      } catch {
        invalidTokenIds.push(t.id)
      }
    }

    if (subscriptions.length === 0) {
      return NextResponse.json({
        success: false,
        message: `Found ${tokens.length} token(s) but none are valid Web Push subscriptions. Try clearing tokens and reloading.`,
        diagnostics: { tokenCount: tokens.length, validSubscriptions: 0, invalidTokens: invalidTokenIds.length },
      })
    }

    // Send test notification
    const result = await sendPushNotifications(subscriptions, {
      title: 'Test Push Notification',
      body: `This is a test from ArguFight admin panel. Sent at ${new Date().toLocaleTimeString()}.`,
      icon: '/favicon.ico',
      data: { type: 'TEST', url: '/admin/notifications' },
    })

    // Clean up invalid subscriptions that were found during send
    if (result.invalidSubscriptions.length > 0) {
      const invalidEndpoints = result.invalidSubscriptions.map(s => s.endpoint)
      for (const t of tokens) {
        try {
          const parsed = JSON.parse(t.token)
          if (invalidEndpoints.includes(parsed.endpoint)) {
            invalidTokenIds.push(t.id)
          }
        } catch { /* skip */ }
      }
    }

    if (invalidTokenIds.length > 0) {
      await prisma.fCMToken.deleteMany({
        where: { id: { in: invalidTokenIds } },
      })
    }

    return NextResponse.json({
      success: result.success > 0,
      message: result.success > 0
        ? `Push notification sent successfully! (${result.success} delivered, ${result.failed} failed)`
        : `All ${result.failed} send(s) failed. Your subscriptions may be expired — try clearing tokens and reloading.`,
      diagnostics: {
        totalTokens: tokens.length,
        validSubscriptions: subscriptions.length,
        invalidTokensCleaned: invalidTokenIds.length,
        sendResult: { success: result.success, failed: result.failed, errors: result.errors },
      },
    })
  } catch (error: any) {
    console.error('Test push failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
