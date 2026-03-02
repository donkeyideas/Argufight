import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'
import { getCreatorTierFromELO } from '@/lib/ads/creator-tier'

// POST /api/creators/enable - Enable creator mode for a user (no eligibility requirements)
export async function POST(request: NextRequest) {
  try {
    const session = await verifySessionWithDb()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        eloRating: true,
        isCreator: true,
        creatorStatus: true,
        profileBannerPrice: true,
        postDebatePrice: true,
        debateWidgetPrice: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if already a creator
    if (user.isCreator) {
      return NextResponse.json({
        success: true,
        message: 'Creator mode already enabled',
        isCreator: true,
      })
    }

    // Determine creator tier based on ELO
    const creatorTier = getCreatorTierFromELO(user.eloRating)

    // Enable creator mode
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isCreator: true,
        creatorStatus: creatorTier,
        creatorSince: new Date(),
        // Set default prices if not set
        profileBannerPrice: user.profileBannerPrice ?? 300,
        postDebatePrice: user.postDebatePrice ?? 150,
        debateWidgetPrice: user.debateWidgetPrice ?? 200,
      },
      select: {
        id: true,
        isCreator: true,
        creatorStatus: true,
        creatorSince: true,
      },
    })

    // Initialize CreatorTaxInfo if it doesn't exist
    await prisma.creatorTaxInfo.upsert({
      where: { creatorId: userId },
      update: {},
      create: {
        creatorId: userId,
        stripeAccountId: `temp_${userId}`, // Placeholder
        yearlyEarnings: {},
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Creator mode enabled successfully',
      user: updatedUser,
    })
  } catch (error: any) {
    console.error('Failed to enable creator mode:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to enable creator mode' },
      { status: 500 }
    )
  }
}
