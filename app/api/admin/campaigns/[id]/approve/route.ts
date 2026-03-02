import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get campaign to verify it exists and is pending
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        advertiser: {
          select: {
            companyName: true,
            contactEmail: true,
          },
        },
      },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status !== 'PENDING_REVIEW') {
      return NextResponse.json(
        { error: 'Campaign is not pending review' },
        { status: 400 }
      )
    }

    const now = new Date()
    
    // Check if campaign should be activated immediately (startDate is in past or today)
    const shouldActivate = campaign.startDate <= now && campaign.endDate >= now
    
    // Update campaign status to APPROVED (or ACTIVE if startDate has passed)
    const updatedCampaign = await prisma.campaign.update({
      where: { id },
      data: {
        status: shouldActivate ? 'ACTIVE' : 'APPROVED',
        approvedAt: new Date(),
      },
    })

    console.log(`[Approve Campaign] Campaign ${id} ${shouldActivate ? 'activated' : 'approved'}:`, {
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      now,
      shouldActivate,
      finalStatus: shouldActivate ? 'ACTIVE' : 'APPROVED',
    })

    return NextResponse.json({ success: true, campaign: updatedCampaign })
  } catch (error: any) {
    console.error('Failed to approve campaign:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to approve campaign' },
      { status: 500 }
    )
  }
}

