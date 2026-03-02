import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { createStripeClient, getStripeKeys } from '@/lib/stripe/stripe-client'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { publishableKey, secretKey } = await getStripeKeys()

    if (!secretKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Stripe secret key not configured',
        },
        { status: 400 }
      )
    }

    if (!publishableKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Stripe publishable key not configured',
        },
        { status: 400 }
      )
    }

    // Test Stripe connection by making a simple API call
    try {
      const stripe = await createStripeClient()
      const customers = await stripe.customers.list({ limit: 1 })

      return NextResponse.json({
        success: true,
        message: 'Stripe connection successful',
        details: {
          publishableKey: publishableKey.substring(0, 12) + '...',
          secretKey: secretKey.substring(0, 12) + '...',
          mode: secretKey.startsWith('sk_test_') ? 'test' : 'live',
        },
      })
    } catch (stripeError: any) {
      return NextResponse.json(
        {
          success: false,
          error: 'Stripe API error',
          details: stripeError.message || 'Failed to connect to Stripe',
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Failed to test Stripe:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to test Stripe connection',
      },
      { status: 500 }
    )
  }
}

