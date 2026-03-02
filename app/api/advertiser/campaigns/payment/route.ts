import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { getOrCreateCustomer, createStripeClient, getStripeKeys } from '@/lib/stripe/stripe-client'
import { calculateStripeFees } from '@/lib/stripe/fee-calculator'
import { rateLimitMiddleware } from '@/lib/rate-limit'

// POST /api/advertiser/campaigns/payment - Create payment for Platform Ads campaign
export async function POST(request: NextRequest) {
  try {
    // Rate limit: prevent payment endpoint abuse
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
    const { campaignId } = body

    if (!campaignId) {
      return NextResponse.json(
        { error: 'campaignId is required' },
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

    // Get campaign
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.advertiserId !== advertiser.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (campaign.type !== 'PLATFORM_ADS') {
      return NextResponse.json(
        { error: 'Payment only required for PLATFORM_ADS campaigns' },
        { status: 400 }
      )
    }

    if (campaign.paymentStatus === 'PAID') {
      return NextResponse.json(
        { error: 'Campaign already paid' },
        { status: 400 }
      )
    }

    // Calculate amount (budget + Stripe fees)
    // Prisma Decimal needs to be converted properly - it has a toNumber() method
    let baseAmount: number
    try {
      if (campaign.budget) {
        // Handle Prisma Decimal type - it's a Decimal object with toNumber() method
        if (typeof campaign.budget === 'object' && campaign.budget !== null) {
          // Check if it's a Prisma Decimal
          if ('toNumber' in campaign.budget && typeof (campaign.budget as any).toNumber === 'function') {
            baseAmount = (campaign.budget as any).toNumber()
          } else if ('toString' in campaign.budget) {
            // Fallback: convert to string then parse
            baseAmount = parseFloat(campaign.budget.toString())
          } else {
            // Try direct conversion
            baseAmount = Number(campaign.budget)
          }
        } else if (typeof campaign.budget === 'string') {
          baseAmount = parseFloat(campaign.budget)
        } else if (typeof campaign.budget === 'number') {
          baseAmount = campaign.budget
        } else {
          baseAmount = Number(campaign.budget)
        }
      } else {
        console.error('[Payment API] Campaign budget is null or undefined:', campaign.id)
        return NextResponse.json(
          { error: 'Campaign budget is missing' },
          { status: 400 }
        )
      }
    } catch (conversionError: any) {
      console.error('[Payment API] Error converting budget:', {
        error: conversionError.message,
        budget: campaign.budget,
        budgetType: typeof campaign.budget,
        campaignId: campaign.id,
      })
      return NextResponse.json(
        { error: 'Failed to process campaign budget. Please contact support.' },
        { status: 500 }
      )
    }
    
    if (isNaN(baseAmount) || baseAmount <= 0) {
      console.error('[Payment API] Invalid budget value after conversion:', { 
        budget: campaign.budget, 
        budgetType: typeof campaign.budget,
        baseAmount,
        campaignId: campaign.id,
      })
      return NextResponse.json(
        { error: 'Invalid campaign budget. Please ensure the budget is a valid positive number.' },
        { status: 400 }
      )
    }
    
    console.log('[Payment API] Budget conversion successful:', { 
      originalBudget: campaign.budget,
      baseAmount,
      baseAmountType: typeof baseAmount,
      isNaN: isNaN(baseAmount),
      campaignId: campaign.id 
    })
    
    // Final validation before fee calculation
    if (typeof baseAmount !== 'number' || isNaN(baseAmount) || !isFinite(baseAmount) || baseAmount <= 0) {
      console.error('[Payment API] Invalid baseAmount before fee calculation:', {
        baseAmount,
        type: typeof baseAmount,
        isNaN: isNaN(baseAmount),
        isFinite: isFinite(baseAmount),
        campaignId: campaign.id,
      })
      return NextResponse.json(
        { error: 'Invalid campaign budget. Please ensure the budget is a valid positive number.' },
        { status: 400 }
      )
    }
    
    // Calculate fees
    let feeResult: { baseAmount: number; fee: number; total: number }
    try {
      feeResult = calculateStripeFees(baseAmount)
      console.log('[Payment API] Fee calculation result:', feeResult)
    } catch (feeError: any) {
      console.error('[Payment API] Error calling calculateStripeFees:', {
        error: feeError.message,
        stack: feeError.stack,
        baseAmount,
        campaignId: campaign.id,
      })
      return NextResponse.json(
        { error: 'Failed to calculate payment fees. Please contact support.' },
        { status: 500 }
      )
    }
    
    // Validate feeResult exists and has required properties
    if (!feeResult || typeof feeResult !== 'object') {
      console.error('[Payment API] Fee calculation returned invalid result:', { 
        feeResult,
        baseAmount,
        campaignId: campaign.id,
      })
      return NextResponse.json(
        { error: 'Failed to calculate payment fees. Please contact support.' },
        { status: 500 }
      )
    }
    
    const { fee, total } = feeResult
    const totalAmount = total
    
    // Validate results are numbers
    if (typeof fee !== 'number' || typeof total !== 'number') {
      console.error('[Payment API] Fee calculation returned non-numeric values:', { 
        feeResult,
        fee,
        total,
        feeType: typeof fee,
        totalType: typeof total,
        baseAmount,
        campaignId: campaign.id,
      })
      return NextResponse.json(
        { error: 'Failed to calculate payment fees. Please contact support.' },
        { status: 500 }
      )
    }
    
    if (isNaN(totalAmount) || isNaN(fee) || totalAmount <= 0 || fee < 0) {
      console.error('[Payment API] Invalid total amount calculated:', { 
        baseAmount, 
        fee, 
        totalAmount,
        feeResult,
        campaignId: campaign.id,
      })
      return NextResponse.json(
        { error: 'Invalid payment amount calculated. Please contact support.' },
        { status: 500 }
      )
    }
    
    console.log('[Payment API] Fee calculation successful:', { 
      baseAmount, 
      fee, 
      totalAmount,
      campaignId: campaign.id 
    })

    // Get or create Stripe customer
    const customerId = await getOrCreateCustomer(user.id, user.email)

    // Get Stripe keys
    const { publishableKey, secretKey } = await getStripeKeys()
    if (!secretKey) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      )
    }

    const stripe = await createStripeClient()

    // Determine base URL for checkout success URLs
    let baseUrl: string
    
    // In development, always use localhost
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
      // Check if we have a request origin (from the actual request)
      const origin = request.headers.get('origin') || request.nextUrl.origin
      if (origin && origin.includes('localhost')) {
        baseUrl = origin
      } else {
        baseUrl = 'http://localhost:3000'
      }
    } else {
      // In production, use the configured URL
      baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.argufight.com'
    }
    
    baseUrl = baseUrl.replace(/\/$/, '')
    
    console.log('[Payment API] Using baseUrl for success_url:', baseUrl)

    // Create Stripe Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_intent_data: {
        description: `Platform Ads Campaign: ${campaign.name}`,
        metadata: {
          advertiserId: advertiser.id,
          campaignId: campaign.id,
          type: 'platform_ads_payment',
          baseAmount: baseAmount.toString(),
        },
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Platform Ads Campaign: ${campaign.name}`,
              description: `Payment for advertising campaign (includes processing fees)`,
            },
            unit_amount: Math.round(totalAmount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/advertiser/campaigns/payment/success?session_id={CHECKOUT_SESSION_ID}&campaign_id=${campaign.id}`,
      cancel_url: `${baseUrl}/advertiser/campaigns/create?step=6&campaign_id=${campaign.id}`,
      metadata: {
        advertiserId: advertiser.id,
        campaignId: campaign.id,
        type: 'platform_ads_payment',
        baseAmount: baseAmount.toString(),
      },
    })

    return NextResponse.json({
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
      amount: baseAmount,
      fee: fee,
      total: totalAmount,
    })
  } catch (error: any) {
    console.error('Failed to create payment session:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create payment session' },
      { status: 500 }
    )
  }
}
