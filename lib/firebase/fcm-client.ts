/**
 * Firebase Cloud Messaging Client
 * Handles sending push notifications via FCM
 * Falls back to REST API if Admin SDK (service account) is not available
 */

import { getMessagingInstance } from './admin'
import { sendPushNotificationREST, sendPushNotificationsREST } from './fcm-rest-api'

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

/**
 * Send push notification to a single FCM token
 */
export async function sendPushNotification(
  token: string,
  payload: PushNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    // Try Admin SDK first (if service account is available)
    const messaging = await getMessagingInstance()

    if (!messaging) {
      // Fallback to REST API with OAuth2
      console.log('Firebase Admin SDK not available, using REST API with OAuth2')
      return await sendPushNotificationREST(token, payload)
    }

    const message = {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        ...payload.data,
        click_action: payload.data?.url || '/',
      },
      webpush: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: payload.icon || '/favicon.ico',
          badge: payload.badge || '/favicon.ico',
        },
        fcmOptions: {
          link: payload.data?.url || '/',
        },
      },
    }

    await messaging.send(message)

    return { success: true }
  } catch (error: any) {
    console.error('Failed to send push notification:', error)
    
    // Check if token is invalid
    if (
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered' ||
      error.code === 'messaging/invalid-argument'
    ) {
      return {
        success: false,
        error: 'INVALID_TOKEN', // Special error code to indicate token should be removed
      }
    }

    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Send push notification to multiple FCM tokens
 */
export async function sendPushNotifications(
  tokens: string[],
  payload: PushNotificationPayload
): Promise<{ success: number; failed: number; errors: string[] }> {
  if (tokens.length === 0) {
    return { success: 0, failed: 0, errors: [] }
  }

  // Try Admin SDK first (if service account is available)
  const messaging = await getMessagingInstance()

  if (!messaging) {
    // Fallback to REST API with OAuth2
    console.log('Firebase Admin SDK not available, using REST API with OAuth2')
    const restResult = await sendPushNotificationsREST(tokens, payload)
    
    // Check if REST API also failed due to missing config
    if (restResult.success === 0 && restResult.errors.some(err => err.includes('OAuth2 not configured'))) {
      return {
        success: 0,
        failed: tokens.length,
        errors: ['Firebase Service Account not configured. Please add Service Account JSON in Admin Settings → Firebase Push Notifications.'],
      }
    }
    
    return restResult
  }

  // FCM allows up to 500 tokens per batch with sendMulticast
  const batchSize = 500
  let success = 0
  let failed = 0
  const errors: string[] = []

  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize)

    try {
      const message = {
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          ...payload.data,
          click_action: payload.data?.url || '/',
        },
        webpush: {
          notification: {
            title: payload.title,
            body: payload.body,
            icon: payload.icon || '/favicon.ico',
            badge: payload.badge || '/favicon.ico',
          },
          fcmOptions: {
            link: payload.data?.url || '/',
          },
        },
      }

      const response = await messaging.sendEachForMulticast({
        tokens: batch,
        ...message,
      })

      success += response.successCount
      failed += response.failureCount

      // Collect errors
      response.responses.forEach((resp, index) => {
        if (!resp.success && resp.error) {
          errors.push(`Token ${batch[index]}: ${resp.error.message}`)
        }
      })
    } catch (error: any) {
      failed += batch.length
      errors.push(error.message || 'Unknown error')
    }
  }

  return { success, failed, errors }
}

