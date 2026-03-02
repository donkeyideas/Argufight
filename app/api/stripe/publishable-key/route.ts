import { NextRequest, NextResponse } from 'next/server'
import { getStripeKeys } from '@/lib/stripe/stripe-client'

/**
 * Public endpoint to get Stripe publishable key
 * This is safe to expose as publishable keys are meant for client-side use
 */
export async function GET(request: NextRequest) {
  try {
    const { publishableKey } = await getStripeKeys()

    if (!publishableKey) {
      return NextResponse.json(
        { error: 'Stripe publishable key not configured' },
        { status: 404 }
      )
    }

    // Log which key is being used (first 20 chars for debugging)
    console.log('[Stripe Publishable Key] Returning key:', publishableKey.substring(0, 20) + '...', 'Mode:', publishableKey.startsWith('pk_test_') ? 'TEST' : 'LIVE')
    
    // Check if key looks expired (this is a basic check - Stripe will validate)
    if (publishableKey.includes('bzcSnZ')) {
      console.warn('[Stripe Publishable Key] WARNING: Key appears to be expired (contains bzcSnZ). Please update in Admin Settings.')
    }

    return NextResponse.json(
      { publishableKey },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (error: any) {
    console.error('Failed to get Stripe publishable key:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get Stripe publishable key' },
      { status: 500 }
    )
  }
}

