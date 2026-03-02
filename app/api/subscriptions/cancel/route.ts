import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { cancelSubscription } from '@/lib/stripe/stripe-client'

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
    const { atPeriodEnd = true } = body

    const subscription = await prisma.userSubscription.findUnique({
      where: { userId },
    })

    if (!subscription) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 404 }
      )
    }

    if (subscription.tier === 'FREE') {
      return NextResponse.json(
        { error: 'Free tier cannot be cancelled' },
        { status: 400 }
      )
    }

    // Cancel in Stripe if subscription exists
    if (subscription.stripeSubscriptionId) {
      try {
        await cancelSubscription(subscription.stripeSubscriptionId, atPeriodEnd)
      } catch (error) {
        console.error('Failed to cancel Stripe subscription:', error)
        // Continue with database update even if Stripe fails
      }
    }

    // Update database
    const updated = await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: atPeriodEnd,
        cancelledAt: atPeriodEnd ? null : new Date(),
        status: atPeriodEnd ? subscription.status : 'CANCELLED',
      },
    })

    return NextResponse.json({ subscription: updated })
  } catch (error: any) {
    console.error('Failed to cancel subscription:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to cancel subscription' },
      { status: 500 }
    )
  }
}

