import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { sendPushNotifications as sendVAPIDPushNotifications } from '@/lib/web-push/vapid-push'

// POST /api/fcm/send - Send push notification to user(s)
export async function POST(request: NextRequest) {
  try {
    // Verify admin (only admins can manually send push notifications)
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const requestBody = await request.json()
    const { userIds, title, body, data } = requestBody

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'userIds array is required' },
        { status: 400 }
      )
    }

    if (!title || !body) {
      return NextResponse.json(
        { error: 'title and body are required' },
        { status: 400 }
      )
    }

    // Get web push subscriptions for all users
    const tokens = await prisma.fCMToken.findMany({
      where: {
        userId: { in: userIds },
      },
      select: {
        token: true,
      },
    })

    if (tokens.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No push notification subscriptions found for these users',
      })
    }

    // Convert tokens to web push subscriptions
    // The token field contains the subscription JSON for Web Push
    const subscriptions = tokens
      .map((t) => {
        // Try to parse token as subscription JSON
        try {
          const parsed = JSON.parse(t.token)
          // Verify it's a valid subscription object
          if (parsed && parsed.endpoint && parsed.keys && parsed.keys.p256dh && parsed.keys.auth) {
            return parsed
          }
          console.log('[FCM Send] Invalid subscription format:', { token: t.token.substring(0, 50) + '...' })
          return null
        } catch (e) {
          // Not JSON, might be an old FCM token format - skip it
          console.log('[FCM Send] Token is not JSON (old FCM format?):', { token: t.token.substring(0, 50) + '...', error: e })
          return null
        }
      })
      .filter((sub): sub is { endpoint: string; keys: { p256dh: string; auth: string } } => sub !== null)

    console.log('[FCM Send] Found tokens:', tokens.length, 'Valid subscriptions:', subscriptions.length)

    if (subscriptions.length === 0) {
      // Provide helpful error message
      const sampleToken = tokens.length > 0 ? tokens[0].token.substring(0, 100) : 'none'
      return NextResponse.json({
        success: false,
        message: `No valid web push subscriptions found. Found ${tokens.length} token(s), but they appear to be old FCM tokens (not Web Push subscriptions). Please refresh the page to register a new Web Push subscription.`,
        debug: {
          tokenCount: tokens.length,
          sampleToken: sampleToken,
          isJSON: tokens.length > 0 ? (() => {
            try {
              JSON.parse(tokens[0].token)
              return true
            } catch {
              return false
            }
          })() : false,
        },
      })
    }

    // Send push notifications using VAPID
    const result = await sendVAPIDPushNotifications(
      subscriptions,
      {
        title,
        body,
        icon: '/favicon.ico',
        data: data || {},
      }
    )

    // Check if VAPID keys are not configured
    if (result.success === 0 && result.errors.length > 0) {
      const hasVAPIDError = result.errors.some(err => 
        err.includes('VAPID keys not configured')
      )
      
      if (hasVAPIDError) {
        return NextResponse.json({
          success: false,
          sent: 0,
          failed: subscriptions.length,
          errors: result.errors,
          message: 'VAPID keys not configured. Please go to Admin Settings → Push Notifications and add your VAPID keys.',
        })
      }
    }

    return NextResponse.json({
      success: result.success > 0,
      sent: result.success,
      failed: result.failed,
      errors: result.errors,
    })
  } catch (error: any) {
    console.error('Failed to send push notification:', error)
    return NextResponse.json(
      { error: 'Failed to send push notification' },
      { status: 500 }
    )
  }
}

