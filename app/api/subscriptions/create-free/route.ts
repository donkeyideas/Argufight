import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

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

    // Check if user already has a subscription
    const existing = await prisma.userSubscription.findUnique({
      where: { userId },
    })

    if (existing) {
      return NextResponse.json({
        success: true,
        subscription: existing,
        message: 'Subscription already exists',
      })
    }

    // Create FREE subscription
    const subscription = await prisma.userSubscription.create({
      data: {
        userId,
        tier: 'FREE',
        status: 'ACTIVE',
        billingCycle: null,
      },
    })

    // Create appeal limit for Free tier (4/month)
    await prisma.appealLimit.upsert({
      where: { userId },
      create: {
        userId,
        monthlyLimit: 4,
        currentCount: 0,
      },
      update: {
        monthlyLimit: 4,
      },
    })

    return NextResponse.json({
      success: true,
      subscription,
    })
  } catch (error: any) {
    console.error('Failed to create free subscription:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create subscription' },
      { status: 500 }
    )
  }
}

