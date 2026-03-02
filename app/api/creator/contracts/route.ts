import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/creator/contracts?status=ACTIVE
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
    if (status) {
      where.status = status
    }

    const contracts = await prisma.adContract.findMany({
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
      // Order by startDate (most recent first)
      orderBy: { startDate: 'desc' },
    })

    console.log(`[API /creator/contracts] Found ${contracts.length} contracts for user ${userId}`)
    contracts.forEach((c, i) => {
      console.log(`[API /creator/contracts] Contract ${i + 1}: ID=${c.id}, Status=${c.status}, SignedAt=${c.signedAt}`)
    })

    return NextResponse.json({ contracts })
  } catch (error: any) {
    console.error('Failed to fetch contracts:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch contracts' },
      { status: 500 }
    )
  }
}

