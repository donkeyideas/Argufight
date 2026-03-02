import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'
import { calculateCreatorPayout } from '@/lib/ads/creator-tier'

// POST /api/creator/offers/[id]/accept - Accept an offer and create a contract
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySessionWithDb()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: offerId } = await params

    // Get the offer
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        advertiser: true,
        campaign: true,
      },
    })

    if (!offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
    }

    // Verify the offer belongs to this creator
    if (offer.creatorId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if offer is still pending
    if (offer.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Offer is already ${offer.status.toLowerCase()}` },
        { status: 400 }
      )
    }

    // Check if offer has expired
    if (offer.expiresAt && new Date(offer.expiresAt) < new Date()) {
      // Update offer status to expired
      await prisma.offer.update({
        where: { id: offerId },
        data: { status: 'EXPIRED' },
      })
      return NextResponse.json({ error: 'Offer has expired' }, { status: 400 })
    }

    // Verify advertiser is approved
    if (offer.advertiser.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Advertiser is not approved' },
        { status: 400 }
      )
    }

    // Check if payment has been made (stripePaymentId indicates payment is held in escrow)
    if (!offer.campaign.stripePaymentId) {
      return NextResponse.json(
        { error: 'Payment has not been processed yet. The advertiser needs to complete payment before you can accept this offer.' },
        { status: 402 } // Payment Required
      )
    }

    // Calculate platform fee based on creator tier
    const totalAmount = Number(offer.amount)
    const { platformFeePercent, platformFee, creatorPayout } = await calculateCreatorPayout(
      userId,
      totalAmount
    )

    // Create the contract (payment already held in escrow from payment verification)
    const now = new Date()
    const contract = await prisma.adContract.create({
      data: {
        creatorId: userId,
        advertiserId: offer.advertiserId,
        campaignId: offer.campaignId,
        offerId: offerId,
        placement: offer.placement,
        startDate: offer.campaign.startDate,
        endDate: new Date(
          new Date(offer.campaign.startDate).getTime() + offer.duration * 24 * 60 * 60 * 1000
        ),
        totalAmount: offer.amount,
        platformFee: platformFee,
        creatorPayout: creatorPayout,
        status: 'SCHEDULED', // Contract starts as SCHEDULED
        escrowHeld: true, // Payment already held in escrow
        stripePaymentId: offer.campaign.stripePaymentId, // Use the payment ID from the campaign
        signedAt: now,
      },
    })

    // Update offer status to ACCEPTED
    await prisma.offer.update({
      where: { id: offerId },
      data: { status: 'ACCEPTED' },
    })

    return NextResponse.json({
      success: true,
      contract,
      message: 'Offer accepted. Contract created.',
    })
  } catch (error: any) {
    console.error('Failed to accept offer:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to accept offer' },
      { status: 500 }
    )
  }
}
