import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

// GET /api/advertiser/offers - Get advertiser's sent offers
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Find advertiser by email
    const advertiser = await prisma.advertiser.findUnique({
      where: { contactEmail: user.email },
    })

    if (!advertiser) {
      return NextResponse.json({ error: 'Advertiser account not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const campaignId = searchParams.get('campaignId')

    const where: any = { advertiserId: advertiser.id }
    if (status) {
      where.status = status
    }
    if (campaignId) {
      where.campaignId = campaignId
    }

    const offers = await prisma.offer.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ offers })
  } catch (error: any) {
    console.error('Failed to fetch offers:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch offers' },
      { status: 500 }
    )
  }
}

// POST /api/advertiser/offers - Create a new offer to a creator
export async function POST(request: NextRequest) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Find advertiser by email
    const advertiser = await prisma.advertiser.findUnique({
      where: { contactEmail: user.email },
    })

    if (!advertiser) {
      return NextResponse.json({ error: 'Advertiser account not found' }, { status: 404 })
    }

    // Verify advertiser is approved
    if (advertiser.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Advertiser account must be approved to make offers' },
        { status: 403 }
      )
    }

    const body = await request.json()
    console.log('[API] Received offer request:', JSON.stringify(body, null, 2))
    
    const {
      creatorId,
      campaignId,
      placement,
      duration,
      paymentType,
      amount,
      cpcRate,
      cpmRate,
      message,
      expiresInDays = 7, // Default 7 days to accept
    } = body

    // Validate required fields
    const missingFields: string[] = []
    if (!creatorId) missingFields.push('creatorId')
    if (!campaignId) missingFields.push('campaignId')
    if (!placement) missingFields.push('placement')
    if (!paymentType) missingFields.push('paymentType')
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields)
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }
    
    // Validate numeric fields
    if (duration === undefined || duration === null || typeof duration !== 'number' || duration <= 0) {
      console.error('Invalid duration:', duration, typeof duration)
      return NextResponse.json(
        { error: `Duration must be a positive number. Received: ${duration} (${typeof duration})` },
        { status: 400 }
      )
    }
    
    if (amount === undefined || amount === null || typeof amount !== 'number' || amount <= 0) {
      console.error('Invalid amount:', amount, typeof amount)
      return NextResponse.json(
        { error: `Amount must be a positive number. Received: ${amount} (${typeof amount})` },
        { status: 400 }
      )
    }

    // Verify campaign belongs to this advertiser
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.advertiserId !== advertiser.id) {
      return NextResponse.json({ error: 'Campaign does not belong to this advertiser' }, { status: 403 })
    }

    // Verify campaign is approved, pending review, or active
    if (campaign.status !== 'APPROVED' && campaign.status !== 'PENDING_REVIEW' && campaign.status !== 'ACTIVE') {
      console.error('Campaign not available for offers:', campaign.id, campaign.status)
      return NextResponse.json(
        { error: `Campaign must be approved, pending review, or active to make offers. Current status: ${campaign.status}` },
        { status: 400 }
      )
    }

    // Verify creator exists and is a creator
    const creator = await prisma.user.findUnique({
      where: { id: creatorId },
      select: { isCreator: true },
    })

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    if (!creator.isCreator) {
      return NextResponse.json({ error: 'User is not a creator' }, { status: 400 })
    }

    // Calculate expiration date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)

    // Create the offer
    const offer = await prisma.offer.create({
      data: {
        advertiserId: advertiser.id,
        campaignId: campaign.id,
        creatorId: creatorId,
        placement,
        duration: parseInt(String(duration)),
        paymentType,
        amount: new Prisma.Decimal(amount),
        cpcRate: cpcRate ? new Prisma.Decimal(cpcRate) : null,
        cpmRate: cpmRate ? new Prisma.Decimal(cpmRate) : null,
        message: message || null,
        expiresAt,
        status: 'PENDING',
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
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

    // TODO: Send notification to creator

    return NextResponse.json({ success: true, offer })
  } catch (error: any) {
    console.error('Failed to create offer:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create offer' },
      { status: 500 }
    )
  }
}

