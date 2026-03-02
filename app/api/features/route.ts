import { NextResponse } from 'next/server'
import { getFeatureFlags, FEATURE_KEYS } from '@/lib/features'

// GET /api/features - Get all feature flags (public endpoint)
export async function GET() {
  try {
    const flags = await getFeatureFlags()
    return NextResponse.json(flags)
  } catch (error) {
    console.error('Failed to fetch feature flags:', error)
    // Return defaults on error — business modules off, everything else on
    const defaults: Record<string, boolean> = {}
    for (const key of Object.values(FEATURE_KEYS)) {
      defaults[key] = !key.includes('SUBSCRIPTIONS') &&
        !key.includes('COIN_PURCHASES') &&
        !key.includes('ADVERTISING') &&
        !key.includes('CREATOR_MARKETPLACE') &&
        !key.includes('AI_MARKETING')
    }
    return NextResponse.json(defaults)
  }
}
