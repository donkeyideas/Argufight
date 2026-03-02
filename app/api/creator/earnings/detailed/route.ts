import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'

// GET /api/creator/earnings/detailed - Get detailed earnings with contract breakdown
export async function GET(request: NextRequest) {
  try {
    const session = await verifySessionWithDb()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all completed contracts
    const completedContracts = await prisma.adContract.findMany({
      where: {
        creatorId: userId,
        status: 'COMPLETED',
        payoutSent: true,
      },
      include: {
        advertiser: {
          select: {
            companyName: true,
          },
        },
        campaign: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { payoutDate: 'desc' },
    })

    // Get pending contracts (active or scheduled, not yet paid)
    const pendingContracts = await prisma.adContract.findMany({
      where: {
        creatorId: userId,
        status: {
          in: ['ACTIVE', 'SCHEDULED'],
        },
        payoutSent: false,
      },
      include: {
        advertiser: {
          select: {
            companyName: true,
          },
        },
        campaign: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { endDate: 'desc' },
    })

    // Calculate totals
    const totalEarned = completedContracts.reduce(
      (sum, contract) => sum + Number(contract.creatorPayout),
      0
    )

    const pendingPayout = pendingContracts.reduce(
      (sum, contract) => sum + Number(contract.creatorPayout),
      0
    )

    // This month's earnings
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const thisMonthContracts = completedContracts.filter(
      (contract) => contract.payoutDate && new Date(contract.payoutDate) >= startOfMonth
    )

    const thisMonth = thisMonthContracts.reduce(
      (sum, contract) => sum + Number(contract.creatorPayout),
      0
    )

    // This year's earnings
    const startOfYear = new Date()
    startOfYear.setMonth(0, 1)
    startOfYear.setHours(0, 0, 0, 0)

    const thisYearContracts = completedContracts.filter(
      (contract) => contract.payoutDate && new Date(contract.payoutDate) >= startOfYear
    )

    const thisYear = thisYearContracts.reduce(
      (sum, contract) => sum + Number(contract.creatorPayout),
      0
    )

    // Monthly breakdown for last 12 months
    const monthlyBreakdown: Record<string, number> = {}
    const now = new Date()
    
    for (let i = 0; i < 12; i++) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
      monthlyBreakdown[monthKey] = 0
    }

    completedContracts.forEach((contract) => {
      if (contract.payoutDate) {
        const payoutDate = new Date(contract.payoutDate)
        const monthKey = `${payoutDate.getFullYear()}-${String(payoutDate.getMonth() + 1).padStart(2, '0')}`
        if (monthlyBreakdown[monthKey] !== undefined) {
          monthlyBreakdown[monthKey] += Number(contract.creatorPayout)
        }
      }
    })

    const monthlyBreakdownArray = Object.entries(monthlyBreakdown)
      .reverse()
      .map(([month, earnings]) => ({
        month,
        earnings,
      }))

    // Format contracts for response
    const allContracts = [...completedContracts, ...pendingContracts].map((contract) => ({
      id: contract.id,
      status: contract.status,
      creatorPayout: Number(contract.creatorPayout),
      totalAmount: Number(contract.totalAmount),
      payoutDate: contract.payoutDate?.toISOString() || null,
      completedAt: contract.completedAt?.toISOString() || null,
      advertiser: contract.advertiser,
      campaign: contract.campaign,
    }))

    return NextResponse.json({
      totalEarned,
      pendingPayout,
      thisMonth,
      thisYear,
      contracts: allContracts,
      monthlyBreakdown: monthlyBreakdownArray,
    })
  } catch (error: any) {
    console.error('Failed to fetch detailed earnings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch earnings' },
      { status: 500 }
    )
  }
}
