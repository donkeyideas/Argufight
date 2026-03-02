import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'

// GET /api/creator/offers?status=PENDING
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: any = { creatorId: userId }
    if (status && status !== '') {
      where.status = status
    }
    // If no status filter or status is empty, return all offers

    const offers = await prisma.offer.findMany({
      where,
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

