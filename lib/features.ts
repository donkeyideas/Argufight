// Feature flags utility
// Checks admin settings to determine if features are enabled

import { prisma } from '@/lib/db/prisma'
import { redirect } from 'next/navigation'

export const FEATURE_KEYS = {
  // Social features (default ON)
  LIKES: 'FEATURE_LIKES_ENABLED',
  SAVES: 'FEATURE_SAVES_ENABLED',
  SHARES: 'FEATURE_SHARES_ENABLED',
  COMMENTS: 'FEATURE_COMMENTS_ENABLED',
  FOLLOWS: 'FEATURE_FOLLOWS_ENABLED',

  // Game mechanics (default ON)
  TOURNAMENTS: 'FEATURE_TOURNAMENTS_ENABLED',
  BELTS: 'FEATURE_BELTS_ENABLED',
  COINS: 'FEATURE_COINS_ENABLED',
  DAILY_LOGIN_REWARD: 'FEATURE_DAILY_LOGIN_REWARD_ENABLED',
  DAILY_CHALLENGES: 'FEATURE_DAILY_CHALLENGES_ENABLED',
  STREAKS: 'FEATURE_STREAKS_ENABLED',
  PREDICTIONS: 'FEATURE_PREDICTIONS_ENABLED',

  // Communication (default ON)
  MESSAGING: 'FEATURE_MESSAGING_ENABLED',

  // Content & marketing (default ON)
  BLOG: 'FEATURE_BLOG_ENABLED',
  SEO_TOOLS: 'FEATURE_SEO_TOOLS_ENABLED',

  // Business modules (default OFF)
  SUBSCRIPTIONS: 'FEATURE_SUBSCRIPTIONS_ENABLED',
  COIN_PURCHASES: 'FEATURE_COIN_PURCHASES_ENABLED',
  ADVERTISING: 'FEATURE_ADVERTISING_ENABLED',
  CREATOR_MARKETPLACE: 'FEATURE_CREATOR_MARKETPLACE_ENABLED',
  AI_MARKETING: 'FEATURE_AI_MARKETING_ENABLED',
} as const

// Default values — determines ON/OFF when no admin_setting row exists
const DEFAULT_FEATURES: Record<string, string> = {
  // Social (ON)
  [FEATURE_KEYS.LIKES]: 'true',
  [FEATURE_KEYS.SAVES]: 'true',
  [FEATURE_KEYS.SHARES]: 'true',
  [FEATURE_KEYS.COMMENTS]: 'true',
  [FEATURE_KEYS.FOLLOWS]: 'true',

  // Game mechanics (ON)
  [FEATURE_KEYS.TOURNAMENTS]: 'true',
  [FEATURE_KEYS.BELTS]: 'true',
  [FEATURE_KEYS.COINS]: 'true',
  [FEATURE_KEYS.DAILY_LOGIN_REWARD]: 'true',
  [FEATURE_KEYS.DAILY_CHALLENGES]: 'true',
  [FEATURE_KEYS.STREAKS]: 'true',
  [FEATURE_KEYS.PREDICTIONS]: 'true',

  // Communication (ON)
  [FEATURE_KEYS.MESSAGING]: 'true',

  // Content & marketing (ON)
  [FEATURE_KEYS.BLOG]: 'true',
  [FEATURE_KEYS.SEO_TOOLS]: 'true',

  // Business modules (OFF)
  [FEATURE_KEYS.SUBSCRIPTIONS]: 'false',
  [FEATURE_KEYS.COIN_PURCHASES]: 'false',
  [FEATURE_KEYS.ADVERTISING]: 'false',
  [FEATURE_KEYS.CREATOR_MARKETPLACE]: 'false',
  [FEATURE_KEYS.AI_MARKETING]: 'false',
}

// Cache for feature flags (refresh every 5 minutes)
let featureCache: Record<string, boolean> | null = null
let cacheTimestamp: number = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  const now = Date.now()

  // Return cached if still valid
  if (featureCache && (now - cacheTimestamp) < CACHE_TTL) {
    return featureCache
  }

  try {
    const settings = await prisma.adminSetting.findMany({
      where: {
        key: {
          in: Object.values(FEATURE_KEYS),
        },
      },
    })

    const flags: Record<string, boolean> = {}

    // Check each feature
    for (const key of Object.values(FEATURE_KEYS)) {
      const setting = settings.find(s => s.key === key)
      const value = setting?.value || DEFAULT_FEATURES[key] || 'true'
      flags[key] = value.toLowerCase() === 'true'
    }

    // Update cache
    featureCache = flags
    cacheTimestamp = now

    return flags
  } catch (error) {
    console.error('Failed to fetch feature flags:', error)
    // Return defaults on error
    return Object.fromEntries(
      Object.values(FEATURE_KEYS).map(key => [
        key,
        (DEFAULT_FEATURES[key] || 'true').toLowerCase() === 'true',
      ])
    )
  }
}

export async function isFeatureEnabled(feature: keyof typeof FEATURE_KEYS): Promise<boolean> {
  const flags = await getFeatureFlags()
  return flags[FEATURE_KEYS[feature]] ?? true
}

// Server-side route guard — redirects to home when a feature is disabled
export async function requireFeature(feature: keyof typeof FEATURE_KEYS) {
  const enabled = await isFeatureEnabled(feature)
  if (!enabled) {
    redirect('/')
  }
}

// Invalidate the server-side cache (call after admin toggles a flag)
export function invalidateFeatureCache() {
  featureCache = null
  cacheTimestamp = 0
}
