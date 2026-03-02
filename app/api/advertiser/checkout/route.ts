import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { getOrCreateCustomer, createStripeClient, getStripeKeys } from '@/lib/stripe/stripe-client'
import { calculateStripeFees } from '@/lib/stripe/fee-calculator'

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
    const { offerId, contractId } = body

    if (!offerId && !contractId) {
      return NextResponse.json(
        { error: 'offerId or contractId is required' },
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

    // Get advertiser
    const advertiser = await prisma.advertiser.findUnique({
      where: { contactEmail: user.email },
      select: { id: true, companyName: true, contactEmail: true },
    })

    if (!advertiser) {
      return NextResponse.json(
        { error: 'Advertiser account not found' },
        { status: 404 }
      )
    }

    // Get offer or contract details
    let baseAmount: number // Original amount without fees
    let description: string
    let metadata: Record<string, string>

    if (offerId) {
      const offer = await prisma.offer.findUnique({
        where: { id: offerId },
        include: {
          campaign: { select: { name: true } },
          creator: { select: { username: true } },
        },
      })

      if (!offer) {
        return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
      }

      if (offer.advertiserId !== advertiser.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      if (offer.status !== 'PENDING') {
        return NextResponse.json(
          { error: 'Offer is not pending' },
          { status: 400 }
        )
      }

      baseAmount = Number(offer.amount)
      description = `Campaign: ${offer.campaign.name} - Creator: ${offer.creator.username}`
      metadata = {
        advertiserId: advertiser.id,
        offerId: offer.id,
        campaignId: offer.campaignId,
        creatorId: offer.creatorId,
        type: 'offer_payment',
        baseAmount: baseAmount.toString(), // Store original amount
      }
    } else if (contractId) {
      const contract = await prisma.adContract.findUnique({
        where: { id: contractId },
        include: {
          campaign: { select: { name: true } },
          creator: { select: { username: true } },
        },
      })

      if (!contract) {
        return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
      }

      if (contract.advertiserId !== advertiser.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      if (contract.escrowHeld) {
        return NextResponse.json(
          { error: 'Payment already processed for this contract' },
          { status: 400 }
        )
      }

      baseAmount = Number(contract.totalAmount)
      description = `Campaign: ${contract.campaign.name} - Creator: ${contract.creator.username}`
      metadata = {
        advertiserId: advertiser.id,
        contractId: contract.id,
        campaignId: contract.campaignId,
        creatorId: contract.creatorId,
        type: 'contract_payment',
        baseAmount: baseAmount.toString(), // Store original amount
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      )
    }

    // Calculate Stripe transaction fees and add to total
    // Fees are passed to the advertiser
    const { fee, total } = calculateStripeFees(baseAmount)
    const totalAmount = total // Amount advertiser will pay (includes fees)

    // Get Stripe keys
    const { publishableKey } = await getStripeKeys()
    if (!publishableKey) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      )
    }

    // Get or create Stripe customer (use userId, not advertiser.id)
    const customerId = await getOrCreateCustomer(user.id, advertiser.contactEmail)

    const stripe = await createStripeClient()
    
    // Determine base URL for checkout success/cancel URLs
    // Priority: NEXT_PUBLIC_APP_URL > VERCEL_URL (for preview deployments) > localhost (for local dev)
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    
    // For local development, always use localhost
    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
      baseUrl = 'http://localhost:3000'
    } else if (process.env.VERCEL_URL && !process.env.NEXT_PUBLIC_APP_URL) {
      // Use VERCEL_URL for preview deployments if NEXT_PUBLIC_APP_URL is not set
      baseUrl = `https://${process.env.VERCEL_URL}`
    }
    
    baseUrl = baseUrl.replace(/\/$/, '')
    
    console.log('[Checkout API] Using baseUrl:', baseUrl, 'for success URL')

    // Create Stripe Checkout Session for one-time payment
    // Note: Payment is captured immediately and held in escrow in our Stripe account
    // Funds will be transferred to creator when contract is completed
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_intent_data: {
        description: description,
        metadata: metadata,
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: description,
              description: `Payment for advertising contract (includes processing fees)`,
            },
            unit_amount: Math.round(totalAmount * 100), // Convert to cents (includes fees)
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/advertiser/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/advertiser/dashboard`,
      metadata: metadata,
    })

    return NextResponse.json({
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
      amount: baseAmount, // Original amount
      fee: fee, // Stripe transaction fee
      total: totalAmount, // Total amount advertiser pays
    })
  } catch (error: any) {
    console.error('Failed to create advertiser checkout session:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}

