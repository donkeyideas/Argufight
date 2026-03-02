import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'


// GET /api/admin/contracts?status=ACTIVE
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: any = {}
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
        creator: {
          select: {
            id: true,
            username: true,
            creatorStatus: true,
            creatorTaxInfo: {
              select: {
                stripeAccountId: true,
                payoutEnabled: true,
              },
            },
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { signedAt: 'desc' },
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

