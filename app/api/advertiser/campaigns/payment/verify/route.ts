import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { createStripeClient, getStripeKeys } from '@/lib/stripe/stripe-client'
import { rateLimitMiddleware } from '@/lib/rate-limit'

// POST /api/advertiser/campaigns/payment/verify - Verify payment and update campaign
// Note: This endpoint doesn't require a session because Stripe redirects may lose session cookies
// Instead, we verify ownership through Stripe session metadata
export async function POST(request: NextRequest) {
  try {
    // Rate limit: prevent payment verification abuse
    const rateLimit = await rateLimitMiddleware(request, 'general')
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const body = await request.json()
    const { sessionId, campaignId } = body

    if (!sessionId || !campaignId) {
      return NextResponse.json(
        { error: 'sessionId and campaignId are required' },
        { status: 400 }
      )
    }

    // Verify payment with Stripe first (before checking session)
    const { secretKey } = await getStripeKeys()
    if (!secretKey) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      )
    }

    const stripe = await createStripeClient()

    // Get checkout session from Stripe
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId)

    // Verify payment status
    if (checkoutSession.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
      )
    }

    // Verify campaign ID matches the one in Stripe metadata
    const stripeCampaignId = checkoutSession.metadata?.campaignId
    if (stripeCampaignId !== campaignId) {
      console.error('[Payment Verify] Campaign ID mismatch:', {
        stripeCampaignId,
        providedCampaignId: campaignId,
        sessionId,
      })
      return NextResponse.json(
        { error: 'Campaign ID mismatch' },
        { status: 403 }
      )
    }

    // Get campaign to verify it exists and check if already paid
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        advertiserId: true,
        paymentStatus: true,
        status: true,
      },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Check if already paid (idempotency check)
    if (campaign.paymentStatus === 'PAID') {
      console.log('[Payment Verify] Campaign already paid, returning success')
      return NextResponse.json({ success: true, alreadyPaid: true })
    }

    // Verify advertiser ID matches (from Stripe metadata)
    const stripeAdvertiserId = checkoutSession.metadata?.advertiserId
    if (stripeAdvertiserId && campaign.advertiserId !== stripeAdvertiserId) {
      console.error('[Payment Verify] Advertiser ID mismatch:', {
        stripeAdvertiserId,
        campaignAdvertiserId: campaign.advertiserId,
        sessionId,
      })
      return NextResponse.json(
        { error: 'Advertiser ID mismatch' },
        { status: 403 }
      )
    }

    // Get payment intent
    const paymentIntentId = checkoutSession.payment_intent as string
    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Payment intent not found in checkout session' },
        { status: 400 }
      )
    }

    // Update campaign with payment info
    const updateData: any = {
      stripePaymentId: paymentIntentId,
      paidAt: new Date(),
      status: 'PENDING_REVIEW' as any, // Ensure status is PENDING_REVIEW after payment
      paymentStatus: 'PAID',
    }
    
    await prisma.campaign.update({
      where: { id: campaignId },
      data: updateData,
    })

    console.log('[Payment Verify] Payment verified and campaign updated:', {
      campaignId,
      paymentIntentId,
      status: 'PENDING_REVIEW',
      paymentStatus: 'PAID',
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Payment Verify] Failed to verify payment:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to verify payment' },
      { status: 500 }
    )
  }
}
