import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { calculateStripeFees } from '@/lib/stripe/fee-calculator'

// GET /api/advertiser/campaigns/[id]/receipt - Get receipt for a campaign
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

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
      where: { id },
      include: {
        advertiser: {
          select: {
            companyName: true,
            contactEmail: true,
            contactName: true,
            contactPhone: true,
          },
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

    // Only generate receipt if payment was made
    if (campaign.paymentStatus !== 'PAID' || !campaign.paidAt || !campaign.stripePaymentId) {
      return NextResponse.json(
        { error: 'No payment found for this campaign' },
        { status: 400 }
      )
    }

    // Calculate fees
    const budget = Number(campaign.budget)
    const feeResult = calculateStripeFees(budget)
    const stripeFee = feeResult.fee
    const totalPaid = feeResult.total

    // Generate receipt data
    const receipt = {
      receiptNumber: `RCP-${campaign.id.substring(0, 8).toUpperCase()}`,
      date: campaign.paidAt.toISOString(),
      advertiser: {
        companyName: campaign.advertiser.companyName,
        contactEmail: campaign.advertiser.contactEmail,
        contactName: campaign.advertiser.contactName,
        contactPhone: campaign.advertiser.contactPhone,
      },
      campaign: {
        id: campaign.id,
        name: campaign.name,
        type: campaign.type,
        category: campaign.category,
        startDate: campaign.startDate.toISOString(),
        endDate: campaign.endDate.toISOString(),
      },
      payment: {
        budget: budget,
        stripeFee: stripeFee,
        totalPaid: totalPaid,
        stripePaymentId: campaign.stripePaymentId,
        paidAt: campaign.paidAt.toISOString(),
      },
    }

    return NextResponse.json({ receipt })
  } catch (error: any) {
    console.error('Failed to generate receipt:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate receipt' },
      { status: 500 }
    )
  }
}
