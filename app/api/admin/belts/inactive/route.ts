import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'
import { checkInactiveBelts } from '@/lib/belts/core'

export const dynamic = 'force-dynamic'

// GET /api/admin/belts/inactive - Get inactive belts
export async function GET() {
  try {
    const session = await verifySessionWithDb()
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    })

    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const inactiveBelts = await prisma.belt.findMany({
      where: {
        status: 'INACTIVE',
      },
      include: {
        currentHolder: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            eloRating: true,
          },
        },
      },
      orderBy: {
        inactiveAt: 'desc',
      },
    })

    return NextResponse.json({ belts: inactiveBelts })
  } catch (error: any) {
    console.error('Failed to fetch inactive belts:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch inactive belts' },
      { status: 500 }
    )
  }
}

// POST /api/admin/belts/inactive/check - Manually trigger inactive belt check
export async function POST(request: NextRequest) {
  try {
    const session = await verifySessionWithDb()
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    })

    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    // Run inactive belt check
    const result = await checkInactiveBelts()

    return NextResponse.json({
      message: 'Inactive belt check completed',
      beltsMarkedInactive: result.beltsMarkedInactive || 0,
    })
  } catch (error: any) {
    console.error('Failed to check inactive belts:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check inactive belts' },
      { status: 500 }
    )
  }
}
