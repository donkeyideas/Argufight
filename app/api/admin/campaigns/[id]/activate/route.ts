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

    // Get campaign to verify it exists
    const campaign = await prisma.campaign.findUnique({
      where: { id },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Campaign must be APPROVED to activate manually' },
        { status: 400 }
      )
    }

    // Manually activate the campaign
    const updatedCampaign = await prisma.campaign.update({
      where: { id },
      data: {
        status: 'ACTIVE',
      },
    })

    console.log(`[Activate Campaign] Campaign ${id} manually activated`)

    return NextResponse.json({ success: true, campaign: updatedCampaign })
  } catch (error: any) {
    console.error('Failed to activate campaign:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to activate campaign' },
      { status: 500 }
    )
  }
}
