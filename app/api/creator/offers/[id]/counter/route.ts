import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'

interface CounterOfferRequest {
  amount?: number
  duration?: number
  message?: string
}

// POST /api/creator/offers/[id]/counter - Counter an offer with new terms
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
    const body: CounterOfferRequest = await request.json()

    // Get the original offer
    const originalOffer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        advertiser: true,
        campaign: true,
      },
    })

    if (!originalOffer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
    }

    // Verify the offer belongs to this creator
    if (originalOffer.creatorId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if offer can be countered
    if (originalOffer.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Cannot counter offer that is ${originalOffer.status.toLowerCase()}` },
        { status: 400 }
      )
    }

    // Check counter offer round limit (max 3 rounds)
    const negotiationRound = originalOffer.negotiationRound + 1
    if (negotiationRound > 3) {
      return NextResponse.json(
        { error: 'Maximum negotiation rounds (3) reached' },
        { status: 400 }
      )
    }

    // Validate counter offer
    const counterAmount = body.amount ?? Number(originalOffer.amount)
    const counterDuration = body.duration ?? originalOffer.duration

    if (counterAmount <= 0) {
      return NextResponse.json(
        { error: 'Counter offer amount must be greater than 0' },
        { status: 400 }
      )
    }

    if (counterDuration <= 0) {
      return NextResponse.json(
        { error: 'Counter offer duration must be greater than 0' },
        { status: 400 }
      )
    }

    // Update original offer with counter offer details
    await prisma.offer.update({
      where: { id: offerId },
      data: {
        status: 'COUNTERED',
        counterAmount: counterAmount,
        counterMessage: body.message || `Counter offer: $${counterAmount} for ${counterDuration} days`,
        negotiationRound: negotiationRound,
        respondedAt: new Date(),
      },
    })

    // Create a new counter offer from advertiser back to creator
    const counterOffer = await prisma.offer.create({
      data: {
        creatorId: userId,
        advertiserId: originalOffer.advertiserId,
        campaignId: originalOffer.campaignId,
        placement: originalOffer.placement,
        amount: counterAmount,
        duration: counterDuration,
        paymentType: originalOffer.paymentType,
        message: body.message || `Counter offer: $${counterAmount} for ${counterDuration} days`,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days to respond
        negotiationRound: negotiationRound,
      },
      include: {
        advertiser: {
          select: {
            id: true,
            companyName: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      counterOffer,
      message: 'Counter offer sent',
    })
  } catch (error: any) {
    console.error('Failed to counter offer:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to counter offer' },
      { status: 500 }
    )
  }
}
