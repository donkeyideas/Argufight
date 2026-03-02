/**
 * Push Notification Helpers
 * Integrates FCM push notifications with existing notification system
 */

import { prisma } from '@/lib/db/prisma'
import { sendPushNotifications as sendVAPIDPushNotifications } from '@/lib/web-push/vapid-push'
import { isNotificationTypeEnabled } from './notification-preferences'

/**
 * Parse FCM tokens into valid Web Push subscriptions
 */
function parseSubscriptions(
  tokens: Array<{ token: string }>
): Array<{ endpoint: string; keys: { p256dh: string; auth: string } }> {
  return tokens
    .map((t) => {
      try {
        const parsed = JSON.parse(t.token)
        if (parsed && parsed.endpoint && parsed.keys && parsed.keys.p256dh && parsed.keys.auth) {
          return parsed
        }
        return null
      } catch {
        return null
      }
    })
    .filter((sub): sub is { endpoint: string; keys: { p256dh: string; auth: string } } => sub !== null)
}

/**
 * Clean up invalid subscriptions by endpoint after a failed send
 */
async function cleanupInvalidSubscriptions(
  invalidSubscriptions: Array<{ endpoint: string }>
): Promise<void> {
  if (invalidSubscriptions.length === 0) return

  for (const invalidSub of invalidSubscriptions) {
    await removeInvalidSubscriptionByEndpoint(invalidSub.endpoint).catch(() => {})
  }
  console.log(`[Push Notification] Removed ${invalidSubscriptions.length} invalid subscription(s)`)
}

/**
 * Send push notification when it's a user's turn in a debate
 */
export async function sendYourTurnPushNotification(
  userId: string,
  debateId: string,
  debateTopic: string
): Promise<void> {
  try {
    // Check if DEBATE_TURN notifications are enabled
    const isEnabled = await isNotificationTypeEnabled('DEBATE_TURN')
    if (!isEnabled) {
      console.log(`[Push Notification] DEBATE_TURN notifications are disabled, skipping`)
      return
    }

    // Get user's web push subscriptions
    const tokens = await prisma.fCMToken.findMany({
      where: { userId },
      select: { token: true },
    })

    if (tokens.length === 0) {
      return
    }

    const subscriptions = parseSubscriptions(tokens)
    if (subscriptions.length === 0) {
      return
    }

    // Send push notification using VAPID
    const result = await sendVAPIDPushNotifications(
      subscriptions,
      {
        title: "It's Your Turn!",
        body: `Your opponent submitted their argument in "${debateTopic}"`,
        icon: '/favicon.ico',
        data: {
          type: 'DEBATE_TURN',
          debateId,
          url: `/debate/${debateId}`,
        },
      }
    )

    await cleanupInvalidSubscriptions(result.invalidSubscriptions)
    console.log(`[Push Notification] Sent "Your Turn" to user ${userId} (${result.success} ok, ${result.failed} failed)`)
  } catch (error: any) {
    // Don't throw - push notifications are optional
    console.error(`[Push Notification] Failed to send to user ${userId}:`, error)
  }
}

/**
 * Send push notification for any notification type
 */
export async function sendPushNotificationForNotification(
  userId: string,
  notificationType: string,
  title: string,
  message: string,
  debateId?: string
): Promise<void> {
  try {
    // Check if this notification type is enabled
    const isEnabled = await isNotificationTypeEnabled(notificationType)
    if (!isEnabled) {
      console.log(`[Push Notification] ${notificationType} notifications are disabled, skipping`)
      return
    }

    // Get user's web push subscriptions
    const tokens = await prisma.fCMToken.findMany({
      where: { userId },
      select: { token: true },
    })

    if (tokens.length === 0) {
      return
    }

    const subscriptions = parseSubscriptions(tokens)
    if (subscriptions.length === 0) {
      return
    }

    // Build URL based on notification type
    let url = '/'
    if (debateId) {
      url = `/debate/${debateId}`
    } else if (notificationType === 'NEW_CHALLENGE') {
      url = '/debates'
    }

    // Send push notification using VAPID
    const result = await sendVAPIDPushNotifications(
      subscriptions,
      {
        title,
        body: message,
        icon: '/favicon.ico',
        data: {
          type: notificationType,
          debateId: debateId || undefined,
          url,
        },
      }
    )

    await cleanupInvalidSubscriptions(result.invalidSubscriptions)
    console.log(`[Push Notification] Sent ${notificationType} to user ${userId} (${result.success} ok, ${result.failed} failed)`)
  } catch (error: any) {
    console.error(`[Push Notification] Failed to send to user ${userId}:`, error)
  }
}

/**
 * Remove invalid subscription by endpoint (matches endpoint inside stored JSON)
 */
async function removeInvalidSubscriptionByEndpoint(endpoint: string): Promise<void> {
  try {
    const allTokens = await prisma.fCMToken.findMany({
      select: { id: true, token: true },
    })
    const toDelete = allTokens.filter(t => {
      try {
        const parsed = JSON.parse(t.token)
        return parsed.endpoint === endpoint
      } catch {
        return false
      }
    })
    if (toDelete.length > 0) {
      await prisma.fCMToken.deleteMany({
        where: { id: { in: toDelete.map(t => t.id) } },
      })
    }
  } catch (error) {
    console.error('[Push Notification] Failed to remove invalid subscription:', error)
  }
}

/**
 * Clean up invalid FCM tokens (called when push fails with invalid token error)
 */
export async function removeInvalidFCMToken(token: string): Promise<void> {
  try {
    await prisma.fCMToken.deleteMany({
      where: { token },
    })
    console.log(`[Push Notification] Removed invalid token`)
  } catch (error) {
    console.error('Failed to remove invalid FCM token:', error)
  }
}
