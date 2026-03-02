import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/subscription-plans - Get all subscription plans
export async function GET() {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' },
    })

    return NextResponse.json({ plans })
  } catch (error: any) {
    console.error('Failed to fetch subscription plans:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch subscription plans' },
      { status: error.status || 500 }
    )
  }
}

// POST /api/admin/subscription-plans - Create a new subscription plan
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      description,
      price,
      billingCycle,
      features,
      appealLimit,
      debateLimit,
      prioritySupport,
      customBadge,
      stripePriceId,
      stripeProductId,
      isActive,
    } = body

    if (!name || !price || !billingCycle) {
      return NextResponse.json(
        { error: 'name, price, and billingCycle are required' },
        { status: 400 }
      )
    }

    if (!['MONTHLY', 'YEARLY'].includes(billingCycle)) {
      return NextResponse.json(
        { error: 'billingCycle must be MONTHLY or YEARLY' },
        { status: 400 }
      )
    }

    // Parse features if it's a string
    let featuresArray = features
    if (typeof features === 'string') {
      try {
        featuresArray = JSON.parse(features)
      } catch {
        featuresArray = features.split(',').map((f: string) => f.trim())
      }
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        price: parseFloat(price),
        billingCycle,
        features: JSON.stringify(featuresArray),
        appealLimit: appealLimit ? parseInt(appealLimit) : null,
        debateLimit: debateLimit ? parseInt(debateLimit) : null,
        prioritySupport: prioritySupport || false,
        customBadge: customBadge?.trim() || null,
        stripePriceId: stripePriceId?.trim() || null,
        stripeProductId: stripeProductId?.trim() || null,
        isActive: isActive || false,
      },
    })

    return NextResponse.json({ plan })
  } catch (error: any) {
    console.error('Failed to create subscription plan:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create subscription plan' },
      { status: error.status || 500 }
    )
  }
}

