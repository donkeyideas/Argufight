import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'
import { getCreatorEligibility } from '@/lib/ads/config'

// GET /api/creator/settings - Get creator settings
export async function GET(request: NextRequest) {
  try {
    const session = await verifySessionWithDb()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        eloRating: true,
        totalDebates: true,
        createdAt: true,
        profileBannerPrice: true,
        postDebatePrice: true,
        debateWidgetPrice: true,
        profileBannerAvailable: true,
        postDebateAvailable: true,
        debateWidgetAvailable: true,
        creatorStatus: true,
        isCreator: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check eligibility
    const eligibility = await getCreatorEligibility()
    const accountAgeMonths = Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)
    )

    const isEligible =
      user.eloRating >= eligibility.minELO &&
      user.totalDebates >= eligibility.minDebates &&
      accountAgeMonths >= eligibility.minAgeMonths

    return NextResponse.json({
      user,
      eligibility: {
        ...eligibility,
        accountAgeMonths,
        isEligible,
      },
    })
  } catch (error: any) {
    console.error('Failed to fetch creator settings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

// PUT /api/creator/settings - Update creator settings
export async function PUT(request: NextRequest) {
  try {
    const session = await verifySessionWithDb()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate input
    const updateData: any = {}

    if (body.profileBannerPrice !== undefined) {
      const price = Number(body.profileBannerPrice)
      if (price < 0) {
        return NextResponse.json(
          { error: 'Profile banner price must be >= 0' },
          { status: 400 }
        )
      }
      updateData.profileBannerPrice = price
    }

    if (body.postDebatePrice !== undefined) {
      const price = Number(body.postDebatePrice)
      if (price < 0) {
        return NextResponse.json(
          { error: 'Post debate price must be >= 0' },
          { status: 400 }
        )
      }
      updateData.postDebatePrice = price
    }

    if (body.debateWidgetPrice !== undefined) {
      const price = Number(body.debateWidgetPrice)
      if (price < 0) {
        return NextResponse.json(
          { error: 'Debate widget price must be >= 0' },
          { status: 400 }
        )
      }
      updateData.debateWidgetPrice = price
    }

    if (body.profileBannerAvailable !== undefined) {
      updateData.profileBannerAvailable = Boolean(body.profileBannerAvailable)
    }

    if (body.postDebateAvailable !== undefined) {
      updateData.postDebateAvailable = Boolean(body.postDebateAvailable)
    }

    if (body.debateWidgetAvailable !== undefined) {
      updateData.debateWidgetAvailable = Boolean(body.debateWidgetAvailable)
    }

    // Update user settings
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        profileBannerPrice: true,
        postDebatePrice: true,
        debateWidgetPrice: true,
        profileBannerAvailable: true,
        postDebateAvailable: true,
        debateWidgetAvailable: true,
      },
    })

    return NextResponse.json({
      success: true,
      user: updatedUser,
    })
  } catch (error: any) {
    console.error('Failed to update creator settings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update settings' },
      { status: 500 }
    )
  }
}
