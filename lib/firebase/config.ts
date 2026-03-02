/**
 * Firebase Configuration
 * Gets Firebase config from admin settings or environment variables
 */

import { prisma } from '@/lib/db/prisma'

export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
  vapidKey?: string
  measurementId?: string // Optional: for Google Analytics
}

/**
 * Get Firebase configuration from admin settings or environment
 */
export async function getFirebaseConfig(): Promise<FirebaseConfig | null> {
  try {
    // Try to get from database first
    const settings = await prisma.adminSetting.findMany({
      where: {
        key: {
          in: [
            'FIREBASE_API_KEY',
            'FIREBASE_AUTH_DOMAIN',
            'FIREBASE_PROJECT_ID',
            'FIREBASE_STORAGE_BUCKET',
            'FIREBASE_MESSAGING_SENDER_ID',
            'FIREBASE_APP_ID',
            'FIREBASE_VAPID_KEY',
          ],
        },
      },
    })

    const configMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, string>)

    // Check if all required fields are present
    if (
      configMap.FIREBASE_API_KEY &&
      configMap.FIREBASE_AUTH_DOMAIN &&
      configMap.FIREBASE_PROJECT_ID &&
      configMap.FIREBASE_MESSAGING_SENDER_ID &&
      configMap.FIREBASE_APP_ID
    ) {
      return {
        apiKey: configMap.FIREBASE_API_KEY,
        authDomain: configMap.FIREBASE_AUTH_DOMAIN,
        projectId: configMap.FIREBASE_PROJECT_ID,
        storageBucket: configMap.FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: configMap.FIREBASE_MESSAGING_SENDER_ID,
        appId: configMap.FIREBASE_APP_ID,
        vapidKey: configMap.FIREBASE_VAPID_KEY || undefined,
        measurementId: configMap.FIREBASE_MEASUREMENT_ID || undefined,
      }
    }

    // Fallback to environment variables
    if (
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID
    ) {
      return {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || undefined,
        measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
      }
    }

    return null
  } catch (error) {
    console.error('Failed to get Firebase config:', error)
    return null
  }
}

/**
 * Get Firebase server key for sending push notifications
 */
export async function getFirebaseServerKey(): Promise<string | null> {
  try {
    // Try to get from database first
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'FIREBASE_SERVER_KEY' },
    })

    if (setting?.value) {
      return setting.value
    }

    // Fallback to environment variable
    return process.env.FIREBASE_SERVER_KEY || null
  } catch (error) {
    console.error('Failed to get Firebase server key:', error)
    return null
  }
}

