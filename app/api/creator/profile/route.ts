import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'

// GET /api/creator/profile - Get creator profile info
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
        avgMonthlyViews: true,
        followerCount: true,
        creatorStatus: true,
        profileBannerPrice: true,
        postDebatePrice: true,
        debateWidgetPrice: true,
        profileBannerAvailable: true,
        postDebateAvailable: true,
        debateWidgetAvailable: true,
        isCreator: true,
      },
    })

    return NextResponse.json({ user })
  } catch (error: any) {
    console.error('Failed to fetch creator profile:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}

