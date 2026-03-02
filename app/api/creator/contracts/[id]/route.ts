import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'

// GET /api/creator/contracts/[id] - Get a specific contract
export async function GET(
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

    const { id: contractId } = await params

    // Get the contract
    const contract = await prisma.adContract.findUnique({
      where: { id: contractId },
      include: {
        advertiser: {
          select: {
            id: true,
            companyName: true,
            website: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
        offer: {
          select: {
            id: true,
            message: true,
            createdAt: true,
          },
        },
        impressions: {
          select: {
            id: true,
            timestamp: true,
          },
          orderBy: {
            timestamp: 'desc',
          },
          take: 10,
        },
        clicks: {
          select: {
            id: true,
            timestamp: true,
          },
          orderBy: {
            timestamp: 'desc',
          },
          take: 10,
        },
      },
    })

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    // Verify the contract belongs to this creator
    if (contract.creatorId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json({ contract })
  } catch (error: any) {
    console.error('Failed to fetch contract:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch contract' },
      { status: 500 }
    )
  }
}
