import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'

// POST /api/creator/offers/[id]/decline - Decline an offer
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
    })

    if (!offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
    }

    // Verify the offer belongs to this creator
    if (offer.creatorId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if offer can be declined
    if (offer.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Cannot decline offer that is ${offer.status.toLowerCase()}` },
        { status: 400 }
      )
    }

    // Update offer status to DECLINED
    await prisma.offer.update({
      where: { id: offerId },
      data: { status: 'DECLINED' },
    })

    return NextResponse.json({
      success: true,
      message: 'Offer declined',
    })
  } catch (error: any) {
    console.error('Failed to decline offer:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to decline offer' },
      { status: 500 }
    )
  }
}
