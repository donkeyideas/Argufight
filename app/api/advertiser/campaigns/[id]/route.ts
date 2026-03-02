import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

// GET /api/advertiser/campaigns/[id] - Get campaign details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
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
    })

    if (!advertiser) {
      return NextResponse.json({ error: 'Advertiser account not found' }, { status: 404 })
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
      include: {
        impressions: {
          select: { id: true },
        },
        clicks: {
          select: { id: true },
        },
      },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Verify campaign belongs to this advertiser
    if (campaign.advertiserId !== advertiser.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Format campaign response
    const formattedCampaign = {
      id: campaign.id,
      name: campaign.name,
      type: campaign.type,
      category: campaign.category,
      status: campaign.status,
      paymentStatus: campaign.paymentStatus || null,
      budget: campaign.budget.toString(),
      startDate: campaign.startDate.toISOString(),
      endDate: campaign.endDate.toISOString(),
      destinationUrl: campaign.destinationUrl,
      ctaText: campaign.ctaText,
      bannerUrl: campaign.bannerUrl,
      minELO: campaign.minELO,
      targetCategories: campaign.targetCategories,
      minFollowers: campaign.minFollowers,
      maxBudgetPerCreator: campaign.maxBudgetPerCreator?.toString() || null,
      impressionsDelivered: campaign.impressions.length,
      clicksDelivered: campaign.clicks.length,
    }

    return NextResponse.json({ campaign: formattedCampaign })
  } catch (error: any) {
    console.error('Failed to fetch campaign:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch campaign' },
      { status: 500 }
    )
  }
}

// DELETE /api/advertiser/campaigns/[id] - Delete campaign
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
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
    })

    if (!advertiser) {
      return NextResponse.json({ error: 'Advertiser account not found' }, { status: 404 })
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Verify campaign belongs to this advertiser
    if (campaign.advertiserId !== advertiser.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Only allow deletion of campaigns that haven't started or are pending payment
    // Don't allow deletion of active, completed, or paid campaigns
    if (campaign.status === 'ACTIVE' || campaign.status === 'COMPLETED' || campaign.paymentStatus === 'PAID') {
      return NextResponse.json(
        { error: 'Cannot delete active, completed, or paid campaigns' },
        { status: 400 }
      )
    }

    // Delete the campaign
    await prisma.campaign.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete campaign:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete campaign' },
      { status: 500 }
    )
  }
}