import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'


// GET /api/admin/marketplace/stats
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [pendingAdvertisers, activeContracts, totalCreators] = await Promise.all([
      prisma.advertiser.count({
        where: { status: 'PENDING' },
      }),
      prisma.adContract.count({
        where: { status: 'ACTIVE' },
      }),
      prisma.user.count({
        where: { isCreator: true },
      }),
    ])

    // Calculate monthly revenue (sum of platform fees from active contracts this month)
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const monthlyContracts = await prisma.adContract.findMany({
      where: {
        status: 'ACTIVE',
        startDate: { gte: startOfMonth },
      },
      select: {
        platformFee: true,
      },
    })

    const monthlyRevenue = monthlyContracts.reduce(
      (sum, contract) => sum + Number(contract.platformFee),
      0
    )

    return NextResponse.json({
      pendingAdvertisers,
      activeContracts,
      monthlyRevenue,
      totalCreators,
    })
  } catch (error: any) {
    console.error('Failed to fetch marketplace stats:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch marketplace stats' },
      { status: 500 }
    )
  }
}

