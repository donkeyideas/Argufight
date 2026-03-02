/**
 * API Route: GET /api/belts
 * List all belts with optional filtering
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifySessionWithDb } from '@/lib/auth/session-verify'

export async function GET(request: NextRequest) {
  try {
    const session = await verifySessionWithDb()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check feature flag
    if (process.env.ENABLE_BELT_SYSTEM !== 'true') {
      return NextResponse.json({ error: 'Belt system is not enabled' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const category = searchParams.get('category')
    const holderId = searchParams.get('holderId')

    const where: any = {}

    if (status) {
      where.status = status
    }

    if (type) {
      where.type = type
    }

    if (category) {
      where.category = category
    }

    if (holderId) {
      where.currentHolderId = holderId
    }

    const belts = await prisma.belt.findMany({
      where,
      select: {
        id: true,
        name: true,
        type: true,
        category: true,
        status: true,
        designImageUrl: true, // Explicitly include designImageUrl
        coinValue: true,
        creationCost: true,
        acquiredAt: true,
        lastDefendedAt: true,
        timesDefended: true,
        successfulDefenses: true,
        createdAt: true,
        isStaked: true, // Include isStaked so UI can check if belt is challengeable
        currentHolder: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            eloRating: true,
          },
        },
        tournament: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    })

    // Force no cache headers to ensure fresh data
    const response = NextResponse.json({ belts })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
  } catch (error: any) {
    console.error('[API] Error fetching belts:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch belts' },
      { status: 500 }
    )
  }
}
