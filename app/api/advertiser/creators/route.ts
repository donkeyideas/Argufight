import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { isCreatorMarketplaceEnabled } from '@/lib/ads/config'

// GET /api/advertiser/creators - Discover creators
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if creator marketplace is enabled
    const marketplaceEnabled = await isCreatorMarketplaceEnabled()
    if (!marketplaceEnabled) {
      return NextResponse.json(
        { error: 'Creator Marketplace is currently disabled' },
        { status: 403 }
      )
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is an approved advertiser
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

    if (!advertiser || advertiser.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Advertiser account required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const minELO = searchParams.get('minELO')
    const category = searchParams.get('category')
    const minFollowers = searchParams.get('minFollowers')
    const search = searchParams.get('search')

    // If searching by username, allow searching all users (not just creators)
    // Otherwise, only show users marked as creators
    const where: any = search && search.trim() ? {} : { isCreator: true }

    // If searching, don't require isCreator flag
    // If not searching, require isCreator
    if (!search || !search.trim()) {
      where.isCreator = true
    }

    if (minELO) {
      where.eloRating = { gte: parseInt(minELO, 10) }
    }

    if (minFollowers) {
      where.followerCount = { gte: parseInt(minFollowers, 10) }
    }

    if (search && search.trim()) {
      // Use case-insensitive search
      const searchTerm = search.trim()
      where.username = { 
        contains: searchTerm, 
        mode: 'insensitive' 
      }
    }

    console.log('[API] Fetching creators with filters:', {
      isCreator: where.isCreator,
      minELO: where.eloRating,
      minFollowers: where.followerCount,
      search: where.username,
    })

    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50) // Max 50 per page
    const skip = (page - 1) * limit

    // Get total count for pagination
    const total = await prisma.user.count({ where })

    const creators = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        eloRating: true,
        creatorStatus: true,
        totalDebates: true,
        debatesWon: true,
        avgMonthlyViews: true,
        avgDebateViews: true,
        followerCount: true,
        profileBannerPrice: true,
        postDebatePrice: true,
        debateWidgetPrice: true,
        profileBannerAvailable: true,
        postDebateAvailable: true,
        debateWidgetAvailable: true,
      },
      orderBy: { eloRating: 'desc' },
      skip,
      take: limit,
    })

    console.log('[API] Found creators:', creators.length, 'Page:', page, 'Total:', total)
    if (creators.length > 0) {
      console.log('[API] Sample creator usernames:', creators.slice(0, 5).map(c => c.username))
    }

    // Filter by category if provided (would need debate history analysis)
    // For now, return all matching creators

    // Ensure numeric fields have default values to prevent frontend errors
    const safeCreators = creators.map(creator => ({
      ...creator,
      eloRating: creator.eloRating ?? 0,
      totalDebates: creator.totalDebates ?? 0,
      debatesWon: creator.debatesWon ?? 0,
      avgMonthlyViews: creator.avgMonthlyViews ?? 0,
      avgDebateViews: creator.avgDebateViews ?? 0,
      followerCount: creator.followerCount ?? 0,
    }))

    return NextResponse.json({
      creators: safeCreators,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Failed to fetch creators:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch creators' },
      { status: 500 }
    )
  }
}

