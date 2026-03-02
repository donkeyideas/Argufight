import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { createStripeClient, createAdvertiserStripeAccount } from '@/lib/stripe/stripe-client'

// POST /api/advertiser/stripe-connect-embedded - Create embedded Connect onboarding session
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
      select: { id: true, status: true, stripeAccountId: true, companyName: true, contactEmail: true },
    })

    if (!advertiser || advertiser.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Advertiser account required' },
        { status: 403 }
      )
    }

    const stripe = await createStripeClient()
    let stripeAccountId = advertiser.stripeAccountId

    // Create Stripe account if doesn't exist
    if (!stripeAccountId) {
      try {
        console.log('[Stripe Connect API] Creating Stripe account for advertiser:', {
          advertiserId: advertiser.id,
          email: advertiser.contactEmail,
          companyName: advertiser.companyName,
        })
        
        stripeAccountId = await createAdvertiserStripeAccount(
          advertiser.id,
          advertiser.contactEmail,
          advertiser.companyName
        )

        console.log('[Stripe Connect API] Account created successfully:', stripeAccountId)

        await prisma.advertiser.update({
          where: { id: advertiser.id },
          data: { stripeAccountId },
        })
        
        console.log('[Stripe Connect API] Advertiser record updated with stripeAccountId')
      } catch (accountError: any) {
        console.error('[Stripe Connect API] Failed to create Stripe account:', {
          error: accountError.message,
          type: accountError.type,
          code: accountError.code,
          statusCode: accountError.statusCode,
          raw: accountError.raw,
        })
        
        // More specific error handling
        if (
          accountError.message?.includes('Connect') || 
          accountError.code === 'resource_missing' || 
          accountError.type === 'invalid_request_error' ||
          accountError.code === 'CONNECT_NOT_ENABLED'
        ) {
          return NextResponse.json(
            { 
              error: 'Stripe Connect is not enabled. For testing, make sure you are in Test Mode and have enabled Stripe Connect. Go to: https://dashboard.stripe.com/settings/connect',
              code: 'CONNECT_NOT_ENABLED',
              helpUrl: 'https://stripe.com/docs/connect/enable-payment-acceptance',
              details: accountError.message,
            },
            { status: 400 }
          )
        }
        
        // Return the actual error for debugging
        return NextResponse.json(
          { 
            error: accountError.message || 'Failed to create Stripe account',
            code: accountError.code || 'UNKNOWN_ERROR',
            type: accountError.type,
          },
          { status: 500 }
        )
      }
    } else {
      console.log('[Stripe Connect API] Using existing Stripe account:', stripeAccountId)
    }

    // Create Account Session for embedded onboarding
    console.log('[Stripe Connect API] Creating account session for:', stripeAccountId)
    try {
      const accountSession = await stripe.accountSessions.create({
        account: stripeAccountId,
        components: {
          account_onboarding: {
            enabled: true,
            features: {
              external_account_collection: true,
            },
          },
        },
      })

      console.log('[Stripe Connect API] Account session created successfully')
      return NextResponse.json({ 
        client_secret: accountSession.client_secret 
      })
    } catch (sessionError: any) {
      console.error('[Stripe Connect API] Failed to create account session:', {
        error: sessionError.message,
        type: sessionError.type,
        code: sessionError.code,
        statusCode: sessionError.statusCode,
      })
      throw sessionError
    }
  } catch (error: any) {
    console.error('Failed to create embedded Connect session:', error)
    
    if (error.message?.includes('Connect') || error.code === 'resource_missing' || error.type === 'invalid_request_error') {
      return NextResponse.json(
        { 
          error: 'Stripe Connect is not enabled. For testing, make sure you are in Test Mode and have enabled Stripe Connect. Go to: https://dashboard.stripe.com/settings/connect',
          code: 'CONNECT_NOT_ENABLED',
          helpUrl: 'https://stripe.com/docs/connect/enable-payment-acceptance',
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to create embedded Connect session' },
      { status: 500 }
    )
  }
}

