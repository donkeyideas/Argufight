import Stripe from 'stripe'
import { prisma } from '@/lib/db/prisma'

let stripeClient: Stripe | null = null

/**
 * Get Stripe keys from environment variables ONLY
 * SECURITY: Never store Stripe keys in the database
 */
export function getStripeKeys(): {
  publishableKey: string | null
  secretKey: string | null
} {
  return {
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    secretKey: process.env.STRIPE_SECRET_KEY || null,
  }
}

/**
 * Create and return Stripe client instance
 * SECURITY: Uses environment variables only
 */
export function createStripeClient(): Stripe {
  if (stripeClient) {
    return stripeClient
  }

  const { secretKey } = getStripeKeys()

  if (!secretKey) {
    throw new Error(
      'Stripe secret key not configured. Set STRIPE_SECRET_KEY environment variable.'
    )
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: '2026-02-25.clover',
  })

  return stripeClient
}

/**
 * Get or create Stripe customer for a user
 */
export async function getOrCreateCustomer(
  userId: string,
  email: string
): Promise<string> {
  const stripe = createStripeClient()

  // Check if user already has a customer ID
  const subscription = await prisma.userSubscription.findUnique({
    where: { userId },
    select: { stripeCustomerId: true },
  })

  if (subscription?.stripeCustomerId) {
    // Verify customer still exists in Stripe
    try {
      await stripe.customers.retrieve(subscription.stripeCustomerId)
      return subscription.stripeCustomerId
    } catch (error) {
      // Customer doesn't exist, create new one
      console.log('Customer not found in Stripe, creating new one')
    }
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    metadata: {
      userId,
    },
  })

  // Update or create subscription record with customer ID
  await prisma.userSubscription.upsert({
    where: { userId },
    create: {
      userId,
      tier: 'FREE',
      status: 'ACTIVE',
      stripeCustomerId: customer.id,
    },
    update: {
      stripeCustomerId: customer.id,
    },
  })

  return customer.id
}

/**
 * Update Stripe customer
 */
export async function updateCustomer(
  customerId: string,
  data: Stripe.CustomerUpdateParams
): Promise<Stripe.Customer> {
  const stripe = createStripeClient()
  return await stripe.customers.update(customerId, data)
}

/**
 * Create Stripe subscription
 */
export async function createSubscription(
  customerId: string,
  priceId: string,
  promoCode?: string
): Promise<Stripe.Subscription> {
  const stripe = createStripeClient()

  const subscriptionData: Stripe.SubscriptionCreateParams = {
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
  }

  // Add promo code if provided
  if (promoCode) {
    // Try to find promotion code first (recommended approach)
    const promotionCodes = await stripe.promotionCodes.list({
      code: promoCode,
      limit: 1,
    })
    if (promotionCodes.data.length > 0) {
      (subscriptionData as any).promotion_code = promotionCodes.data[0].id
    } else {
      // Fallback: search for coupon by ID (if promoCode is actually a coupon ID)
      try {
        const coupon = await stripe.coupons.retrieve(promoCode)
        ;(subscriptionData as any).coupon = coupon.id
      } catch {
        // Coupon not found, ignore
      }
    }
  }

  return await stripe.subscriptions.create(subscriptionData)
}

/**
 * Cancel Stripe subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  atPeriodEnd: boolean = true
): Promise<Stripe.Subscription> {
  const stripe = createStripeClient()

  if (atPeriodEnd) {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    })
  } else {
    return await stripe.subscriptions.cancel(subscriptionId)
  }
}

/**
 * Update Stripe subscription (e.g., change plan)
 */
export async function updateSubscription(
  subscriptionId: string,
  newPriceId: string
): Promise<Stripe.Subscription> {
  const stripe = createStripeClient()

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  return await stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: subscription.items.data[0].id,
        price: newPriceId,
      },
    ],
    proration_behavior: 'always_invoice',
  })
}

// ============================================
// STRIPE CONNECT (For Creator Marketplace)
// ============================================

/**
 * Create connected account for creator
 */
export async function createCreatorStripeAccount(
  creatorId: string,
  email: string
): Promise<string> {
  const stripe = createStripeClient()

  const account = await stripe.accounts.create({
    type: 'express', // Express accounts for creators
    country: 'US',
    email: email,
    capabilities: {
      transfers: { requested: true },
    },
    business_type: 'individual',
    metadata: {
      creatorId,
    },
  })

  return account.id
}

/**
 * Create Stripe Connect account for advertiser
 */
export async function createAdvertiserStripeAccount(
  advertiserId: string,
  email: string,
  companyName: string
): Promise<string> {
  const stripe = createStripeClient()

  try {
    const account = await stripe.accounts.create({
      type: 'express', // Express accounts for advertisers
      country: 'US',
      email: email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'company',
      company: {
        name: companyName,
      },
      metadata: {
        advertiserId,
      },
    })

    return account.id
  } catch (error: any) {
    // Re-throw with more context if it's a Connect not enabled error
    if (error.message?.includes('Connect') || error.code === 'resource_missing') {
      const connectError = new Error(error.message || 'Stripe Connect is not enabled')
      ;(connectError as any).code = 'CONNECT_NOT_ENABLED'
      throw connectError
    }
    throw error
  }
}

/**
 * Generate onboarding link for creator to complete tax forms
 */
export async function createAccountOnboardingLink(
  stripeAccountId: string,
  returnUrl: string
): Promise<string> {
  const stripe = createStripeClient()

  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/creator/setup`,
    return_url: returnUrl,
    type: 'account_onboarding',
  })

  return accountLink.url
}

/**
 * Hold payment in escrow when contract is signed
 */
export async function holdPaymentInEscrow(
  amount: number,
  customerId: string,
  description: string
): Promise<Stripe.PaymentIntent> {
  const stripe = createStripeClient()

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency: 'usd',
    customer: customerId,
    description: description,
    capture_method: 'manual', // Hold funds, don't capture yet
  })

  return paymentIntent
}

/**
 * Release payment to creator when contract completes
 */
export async function payoutToCreator(
  amount: number,
  platformFee: number,
  creatorStripeAccountId: string,
  description: string
): Promise<Stripe.Transfer> {
  const stripe = createStripeClient()

  const transfer = await stripe.transfers.create({
    amount: Math.round((amount - platformFee) * 100), // Creator's cut in cents
    currency: 'usd',
    destination: creatorStripeAccountId,
    description: description,
  })

  return transfer
}

/**
 * Get account balance for creator
 */
export async function getCreatorBalance(stripeAccountId: string): Promise<Stripe.Balance> {
  const stripe = createStripeClient()

  const balance = await stripe.balance.retrieve({
    stripeAccount: stripeAccountId,
  })

  return balance
}

/**
 * Capture payment intent (release from escrow)
 */
export async function capturePaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  const stripe = createStripeClient()

  return await stripe.paymentIntents.capture(paymentIntentId)
}

