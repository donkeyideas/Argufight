import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

// POST /api/fcm/register - Register FCM token for push notifications
export async function POST(request: NextRequest) {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { token, subscription, device, userAgent } = body

    // Accept either token (FCM) or subscription (Web Push)
    if (!token && !subscription) {
      return NextResponse.json(
        { error: 'Either token (FCM) or subscription (Web Push) is required' },
        { status: 400 }
      )
    }

    // Store subscription as JSON string in token field for Web Push
    const tokenValue = subscription
      ? JSON.stringify(subscription)
      : token

    console.log(`[FCM Register] Registering ${subscription ? 'Web Push subscription' : 'FCM token'} for user ${userId}`)
    if (subscription) {
      console.log(`[FCM Register] Subscription endpoint: ${subscription.endpoint.substring(0, 50)}...`)
    }

    // For Web Push subscriptions: clean up old subscriptions with same endpoint for this user
    // This replaces the broken upsert that searched by endpoint URL but stored full JSON
    if (subscription) {
      const existingTokens = await prisma.fCMToken.findMany({
        where: { userId },
        select: { id: true, token: true },
      })

      const tokensToDelete = existingTokens
        .filter(t => {
          try {
            const parsed = JSON.parse(t.token)
            return parsed.endpoint === subscription.endpoint
          } catch {
            return false
          }
        })
        .map(t => t.id)

      if (tokensToDelete.length > 0) {
        await prisma.fCMToken.deleteMany({
          where: { id: { in: tokensToDelete } },
        })
        console.log(`[FCM Register] Cleaned up ${tokensToDelete.length} old subscription(s) for same endpoint`)
      }
    }

    // Create or update the token record
    await prisma.fCMToken.upsert({
      where: { token: tokenValue },
      update: {
        userId,
        device: device || null,
        userAgent: userAgent || null,
        updatedAt: new Date(),
      },
      create: {
        userId,
        token: tokenValue,
        device: device || null,
        userAgent: userAgent || null,
      },
    })

    console.log(`[FCM] Registered ${subscription ? 'Web Push subscription' : 'FCM token'} for user ${userId}`)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to register FCM token:', error)
    return NextResponse.json(
      { error: 'Failed to register FCM token' },
      { status: 500 }
    )
  }
}

// DELETE /api/fcm/register - Unregister FCM token(s)
export async function DELETE(request: NextRequest) {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (token) {
      // Delete specific token (only if it belongs to this user)
      await prisma.fCMToken.deleteMany({
        where: {
          token,
          userId,
        },
      })
      console.log(`[FCM] Unregistered token for user ${userId}`)
    } else {
      // Delete all tokens for this user (useful for clearing old tokens)
      const deleted = await prisma.fCMToken.deleteMany({
        where: {
          userId,
        },
      })
      console.log(`[FCM] Unregistered all ${deleted.count} token(s) for user ${userId}`)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to unregister FCM token:', error)
    return NextResponse.json(
      { error: 'Failed to unregister FCM token' },
      { status: 500 }
    )
  }
}

