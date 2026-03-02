import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/subscription-plans/[id] - Get a specific plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
    })

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ plan })
  } catch (error: any) {
    console.error('Failed to fetch subscription plan:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch subscription plan' },
      { status: error.status || 500 }
    )
  }
}

// PUT /api/admin/subscription-plans/[id] - Update a plan
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
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

    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (price !== undefined) updateData.price = parseFloat(price)
    if (billingCycle !== undefined) {
      if (!['MONTHLY', 'YEARLY'].includes(billingCycle)) {
        return NextResponse.json(
          { error: 'billingCycle must be MONTHLY or YEARLY' },
          { status: 400 }
        )
      }
      updateData.billingCycle = billingCycle
    }
    if (features !== undefined) {
      let featuresArray = features
      if (typeof features === 'string') {
        try {
          featuresArray = JSON.parse(features)
        } catch {
          featuresArray = features.split(',').map((f: string) => f.trim())
        }
      }
      updateData.features = JSON.stringify(featuresArray)
    }
    if (appealLimit !== undefined) updateData.appealLimit = appealLimit ? parseInt(appealLimit) : null
    if (debateLimit !== undefined) updateData.debateLimit = debateLimit ? parseInt(debateLimit) : null
    if (prioritySupport !== undefined) updateData.prioritySupport = prioritySupport
    if (customBadge !== undefined) updateData.customBadge = customBadge?.trim() || null
    if (stripePriceId !== undefined) updateData.stripePriceId = stripePriceId?.trim() || null
    if (stripeProductId !== undefined) updateData.stripeProductId = stripeProductId?.trim() || null
    if (isActive !== undefined) updateData.isActive = isActive

    const plan = await prisma.subscriptionPlan.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ plan })
  } catch (error: any) {
    console.error('Failed to update subscription plan:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update subscription plan' },
      { status: error.status || 500 }
    )
  }
}

// DELETE /api/admin/subscription-plans/[id] - Delete a plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    await prisma.subscriptionPlan.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete subscription plan:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete subscription plan' },
      { status: error.status || 500 }
    )
  }
}

