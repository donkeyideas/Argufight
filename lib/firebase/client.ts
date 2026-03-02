/**
 * Firebase Client Configuration (for frontend)
 * Gets Firebase config from API
 */

export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
  vapidKey?: string
  measurementId?: string
}

let cachedConfig: FirebaseConfig | null = null

/**
 * Get Firebase configuration from API
 */
export async function getFirebaseConfig(): Promise<FirebaseConfig | null> {
  if (cachedConfig) {
    return cachedConfig
  }

  try {
    const response = await fetch('/api/firebase/config')
    if (response.ok) {
      const config = await response.json()
      cachedConfig = config
      return config
    }
    return null
  } catch (error) {
    console.error('Failed to get Firebase config:', error)
    return null
  }
}

