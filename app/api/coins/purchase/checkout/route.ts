import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { getOrCreateCustomer, createStripeClient, getStripeKeys } from '@/lib/stripe/stripe-client'
import { rateLimitMiddleware } from '@/lib/rate-limit'

/**
 * POST /api/coins/purchase/checkout
 * Create Stripe Checkout Session for coin purchase
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 requests per minute per IP for payment endpoints
    const rateLimit = await rateLimitMiddleware(request, 'general')
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { packageId } = body

    if (!packageId) {
      return NextResponse.json(
        { error: 'packageId is required' },
        { status: 400 }
      )
    }

    // Get user email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get package details
    const packages = [
      {
        id: 'starter',
        name: 'Starter',
        priceUSD: 4.99,
        baseCoins: 499,
        bonusCoins: 1,
        totalCoins: 500,
      },
      {
        id: 'small',
        name: 'Small',
        priceUSD: 9.99,
        baseCoins: 999,
        bonusCoins: 25,
        totalCoins: 1024,
      },
      {
        id: 'medium',
        name: 'Medium',
        priceUSD: 19.99,
        baseCoins: 1999,
        bonusCoins: 100,
        totalCoins: 2099,
      },
      {
        id: 'large',
        name: 'Large',
        priceUSD: 49.99,
        baseCoins: 4999,
        bonusCoins: 500,
        totalCoins: 5499,
      },
      {
        id: 'xl',
        name: 'XL',
        priceUSD: 99.99,
        baseCoins: 9999,
        bonusCoins: 1500,
        totalCoins: 11499,
      },
    ]

    const selectedPackage = packages.find((p) => p.id === packageId)
    if (!selectedPackage) {
      return NextResponse.json(
        { error: 'Invalid package ID' },
        { status: 400 }
      )
    }

    // Get Stripe keys
    const { publishableKey } = await getStripeKeys()
    if (!publishableKey) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      )
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateCustomer(userId, user.email)

    // Get base URL
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.argufight.com'
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
        baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
      }
    }
    baseUrl = baseUrl.replace(/\/$/, '')

    const stripe = await createStripeClient()

    // Create Stripe Checkout Session for one-time payment
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${selectedPackage.name} Coin Package`,
              description: `${selectedPackage.totalCoins.toLocaleString()} coins (${selectedPackage.baseCoins.toLocaleString()} base + ${selectedPackage.bonusCoins.toLocaleString()} bonus)`,
            },
            unit_amount: Math.round(selectedPackage.priceUSD * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/coins/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/coins/purchase`,
      metadata: {
        userId,
        packageId: selectedPackage.id,
        packageName: selectedPackage.name,
        baseCoins: selectedPackage.baseCoins.toString(),
        bonusCoins: selectedPackage.bonusCoins.toString(),
        totalCoins: selectedPackage.totalCoins.toString(),
        type: 'coin_purchase',
      },
    })

    return NextResponse.json({
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
      package: {
        name: selectedPackage.name,
        priceUSD: selectedPackage.priceUSD,
        totalCoins: selectedPackage.totalCoins,
      },
    })
  } catch (error: any) {
    console.error('[API] Error creating coin purchase checkout:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
