import { NextResponse } from 'next/server'
import { canUseFeature, hasFeatureAccess } from './subscription-utils'
import { FEATURES } from './features'
import { isFeatureEnabled } from '@/lib/features'

/**
 * Middleware to require feature access
 * When SUBSCRIPTIONS feature flag is OFF, all features are unlocked.
 */
export async function requireFeature(
  userId: string,
  feature: string
): Promise<void> {
  // When subscriptions are disabled, everyone gets full access
  const subsEnabled = await isFeatureEnabled('SUBSCRIPTIONS')
  if (!subsEnabled) return

  const hasAccess = await hasFeatureAccess(userId, feature)
  if (!hasAccess) {
    throw new Error(`Feature "${feature}" requires a Pro subscription`)
  }
}

/**
 * Check feature access and return response if denied
 * When SUBSCRIPTIONS feature flag is OFF, always passes.
 */
export async function checkFeatureAccess(
  userId: string,
  feature: string
): Promise<NextResponse | null> {
  const subsEnabled = await isFeatureEnabled('SUBSCRIPTIONS')
  if (!subsEnabled) return null

  const hasAccess = await hasFeatureAccess(userId, feature)
  if (!hasAccess) {
    return NextResponse.json(
      {
        error: 'This feature requires a Pro subscription',
        feature,
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }
  return null
}

/**
 * Check feature usage limit and return response if exceeded
 * When SUBSCRIPTIONS feature flag is OFF, limits are bypassed.
 */
export async function checkFeatureLimit(
  userId: string,
  feature: string
): Promise<NextResponse | null> {
  const subsEnabled = await isFeatureEnabled('SUBSCRIPTIONS')
  if (!subsEnabled) return null

  const canUse = await canUseFeature(userId, feature)
  if (!canUse.allowed) {
    return NextResponse.json(
      {
        error: canUse.reason || 'Feature limit exceeded',
        feature,
        currentUsage: canUse.currentUsage,
        limit: canUse.limit,
        upgradeRequired: canUse.reason?.includes('Pro subscription'),
      },
      { status: 403 }
    )
  }
  return null
}

