import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { createStripeClient } from '@/lib/stripe/stripe-client'

/**
 * POST /api/advertiser/stripe-verify
 * Verify Stripe account status and update paymentReady field
 */
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const advertiser = await prisma.advertiser.findUnique({
      where: { contactEmail: user.email },
      select: { id: true, stripeAccountId: true },
    })

    if (!advertiser) {
      return NextResponse.json({ error: 'Advertiser account not found' }, { status: 404 })
    }

    if (!advertiser.stripeAccountId) {
      return NextResponse.json({
        paymentReady: false,
        message: 'No Stripe account connected',
      })
    }

    // Check Stripe account status
    const stripe = await createStripeClient()
    const account = await stripe.accounts.retrieve(advertiser.stripeAccountId)

    console.log('[Stripe Verify] Account status:', {
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirements: account.requirements,
    })

    // Account is ready if details are submitted (onboarding complete)
    // Charges and payouts may take time to enable after onboarding
    // For now, consider it ready if details are submitted
    const paymentReady = !!account.details_submitted
    
    // Log account status for debugging
    console.log('[Stripe Verify] Account status:', {
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirements: account.requirements ? {
        currentlyDue: account.requirements.currently_due?.length || 0,
        eventuallyDue: account.requirements.eventually_due?.length || 0,
        pastDue: account.requirements.past_due?.length || 0,
        disabledReason: account.requirements.disabled_reason,
      } : null,
    })

    // Update database
    await prisma.advertiser.update({
      where: { id: advertiser.id },
      data: { paymentReady },
    })

    console.log('[Stripe Verify] Updated paymentReady:', paymentReady)

    return NextResponse.json({
      paymentReady,
      account: {
        id: account.id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        country: account.country,
        type: account.type,
      },
      message: paymentReady
        ? account.charges_enabled && account.payouts_enabled
          ? 'Payment account is fully ready!'
          : 'Payment account setup is complete. Stripe is processing your account. Charges and payouts will be enabled shortly.'
        : 'Payment account setup is incomplete. Please complete all required steps.',
      requirements: account.requirements ? {
        currentlyDue: account.requirements.currently_due || [],
        eventuallyDue: account.requirements.eventually_due || [],
        pastDue: account.requirements.past_due || [],
        disabledReason: account.requirements.disabled_reason,
      } : null,
    })
  } catch (error: any) {
    console.error('[Stripe Verify] Failed to verify account:', error)
    return NextResponse.json(
      {
        paymentReady: false,
        error: error.message || 'Failed to verify Stripe account',
      },
      { status: 500 }
    )
  }
}
