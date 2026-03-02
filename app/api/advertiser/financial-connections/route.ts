import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { createStripeClient } from '@/lib/stripe/stripe-client'

// POST /api/advertiser/financial-connections - Create Financial Connections session
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
      select: { id: true, status: true, stripeAccountId: true },
    })

    if (!advertiser || advertiser.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Advertiser account required' },
        { status: 403 }
      )
    }

    const stripe = await createStripeClient()
    const { searchParams } = new URL(request.url)
    const permissions = searchParams.get('permissions')?.split(',') || ['payment_method', 'balances']

    // Create Financial Connections session
    // For advertisers, we need to create a customer first if they don't have a Stripe account
    let customerId: string | undefined

    if (advertiser.stripeAccountId) {
      // If they have a Connect account, we can use it
      customerId = advertiser.stripeAccountId
    } else {
      // Create a customer for this advertiser
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          advertiserId: advertiser.id,
        },
      })
      customerId = customer.id
    }

    const financialConnectionsSession = await stripe.financialConnections.sessions.create({
      account_holder: {
        type: 'customer',
        customer: customerId,
      },
      permissions: permissions as any,
      filters: {
        countries: ['US'],
      },
    })

    return NextResponse.json({ 
      client_secret: financialConnectionsSession.client_secret 
    })
  } catch (error: any) {
    console.error('Failed to create Financial Connections session:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create Financial Connections session' },
      { status: 500 }
    )
  }
}

