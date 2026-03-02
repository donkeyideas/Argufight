/**
 * Firebase Admin SDK with OAuth2 (Alternative to Service Account)
 * Used when organization policies block service account key creation
 */

import { initializeApp, getApps, App } from 'firebase-admin/app'
import { getMessaging, Messaging } from 'firebase-admin/messaging'
import { prisma } from '@/lib/db/prisma'
import { OAuth2Client } from 'google-auth-library'

let adminApp: App | null = null
let messaging: Messaging | null = null
let oauth2Client: OAuth2Client | null = null
let accessToken: string | null = null
let tokenExpiry: number = 0

/**
 * Get OAuth2 credentials from admin settings
 */
async function getOAuth2Credentials(): Promise<{
  clientId: string
  clientSecret: string
  refreshToken: string
} | null> {
  try {
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
      configMap.FIREBASE_OAUTH_CLIENT_ID &&
      configMap.FIREBASE_OAUTH_CLIENT_SECRET &&
      configMap.FIREBASE_OAUTH_REFRESH_TOKEN
    ) {
      return {
        clientId: configMap.FIREBASE_OAUTH_CLIENT_ID,
        clientSecret: configMap.FIREBASE_OAUTH_CLIENT_SECRET,
        refreshToken: configMap.FIREBASE_OAUTH_REFRESH_TOKEN,
      }
    }

    return null
  } catch (error) {
    console.error('Failed to get OAuth2 credentials:', error)
    return null
  }
}

/**
 * Get or refresh access token
 */
async function getAccessToken(): Promise<string | null> {
  try {
    // Check if we have a valid token
    if (accessToken && Date.now() < tokenExpiry) {
      return accessToken
    }

    const credentials = await getOAuth2Credentials()
    if (!credentials) {
      console.error('OAuth2 credentials not configured')
      return null
    }

    if (!oauth2Client) {
      oauth2Client = new OAuth2Client(
        credentials.clientId,
        credentials.clientSecret,
        'urn:ietf:wg:oauth:2.0:oob' // Out-of-band redirect
      )
    }

    // Set refresh token
    oauth2Client.setCredentials({
      refresh_token: credentials.refreshToken,
    })

    // Get new access token
    const { token } = await oauth2Client.getAccessToken()
    if (!token) {
      console.error('Failed to get access token')
      return null
    }

    accessToken = token
    // Tokens typically expire in 1 hour, refresh 5 minutes early
    tokenExpiry = Date.now() + 55 * 60 * 1000

    return token
  } catch (error) {
    console.error('Failed to refresh access token:', error)
    return null
  }
}

/**
 * Initialize Firebase Admin SDK with OAuth2
 */
export async function getFirebaseAdminOAuth(): Promise<{ app: App; messaging: Messaging } | null> {
  try {
    // Return existing instance if already initialized
    if (adminApp && messaging) {
      return { app: adminApp, messaging }
    }

    const token = await getAccessToken()
    if (!token) {
      console.error('Failed to get OAuth2 access token')
      return null
    }

    // Initialize Firebase Admin with OAuth2 token
    if (getApps().length === 0) {
      // We'll use the REST API instead of Admin SDK since we can't use service account
      // This is a workaround - we'll send notifications via REST API
      console.log('Using OAuth2 for Firebase - will use REST API for notifications')
    }

    // For now, return null and we'll use REST API directly
    return null
  } catch (error) {
    console.error('Failed to initialize Firebase Admin with OAuth2:', error)
    return null
  }
}

/**
 * Get messaging instance (returns null, we'll use REST API instead)
 */
export async function getMessagingInstanceOAuth(): Promise<Messaging | null> {
  // We can't use Admin SDK without service account
  // Will use REST API instead
  return null
}

