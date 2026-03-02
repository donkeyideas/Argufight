import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'


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

    const advertiser = await prisma.advertiser.findUnique({
      where: { id },
      include: {
        campaigns: {
          select: {
            id: true,
            status: true,
            budget: true,
            _count: {
              select: {
                impressions: true,
                clicks: true,
              },
            },
          },
        },
        contracts: {
          select: {
            id: true,
            status: true,
            totalAmount: true,
            startDate: true,
            endDate: true,
            impressionsDelivered: true,
            clicksDelivered: true,
          },
        },
        offers: {
          select: {
            id: true,
            status: true,
            amount: true,
          },
        },
      },
    })

    if (!advertiser) {
      return NextResponse.json({ error: 'Advertiser not found' }, { status: 404 })
    }

    // Calculate stats
    const totalCampaigns = advertiser.campaigns.length
    const activeCampaigns = advertiser.campaigns.filter(c => c.status === 'ACTIVE').length
    const totalSpent = advertiser.campaigns.reduce((sum, c) => sum + Number(c.budget || 0), 0)
    const totalImpressions = advertiser.campaigns.reduce((sum, c) => sum + (c._count?.impressions || 0), 0)
    const totalClicks = advertiser.campaigns.reduce((sum, c) => sum + (c._count?.clicks || 0), 0)
    const activeContracts = advertiser.contracts.filter(c => c.status === 'ACTIVE').length
    const totalContractValue = advertiser.contracts.reduce((sum, c) => sum + Number(c.totalAmount || 0), 0)
    const contractImpressions = advertiser.contracts.reduce((sum, c) => sum + (c.impressionsDelivered || 0), 0)
    const contractClicks = advertiser.contracts.reduce((sum, c) => sum + (c.clicksDelivered || 0), 0)
    const pendingOffers = advertiser.offers.filter(o => o.status === 'PENDING').length
    
    // Combine campaign and contract impressions/clicks
    const totalAllImpressions = totalImpressions + contractImpressions
    const totalAllClicks = totalClicks + contractClicks

    return NextResponse.json({
      advertiser: {
        id: advertiser.id,
        companyName: advertiser.companyName,
        status: advertiser.status,
        contactEmail: advertiser.contactEmail,
        industry: advertiser.industry,
        website: advertiser.website,
        createdAt: advertiser.createdAt,
        approvedAt: advertiser.approvedAt,
        suspendedAt: advertiser.suspendedAt,
        suspensionReason: advertiser.suspensionReason,
      },
      stats: {
        totalCampaigns,
        activeCampaigns,
        totalSpent,
        totalImpressions: totalAllImpressions,
        totalClicks: totalAllClicks,
        clickThroughRate: totalAllImpressions > 0 ? (totalAllClicks / totalAllImpressions * 100).toFixed(2) : '0.00',
        activeContracts,
        totalContractValue,
        pendingOffers,
      },
    })
  } catch (error: any) {
    console.error('Failed to fetch advertiser stats:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch advertiser stats' },
      { status: 500 }
    )
  }
}

