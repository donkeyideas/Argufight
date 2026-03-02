import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { createStripeClient } from '@/lib/stripe/stripe-client'

// GET /api/advertiser/me - Get current user's advertiser account
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Find advertiser by email
    const advertiser = await prisma.advertiser.findUnique({
      where: { contactEmail: user.email },
      select: {
        id: true,
        companyName: true,
        status: true,
        paymentReady: true,
        website: true,
        industry: true,
        stripeAccountId: true,
      },
    })

    if (!advertiser) {
      return NextResponse.json({ error: 'Advertiser account not found' }, { status: 404 })
    }

    // If advertiser has a Stripe account, verify its status and update paymentReady
    if (advertiser.stripeAccountId) {
      try {
        const stripe = await createStripeClient()
        const account = await stripe.accounts.retrieve(advertiser.stripeAccountId)
        
        // Account is ready if details are submitted
        // Charges and payouts may take time to enable after onboarding
        // For now, consider it ready if details are submitted
        const paymentReady = !!account.details_submitted
        
        // Log account status for debugging
        console.log('[API /advertiser/me] Stripe account status:', {
          accountId: account.id,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          detailsSubmitted: account.details_submitted,
          requirements: account.requirements ? {
            currentlyDue: account.requirements.currently_due?.length || 0,
            eventuallyDue: account.requirements.eventually_due?.length || 0,
            pastDue: account.requirements.past_due?.length || 0,
          } : null,
        })

        // Update paymentReady if it has changed
        if (advertiser.paymentReady !== paymentReady) {
          await prisma.advertiser.update({
            where: { id: advertiser.id },
            data: { paymentReady },
          })
          console.log('[API /advertiser/me] Updated paymentReady:', paymentReady, 'for account:', advertiser.stripeAccountId)
        }
      } catch (stripeError: any) {
        // If account doesn't exist or is invalid, set paymentReady to false
        console.error('[API /advertiser/me] Failed to verify Stripe account:', stripeError.message)
        if (advertiser.paymentReady) {
          await prisma.advertiser.update({
            where: { id: advertiser.id },
            data: { paymentReady: false },
          })
        }
      }
    }

    // Re-fetch advertiser to get updated paymentReady status
    const updatedAdvertiser = await prisma.advertiser.findUnique({
      where: { contactEmail: user.email },
      select: {
        id: true,
        companyName: true,
        status: true,
        paymentReady: true,
        website: true,
        industry: true,
        stripeAccountId: true,
      },
    })

    if (!updatedAdvertiser) {
      return NextResponse.json({ error: 'Advertiser account not found' }, { status: 404 })
    }

    // Return advertiser info even if not approved, so dashboard can show status
    // Dashboard will handle showing appropriate message based on status
    // Only block SUSPENDED and BANNED from accessing dashboard features
    if (updatedAdvertiser.status === 'SUSPENDED') {
      return NextResponse.json(
        { 
          advertiser: {
            ...updatedAdvertiser,
            error: 'Your advertiser account has been suspended. Please contact support.'
          }
        },
        { status: 200 } // Return 200 but include error message
      )
    }
    if (updatedAdvertiser.status === 'BANNED') {
      return NextResponse.json(
        { 
          advertiser: {
            ...updatedAdvertiser,
            error: 'Your advertiser account has been banned.'
          }
        },
        { status: 200 } // Return 200 but include error message
      )
    }

    return NextResponse.json({ advertiser: updatedAdvertiser })
  } catch (error: any) {
    console.error('Failed to fetch advertiser:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch advertiser' },
      { status: 500 }
    )
  }
}

