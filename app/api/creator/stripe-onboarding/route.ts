import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { createCreatorStripeAccount, createAccountOnboardingLink } from '@/lib/stripe/stripe-client'

// GET /api/creator/stripe-onboarding - Get Stripe onboarding link
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isCreator: true,
        email: true,
      },
    })

    if (!user || !user.isCreator) {
      return NextResponse.json(
        { error: 'Creator mode not enabled' },
        { status: 403 }
      )
    }

    // Check if tax info already exists
    let taxInfo = await prisma.creatorTaxInfo.findUnique({
      where: { creatorId: userId },
    })

    let stripeAccountId = taxInfo?.stripeAccountId

    // Create Stripe account if doesn't exist
    if (!stripeAccountId) {
      stripeAccountId = await createCreatorStripeAccount(userId, user.email)

      // Create or update tax info
      taxInfo = await prisma.creatorTaxInfo.upsert({
        where: { creatorId: userId },
        create: {
          creatorId: userId,
          stripeAccountId,
        },
        update: {
          stripeAccountId,
        },
      })
    }

    // Generate onboarding link
    const returnUrl = `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/creator/setup`
    const onboardingUrl = await createAccountOnboardingLink(stripeAccountId, returnUrl)

    return NextResponse.json({ url: onboardingUrl })
  } catch (error: any) {
    console.error('Failed to create onboarding link:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create onboarding link' },
      { status: 500 }
    )
  }
}

