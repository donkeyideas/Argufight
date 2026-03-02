/**
 * Web Push API with VAPID Keys
 * Pure web push implementation that doesn't require Firebase
 * Uses the standard Web Push Protocol with VAPID authentication
 */

import { prisma } from '@/lib/db/prisma'
import * as webpush from 'web-push'

export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  data?: {
    debateId?: string
    type?: string
    url?: string
    [key: string]: any
  }
}

let vapidKeysConfigured = false

/**
 * Configure VAPID keys from admin settings
 */
async function configureVAPIDKeys(): Promise<boolean> {
  if (vapidKeysConfigured) {
    return true
  }

  try {
    // Get VAPID keys from admin settings
    const [publicKeySetting, privateKeySetting] = await Promise.all([
      prisma.adminSetting.findUnique({ where: { key: 'VAPID_PUBLIC_KEY' } }),
      prisma.adminSetting.findUnique({ where: { key: 'VAPID_PRIVATE_KEY' } }),
    ])

    const publicKey = publicKeySetting?.value || process.env.VAPID_PUBLIC_KEY
    const privateKey = privateKeySetting?.value || process.env.VAPID_PRIVATE_KEY

    if (!publicKey || !privateKey) {
      console.warn('[Web Push] VAPID keys not configured')
      return false
    }

    // Set VAPID details
    webpush.setVapidDetails(
      'mailto:admin@argufight.com', // Contact email (can be changed in admin settings)
      publicKey,
      privateKey
    )

    vapidKeysConfigured = true
    console.log('[Web Push] VAPID keys configured successfully')
    return true
  } catch (error) {
    console.error('[Web Push] Failed to configure VAPID keys:', error)
    return false
  }
}

/**
 * Send push notification to a single subscription
 */
export async function sendPushNotification(
  subscription: {
    endpoint: string
    keys: {
      p256dh: string
      auth: string
    }
  },
  payload: PushNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    // Ensure VAPID keys are configured
    const configured = await configureVAPIDKeys()
    if (!configured) {
      return {
        success: false,
        error: 'VAPID keys not configured. Please add VAPID keys in Admin Settings.',
      }
    }

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/favicon.ico',
      badge: payload.badge || '/favicon.ico',
      data: payload.data || {},
      url: payload.data?.url || '/',
    })

    await webpush.sendNotification(subscription, notificationPayload)

    return { success: true }
  } catch (error: any) {
    console.error('[Web Push] Failed to send push notification:', error)

    // Handle specific error codes
    if (error.statusCode === 410) {
      // Subscription expired or invalid
      return {
        success: false,
        error: 'INVALID_SUBSCRIPTION', // Special error code to indicate subscription should be removed
      }
    }

    if (error.statusCode === 429) {
      // Rate limited
      return {
        success: false,
        error: 'Rate limited. Please try again later.',
      }
    }

    return {
      success: false,
      error: error.message || 'Unknown error',
    }
  }
}

/**
 * Send push notification to multiple subscriptions
 */
export async function sendPushNotifications(
  subscriptions: Array<{
    endpoint: string
    keys: {
      p256dh: string
      auth: string
    }
  }>,
  payload: PushNotificationPayload
): Promise<{
  success: number
  failed: number
  errors: string[]
  invalidSubscriptions: Array<{ endpoint: string; keys: { p256dh: string; auth: string } }>
}> {
  const results = await Promise.allSettled(
    subscriptions.map((sub) => sendPushNotification(sub, payload))
  )

  let success = 0
  let failed = 0
  const errors: string[] = []
  const invalidSubscriptions: typeof subscriptions = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.success) {
      success++
    } else {
      failed++
      const error =
        result.status === 'rejected'
          ? result.reason?.message || 'Unknown error'
          : result.value.error || 'Unknown error'
      errors.push(`Subscription ${index + 1}: ${error}`)

      if (error === 'INVALID_SUBSCRIPTION') {
        invalidSubscriptions.push(subscriptions[index])
      }
    }
  })

  return { success, failed, errors, invalidSubscriptions }
}

/**
 * Send push notification to a user by their FCM token
 * This function converts FCM tokens to web push subscriptions
 * Note: FCM tokens are actually web push subscriptions in JSON format
 */
export async function sendPushNotificationToToken(
  token: string,
  payload: PushNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    // FCM tokens are actually web push subscriptions stored as JSON strings
    // Parse the token to get the subscription object
    let subscription: {
      endpoint: string
      keys: {
        p256dh: string
        auth: string
      }
    }

    try {
      // Try to parse as JSON (if it's a stored subscription)
      subscription = JSON.parse(token)
      // Verify it's a valid subscription object
      if (!subscription.endpoint || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
        return {
          success: false,
          error: 'Invalid subscription format. Token must be a web push subscription object.',
        }
      }
    } catch {
      // If parsing fails, it might be an FCM token format
      // For web push, we need the subscription object
      // The token field should contain the subscription JSON
      return {
        success: false,
        error: 'Invalid subscription format. Token must be a web push subscription object.',
      }
    }

    return await sendPushNotification(subscription, payload)
  } catch (error: any) {
    console.error('[Web Push] Failed to send push notification to token:', error)
    return {
      success: false,
      error: error.message || 'Unknown error',
    }
  }
}
