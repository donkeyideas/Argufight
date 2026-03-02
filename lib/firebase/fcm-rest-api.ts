/**
 * Firebase Cloud Messaging via REST API
 * Used when service account keys are blocked by organization policies
 * Uses OAuth2 access token instead
 */

import { prisma } from '@/lib/db/prisma'
import { OAuth2Client } from 'google-auth-library'

let oauth2Client: OAuth2Client | null = null
let accessToken: string | null = null
let tokenExpiry: number = 0

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
 * Get OAuth2 access token for Firebase
 */
async function getAccessToken(): Promise<string | null> {
  try {
    // Check if we have a valid token
    if (accessToken && Date.now() < tokenExpiry) {
      return accessToken
    }

    // Get OAuth2 credentials from admin settings
    const settings = await prisma.adminSetting.findMany({
      where: {
        key: {
          in: ['FIREBASE_OAUTH_CLIENT_ID', 'FIREBASE_OAUTH_CLIENT_SECRET', 'FIREBASE_OAUTH_REFRESH_TOKEN'],
        },
      },
    })

    const configMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, string>)

    if (
      !configMap.FIREBASE_OAUTH_CLIENT_ID ||
      !configMap.FIREBASE_OAUTH_CLIENT_SECRET ||
      !configMap.FIREBASE_OAUTH_REFRESH_TOKEN
    ) {
      console.error('OAuth2 credentials not configured for Firebase')
      return null
    }

    if (!oauth2Client) {
      oauth2Client = new OAuth2Client(
        configMap.FIREBASE_OAUTH_CLIENT_ID,
        configMap.FIREBASE_OAUTH_CLIENT_SECRET,
        'urn:ietf:wg:oauth:2.0:oob'
      )
    }

    oauth2Client.setCredentials({
      refresh_token: configMap.FIREBASE_OAUTH_REFRESH_TOKEN,
    })

    const { token } = await oauth2Client.getAccessToken()
    if (!token) {
      console.error('Failed to get OAuth2 access token')
      return null
    }

    accessToken = token
    tokenExpiry = Date.now() + 55 * 60 * 1000 // Refresh 5 min early

    return token
  } catch (error) {
    console.error('Failed to get OAuth2 access token:', error)
    return null
  }
}

/**
 * Get Firebase project ID
 */
async function getProjectId(): Promise<string | null> {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'FIREBASE_PROJECT_ID' },
    })
    return setting?.value || process.env.FIREBASE_PROJECT_ID || null
  } catch {
    return null
  }
}

/**
 * Send push notification via REST API
 */
export async function sendPushNotificationREST(
  token: string,
  payload: PushNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getAccessToken()
    const projectId = await getProjectId()

    if (!accessToken || !projectId) {
      return {
        success: false,
        error: 'Firebase OAuth2 not configured. Please set up OAuth2 credentials in Admin Settings.',
      }
    }

    const message = {
      message: {
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
      },
    }

    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(message),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('FCM REST API error:', errorData)

      // Check for invalid token
      if (
        errorData.error?.status === 'INVALID_ARGUMENT' ||
        errorData.error?.message?.includes('Invalid registration token')
      ) {
        return {
          success: false,
          error: 'INVALID_TOKEN',
        }
      }

      return {
        success: false,
        error: errorData.error?.message || `HTTP ${response.status}`,
      }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Failed to send push notification via REST API:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Send push notifications to multiple tokens via REST API
 */
export async function sendPushNotificationsREST(
  tokens: string[],
  payload: PushNotificationPayload
): Promise<{ success: number; failed: number; errors: string[] }> {
  if (tokens.length === 0) {
    return { success: 0, failed: 0, errors: [] }
  }

  let success = 0
  let failed = 0
  const errors: string[] = []

  // FCM REST API requires sending one at a time (or use batch, but simpler to do individually)
  for (const token of tokens) {
    const result = await sendPushNotificationREST(token, payload)
    if (result.success) {
      success++
    } else {
      failed++
      if (result.error) {
        errors.push(result.error)
      }
    }
  }

  return { success, failed, errors }
}

