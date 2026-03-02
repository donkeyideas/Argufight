/**
 * Notification Preferences Helper
 * Checks if a notification type is enabled before sending
 */

import { prisma } from '@/lib/db/prisma'

let preferencesCache: Record<string, boolean> | null = null
let cacheTimestamp: number = 0
const CACHE_TTL = 60000 // 1 minute

/**
 * Get notification preferences from admin settings
 */
async function getNotificationPreferences(): Promise<Record<string, boolean>> {
  const now = Date.now()
  
  // Return cached preferences if still valid
  if (preferencesCache && (now - cacheTimestamp) < CACHE_TTL) {
    return preferencesCache
  }

  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'NOTIFICATION_PREFERENCES' },
    })

    if (setting?.value) {
      try {
        preferencesCache = JSON.parse(setting.value)
        cacheTimestamp = now
        return preferencesCache || {}
      } catch (error) {
        console.error('Failed to parse notification preferences:', error)
      }
    }
  } catch (error) {
    console.error('Failed to fetch notification preferences:', error)
  }

  // Return empty object if no preferences set (all enabled by default)
  return {}
}

/**
 * Check if a notification type is enabled
 * Returns true if enabled, false if disabled, or true if not configured (default enabled)
 */
export async function isNotificationTypeEnabled(
  notificationType: string
): Promise<boolean> {
  const preferences = await getNotificationPreferences()
  
  // If preference is explicitly set, use it
  if (notificationType in preferences) {
    return preferences[notificationType] === true
  }

  // Default to enabled if not configured
  return true
}

/**
 * Clear the preferences cache (call after updating preferences)
 */
export function clearNotificationPreferencesCache(): void {
  preferencesCache = null
  cacheTimestamp = 0
}

