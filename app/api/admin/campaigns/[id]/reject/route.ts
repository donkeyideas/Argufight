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
    const body = await request.json()
    const { reason } = body

    // Get campaign to verify it exists and is pending
    const campaign = await prisma.campaign.findUnique({
      where: { id },
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

    // Update campaign status to REJECTED
    const updatedCampaign = await prisma.campaign.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason || 'Campaign rejected by admin',
      },
    })

    return NextResponse.json({ success: true, campaign: updatedCampaign })
  } catch (error: any) {
    console.error('Failed to reject campaign:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to reject campaign' },
      { status: 500 }
    )
  }
}

