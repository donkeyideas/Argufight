import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { getOrCreateCustomer, createStripeClient, getStripeKeys } from '@/lib/stripe/stripe-client'

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { tier, billingCycle, promoCode } = body

    if (tier !== 'PRO') {
      return NextResponse.json(
        { error: 'Invalid tier. Only PRO tier requires payment.' },
        { status: 400 }
      )
    }

    if (!['MONTHLY', 'YEARLY'].includes(billingCycle)) {
      return NextResponse.json(
        { error: 'Invalid billing cycle' },
        { status: 400 }
      )
    }

    // Get user email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
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

    // Get pricing from database
    const pricingSettings = await prisma.adminSetting.findMany({
      where: {
        key: {
          in: ['PRO_MONTHLY_PRICE', 'PRO_YEARLY_PRICE'],
        },
      },
    })

    const pricingMap = pricingSettings.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, string>)

    const monthlyPrice = parseFloat(pricingMap.PRO_MONTHLY_PRICE || '9.99')
    const yearlyPrice = parseFloat(pricingMap.PRO_YEARLY_PRICE || '89.00')
    
    const stripe = await createStripeClient()
    // Always use production domain for checkout success URLs to avoid Vercel SSO issues
    // For checkout, we want users to return to the production site, not preview deployments
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.argufight.com'
    
    // Only use VERCEL_URL for local development (when NEXT_PUBLIC_APP_URL is not set)
    // In production, always use the production domain
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      // Check if we're in local development
      if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
        baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
      }
      // Otherwise, use production domain
    }
    
    // Ensure baseUrl doesn't have trailing slash
    baseUrl = baseUrl.replace(/\/$/, '')

    // Create Stripe Checkout Session
    const sessionParams: any = {
      customer: customerId,
      mode: 'subscription',
      success_url: `${baseUrl}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/signup/select-tier`,
      metadata: {
        userId,
        tier,
        billingCycle,
      },
      subscription_data: {
        metadata: {
          userId,
          tier,
          billingCycle,
        },
      },
    }

    // Add price based on billing cycle
    if (billingCycle === 'MONTHLY') {
      // Create price if not exists, or use stored price ID
      sessionParams.line_items = [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Argu Fight Pro - Monthly',
            description: 'Pro subscription with all premium features',
          },
          unit_amount: Math.round(monthlyPrice * 100), // Convert to cents
          recurring: {
            interval: 'month',
          },
        },
        quantity: 1,
      }]
    } else {
      sessionParams.line_items = [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Argu Fight Pro - Yearly',
            description: 'Pro subscription with all premium features (Save 25%)',
          },
          unit_amount: Math.round(yearlyPrice * 100), // Convert to cents
          recurring: {
            interval: 'year',
          },
        },
        quantity: 1,
      }]
    }

    // Add promo code if provided
    if (promoCode) {
      // Validate promo code first
      const promoValidation = await validatePromoCode(promoCode, tier, billingCycle)
      if (promoValidation.valid && promoValidation.couponId) {
        sessionParams.discounts = [{ coupon: promoValidation.couponId }]
      }
    }

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams)

    return NextResponse.json({
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
    })
  } catch (error: any) {
    console.error('Failed to create checkout session:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}

async function validatePromoCode(
  code: string,
  tier: string,
  billingCycle: string
): Promise<{ valid: boolean; couponId?: string; discountAmount?: number }> {
  try {
    // Get pricing from database
    const pricingSettings = await prisma.adminSetting.findMany({
      where: {
        key: {
          in: ['PRO_MONTHLY_PRICE', 'PRO_YEARLY_PRICE'],
        },
      },
    })

    const pricingMap = pricingSettings.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, string>)

    const monthlyPrice = parseFloat(pricingMap.PRO_MONTHLY_PRICE || '9.99')
    const yearlyPrice = parseFloat(pricingMap.PRO_YEARLY_PRICE || '89.00')

    const promoCode = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
    })

    if (!promoCode || !promoCode.isActive) {
      return { valid: false }
    }

    // Check if expired
    if (promoCode.validUntil && new Date() > promoCode.validUntil) {
      return { valid: false }
    }

    // Check if max uses exceeded
    if (promoCode.maxUses && promoCode.currentUses >= promoCode.maxUses) {
      return { valid: false }
    }

    // Check applicability
    if (promoCode.applicableTo !== 'BOTH' && promoCode.applicableTo !== tier) {
      return { valid: false }
    }

    // Check billing cycles
    if (promoCode.billingCycles) {
      const cycles = JSON.parse(promoCode.billingCycles)
      if (!cycles.includes(billingCycle)) {
        return { valid: false }
      }
    }

    // Create Stripe coupon if needed
    const stripe = await createStripeClient()
    let couponId: string

    // Check if coupon already exists in Stripe
    const coupons = await stripe.coupons.list({ limit: 100 })
    const existingCoupon = coupons.data.find(
      (c) => c.metadata?.promoCodeId === promoCode.id
    )

    if (existingCoupon) {
      couponId = existingCoupon.id
    } else {
      // Create new Stripe coupon
      const couponParams: any = {
        name: promoCode.code,
        metadata: {
          promoCodeId: promoCode.id,
        },
      }

      if (promoCode.discountType === 'PERCENTAGE') {
        couponParams.percent_off = Number(promoCode.discountValue)
      } else {
        couponParams.amount_off = Math.round(Number(promoCode.discountValue) * 100) // Convert to cents
        couponParams.currency = 'usd'
      }

      const coupon = await stripe.coupons.create(couponParams)
      couponId = coupon.id
    }

    // Calculate discount amount using database pricing
    const basePrice = billingCycle === 'MONTHLY' ? monthlyPrice : yearlyPrice
    let discountAmount = 0
    if (promoCode.discountType === 'PERCENTAGE') {
      discountAmount = (basePrice * Number(promoCode.discountValue)) / 100
    } else {
      discountAmount = Number(promoCode.discountValue)
    }

    return {
      valid: true,
      couponId,
      discountAmount,
    }
  } catch (error) {
    console.error('Failed to validate promo code:', error)
    return { valid: false }
  }
}

