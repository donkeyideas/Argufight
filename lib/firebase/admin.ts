/**
 * Firebase Admin SDK Initialization
 * Uses Service Account for V1 API (replaces deprecated Legacy API)
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getMessaging, Messaging } from 'firebase-admin/messaging'
import { prisma } from '@/lib/db/prisma'

let adminApp: App | null = null
let messaging: Messaging | null = null

/**
 * Get Firebase Service Account credentials from admin settings
 */
async function getServiceAccount(): Promise<object | null> {
  try {
    // Try to get from database first
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'FIREBASE_SERVICE_ACCOUNT' },
    })

    if (setting?.value) {
      try {
        return JSON.parse(setting.value)
      } catch {
        console.error('Failed to parse Firebase Service Account JSON')
        return null
      }
    }

    // Fallback to environment variable
    const envServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    if (envServiceAccount) {
      try {
        return JSON.parse(envServiceAccount)
      } catch {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable')
        return null
      }
    }

    return null
  } catch (error) {
    console.error('Failed to get Firebase Service Account:', error)
    return null
  }
}

/**
 * Initialize Firebase Admin SDK
 */
export async function getFirebaseAdmin(): Promise<{ app: App; messaging: Messaging } | null> {
  try {
    // Return existing instance if already initialized
    if (adminApp && messaging) {
      return { app: adminApp, messaging }
    }

    // Get service account credentials
    const serviceAccount = await getServiceAccount()
    if (!serviceAccount) {
      console.error('Firebase Service Account not configured')
      return null
    }

    // Initialize if not already initialized
    if (getApps().length === 0) {
      adminApp = initializeApp({
        credential: cert(serviceAccount as any),
      })
    } else {
      adminApp = getApps()[0]
    }

    messaging = getMessaging(adminApp)

    return { app: adminApp, messaging }
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error)
    return null
  }
}

/**
 * Get messaging instance (for sending notifications)
 */
export async function getMessagingInstance(): Promise<Messaging | null> {
  const admin = await getFirebaseAdmin()
  return admin?.messaging || null
}

