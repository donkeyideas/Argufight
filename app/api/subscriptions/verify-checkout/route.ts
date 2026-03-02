import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { createStripeClient } from '@/lib/stripe/stripe-client'
import { sendSubscriptionActivatedEmail } from '@/lib/email/subscription-notifications'
import Stripe from 'stripe'

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
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      )
    }

    // Retrieve checkout session from Stripe
    const stripe = await createStripeClient()
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    if (!checkoutSession.subscription) {
      return NextResponse.json(
        { error: 'No subscription found in checkout session' },
        { status: 400 }
      )
    }

    const subscription = checkoutSession.subscription as Stripe.Subscription
    const customerId = subscription.customer as string

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, username: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Determine billing cycle from subscription
    const interval = subscription.items.data[0]?.price.recurring?.interval
    const billingCycle = interval === 'month' ? 'MONTHLY' : interval === 'year' ? 'YEARLY' : null

    // Get promo code from subscription metadata or discounts
    let promoCodeId: string | null = null
    if (subscription.discounts && subscription.discounts.length > 0) {
      const discount = subscription.discounts[0]
      // Stripe Discount type structure: discount.discount.coupon
      if (typeof discount !== 'string' && 'discount' in discount && discount.discount) {
        const discountObj = discount.discount as any
        if (discountObj.coupon?.metadata?.promoCodeId) {
          promoCodeId = discountObj.coupon.metadata.promoCodeId
        }
      }
    }
    
    // Increment promo code usage
    if (promoCodeId) {
      await prisma.promoCode.update({
        where: { id: promoCodeId },
        data: {
          currentUses: { increment: 1 },
        },
      })
    }

    // Extract period dates safely (Stripe types don't expose these directly)
    const subscriptionAny = subscription as any
    const currentPeriodStart = subscriptionAny.current_period_start 
      ? new Date(subscriptionAny.current_period_start * 1000)
      : null
    const currentPeriodEnd = subscriptionAny.current_period_end
      ? new Date(subscriptionAny.current_period_end * 1000)
      : null

    // Create or update UserSubscription
    const userSubscription = await prisma.userSubscription.upsert({
      where: { userId },
      create: {
        userId,
        tier: 'PRO',
        billingCycle,
        status: subscription.status === 'active' ? 'ACTIVE' : 'PAST_DUE',
        currentPeriodStart,
        currentPeriodEnd,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0]?.price.id || null,
        promoCodeId,
        cancelAtPeriodEnd: subscriptionAny.cancel_at_period_end || false,
      },
      update: {
        tier: 'PRO',
        billingCycle,
        status: subscription.status === 'active' ? 'ACTIVE' : 'PAST_DUE',
        currentPeriodStart,
        currentPeriodEnd,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0]?.price.id || null,
        promoCodeId,
        cancelAtPeriodEnd: subscriptionAny.cancel_at_period_end || false,
      },
    })

    // Update appeal limits for Pro (12/month)
    await prisma.appealLimit.upsert({
      where: { userId },
      create: {
        userId,
        monthlyLimit: 12,
        currentCount: 0,
      },
      update: {
        monthlyLimit: 12,
      },
    })

    // Send email notification (don't await - send in background)
    sendSubscriptionActivatedEmail(
      user.email,
      user.username,
      'PRO',
      billingCycle,
      userSubscription.currentPeriodEnd
    ).catch(error => {
      console.error('Failed to send subscription activation email:', error)
    })

    return NextResponse.json({
      success: true,
      subscription: userSubscription,
    })
  } catch (error: any) {
    console.error('Failed to verify checkout:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to verify checkout' },
      { status: 500 }
    )
  }
}

