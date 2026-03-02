import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { getStripeKeys } from '@/lib/stripe/stripe-client'


export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { secretKey, publishableKey } = await getStripeKeys()

    const isTestMode = secretKey?.startsWith('sk_test_') || false
    const isLiveMode = secretKey?.startsWith('sk_live_') || false
    const isConfigured = !!secretKey && !!publishableKey

    return NextResponse.json({
      isConfigured,
      mode: isTestMode ? 'test' : isLiveMode ? 'live' : 'not_configured',
      isTestMode,
      isLiveMode,
      keys: {
        secretKeyPrefix: secretKey ? secretKey.substring(0, 12) + '...' : null,
        publishableKeyPrefix: publishableKey ? publishableKey.substring(0, 12) + '...' : null,
      },
    })
  } catch (error: any) {
    console.error('Failed to check Stripe mode:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check Stripe mode' },
      { status: 500 }
    )
  }
}

