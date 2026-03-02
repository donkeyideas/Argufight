import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'


export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get active subscriptions count
    const activeCount = await prisma.userSubscription.count({
      where: {
        tier: 'PRO',
        status: 'ACTIVE',
      },
    })

    // Get total subscriptions (all time)
    const totalCount = await prisma.userSubscription.count({
      where: {
        tier: 'PRO',
      },
    })

    // Get cancelled subscriptions
    const cancelledCount = await prisma.userSubscription.count({
      where: {
        tier: 'PRO',
        status: 'CANCELLED',
      },
    })

    // Get subscriptions by billing cycle
    const monthlyCount = await prisma.userSubscription.count({
      where: {
        tier: 'PRO',
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
      },
    })

    const yearlyCount = await prisma.userSubscription.count({
      where: {
        tier: 'PRO',
        status: 'ACTIVE',
        billingCycle: 'YEARLY',
      },
    })

    // Get pricing to calculate MRR
    const pricingSettings = await prisma.adminSetting.findMany({
      where: {
        key: {
          in: ['PRO_MONTHLY_PRICE', 'PRO_YEARLY_PRICE'],
        },
      },
    })

    const pricingMap = pricingSettings.reduce((acc, setting) => {
      acc[setting.key] = parseFloat(setting.value || '0')
      return acc
    }, {} as Record<string, number>)

    const monthlyPrice = pricingMap.PRO_MONTHLY_PRICE || 9.99
    const yearlyPrice = pricingMap.PRO_YEARLY_PRICE || 89.0

    // Calculate Monthly Recurring Revenue (MRR)
    const mrr = (monthlyCount * monthlyPrice) + (yearlyCount * (yearlyPrice / 12))

    // Calculate Annual Recurring Revenue (ARR)
    const arr = mrr * 12

    // Get recent subscriptions (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentCount = await prisma.userSubscription.count({
      where: {
        tier: 'PRO',
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    })

    return NextResponse.json({
      activeCount,
      totalCount,
      cancelledCount,
      monthlyCount,
      yearlyCount,
      mrr,
      arr,
      recentCount,
      totalRevenue: mrr, // For display purposes
    })
  } catch (error: any) {
    console.error('Failed to fetch subscription overview:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch subscription overview' },
      { status: 500 }
    )
  }
}

