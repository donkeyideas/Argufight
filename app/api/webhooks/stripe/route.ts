import { NextRequest, NextResponse } from 'next/server'
import { createStripeClient, getStripeKeys } from '@/lib/stripe/stripe-client'
import { prisma } from '@/lib/db/prisma'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }

    const { secretKey } = await getStripeKeys()
    if (!secretKey) {
      return NextResponse.json(
        { error: 'Stripe secret key not configured' },
        { status: 500 }
      )
    }

    const stripe = await createStripeClient()
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || secretKey

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message)
      return NextResponse.json(
        { error: `Webhook Error: ${err.message}` },
        { status: 400 }
      )
    }

    // Handle the event
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdate(subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentSucceeded(invoice)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(invoice)
        break
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutSessionCompleted(session)
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        await handleChargeRefunded(charge)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: error.message || 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  const subscriptionId = subscription.id

  // Find user by Stripe customer ID
  const userSubscription = await prisma.userSubscription.findUnique({
    where: { stripeCustomerId: customerId },
  })

  if (!userSubscription) {
    console.error(`User subscription not found for customer ${customerId}`)
    return
  }

  // Determine tier from subscription metadata or price
  const tier = subscription.metadata?.tier || 'PRO'
  const billingCycle = subscription.items.data[0]?.price.recurring?.interval?.toUpperCase() || null

  await prisma.userSubscription.update({
    where: { id: userSubscription.id },
    data: {
      tier,
      billingCycle: billingCycle === 'MONTH' ? 'MONTHLY' : billingCycle === 'YEAR' ? 'YEARLY' : null,
      status: subscription.status === 'active' ? 'ACTIVE' : 
              subscription.status === 'canceled' ? 'CANCELLED' :
              subscription.status === 'past_due' ? 'PAST_DUE' : 'EXPIRED',
      currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      stripeSubscriptionId: subscriptionId,
      stripePriceId: subscription.items.data[0]?.price.id || null,
      cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
    },
  })

  // Update appeal limits based on tier
  if (tier === 'PRO') {
    await prisma.appealLimit.upsert({
      where: { userId: userSubscription.userId },
      create: {
        userId: userSubscription.userId,
        monthlyLimit: 12, // Pro gets 12 appeals/month
        currentCount: 0,
      },
      update: {
        monthlyLimit: 12,
      },
    })
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  const userSubscription = await prisma.userSubscription.findUnique({
    where: { stripeCustomerId: customerId },
  })

  if (!userSubscription) {
    return
  }

  // Downgrade to FREE tier
  await prisma.userSubscription.update({
    where: { id: userSubscription.id },
    data: {
      tier: 'FREE',
      status: 'CANCELLED',
      billingCycle: null,
      cancelledAt: new Date(),
      stripeSubscriptionId: null,
      stripePriceId: null,
    },
  })

  // Reset appeal limits to Free tier (4/month)
  await prisma.appealLimit.upsert({
    where: { userId: userSubscription.userId },
    create: {
      userId: userSubscription.userId,
      monthlyLimit: 4,
      currentCount: 0,
    },
    update: {
      monthlyLimit: 4,
    },
  })
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription as string | null
  if (!subscriptionId) return

  const subscription = await prisma.userSubscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  })

  if (subscription) {
    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
      },
    })
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription as string | null
  if (!subscriptionId) return

  const subscription = await prisma.userSubscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  })

  if (subscription) {
    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        status: 'PAST_DUE',
      },
    })
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  try {
    // Check if this is a coin purchase
    if (session.metadata?.type !== 'coin_purchase') {
      return // Not a coin purchase, skip
    }

    const userId = session.metadata.userId
    const packageId = session.metadata.packageId
    const packageName = session.metadata.packageName
    const baseCoins = parseInt(session.metadata.baseCoins || '0')
    const bonusCoins = parseInt(session.metadata.bonusCoins || '0')
    const totalCoins = parseInt(session.metadata.totalCoins || '0')
    const paymentIntentId = session.payment_intent as string

    if (!userId || !totalCoins) {
      console.error('[Webhook] Missing required metadata for coin purchase:', session.metadata)
      return
    }

    // Check if this payment was already processed (idempotency)
    const existingTransaction = await prisma.coinTransaction.findFirst({
      where: {
        userId,
        metadata: {
          path: ['stripePaymentIntentId'],
          equals: paymentIntentId,
        },
      },
    })

    if (existingTransaction) {
      console.log('[Webhook] Coin purchase already processed:', paymentIntentId)
      return
    }

    // Import addCoins function
    const { addCoins } = await import('@/lib/belts/coin-economics')

    // Add coins to user account
    // Use COIN_PURCHASE type (requires database migration to add to enum)
    try {
      await addCoins(userId, totalCoins, {
        type: 'COIN_PURCHASE',
        description: `Purchased ${packageName} package - ${totalCoins.toLocaleString()} coins`,
        metadata: {
          stripePaymentIntentId: paymentIntentId,
          stripeSessionId: session.id,
          packageId,
          packageName,
          baseCoins,
          bonusCoins,
          totalCoins,
          purchaseType: 'coin_purchase',
        },
      })
    } catch (error: any) {
      // Fallback to ADMIN_GRANT if COIN_PURCHASE not in enum yet
      if (error.message?.includes('COIN_PURCHASE') || error.message?.includes('Invalid enum')) {
        console.warn('[Webhook] COIN_PURCHASE not in enum, using ADMIN_GRANT as fallback')
        await addCoins(userId, totalCoins, {
          type: 'ADMIN_GRANT',
          description: `Purchased ${packageName} package - ${totalCoins.toLocaleString()} coins`,
          metadata: {
            stripePaymentIntentId: paymentIntentId,
            stripeSessionId: session.id,
            packageId,
            packageName,
            baseCoins,
            bonusCoins,
            totalCoins,
            purchaseType: 'coin_purchase',
          },
        })
      } else {
        throw error
      }
    }
    console.log(`[Webhook] Added ${totalCoins} coins to user ${userId} from package ${packageName}`)
  } catch (error: any) {
    console.error('[Webhook] Error processing coin purchase:', error)
    // Don't throw - we'll retry via webhook retry mechanism
  }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  try {
    // Get payment intent to find the session
    const stripe = await createStripeClient()
    const paymentIntent = await stripe.paymentIntents.retrieve(charge.payment_intent as string)
    
    // Check if this was a coin purchase
    const sessionId = (paymentIntent as any).metadata?.sessionId
    if (!sessionId) return

    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.metadata?.type !== 'coin_purchase') {
      return // Not a coin purchase refund
    }

    const userId = session.metadata.userId
    const totalCoins = parseInt(session.metadata.totalCoins || '0')

    if (!userId || !totalCoins) {
      console.error('[Webhook] Missing required metadata for coin refund:', session.metadata)
      return
    }

    // Check if refund was already processed
    const existingRefund = await prisma.coinTransaction.findFirst({
      where: {
        userId,
        type: 'REFUND',
        metadata: {
          path: ['stripeChargeId'],
          equals: charge.id,
        },
      },
    })

    if (existingRefund) {
      console.log('[Webhook] Coin refund already processed:', charge.id)
      return
    }

    // Import deductCoins function
    const { deductCoins } = await import('@/lib/belts/coin-economics')

    // Deduct coins (refund)
    await deductCoins(userId, totalCoins, {
      type: 'REFUND',
      description: `Refund for ${session.metadata.packageName} package purchase`,
      metadata: {
        stripeChargeId: charge.id,
        stripePaymentIntentId: paymentIntent.id,
        stripeSessionId: sessionId,
        refundType: 'coin_purchase_refund',
        originalPackage: session.metadata.packageName,
      },
    })

    console.log(`[Webhook] Refunded ${totalCoins} coins from user ${userId}`)
  } catch (error: any) {
    console.error('[Webhook] Error processing coin refund:', error)
  }
}
