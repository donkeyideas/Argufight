import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'


// GET /api/admin/campaigns?type=PLATFORM_ADS&status=PENDING_REVIEW
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const status = searchParams.get('status')

    const now = new Date()

    // Auto-activate and auto-complete campaigns based on dates
    try {
      await prisma.campaign.updateMany({
        where: {
          status: 'APPROVED',
          startDate: { lte: now },
          endDate: { gte: now },
        },
        data: { status: 'ACTIVE' },
      })

      await prisma.campaign.updateMany({
        where: {
          status: 'ACTIVE',
          endDate: { lt: now },
        },
        data: { status: 'COMPLETED' },
      })

      await prisma.campaign.updateMany({
        where: {
          status: 'SCHEDULED',
          endDate: { lt: now },
        },
        data: { status: 'COMPLETED' },
      })
    } catch (error: any) {
      // Don't fail the request if auto-activation fails
      console.error('[API /admin/campaigns] Auto-activation error:', error.message)
    }

    const where: any = {}
    if (type) {
      where.type = type
    }
    if (status) {
      where.status = status
    }

    // Try to fetch campaigns - if payment fields don't exist, we'll handle it
    let campaigns
    try {
      campaigns = await prisma.campaign.findMany({
        where,
        include: {
          advertiser: {
            select: {
              id: true,
              companyName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    } catch (error: any) {
      // If error is about payment fields, use select instead of include
      const errorMessage = error?.message || ''
      if (
        errorMessage.includes('payment_status') ||
        errorMessage.includes('stripe_payment_id') ||
        errorMessage.includes('paid_at') ||
        errorMessage.includes('does not exist')
      ) {
        campaigns = await prisma.campaign.findMany({
          where,
          select: {
            id: true,
            advertiserId: true,
            name: true,
            type: true,
            category: true,
            budget: true,
            startDate: true,
            endDate: true,
            bannerUrl: true,
            videoUrl: true,
            destinationUrl: true,
            ctaText: true,
            minELO: true,
            targetCategories: true,
            minFollowers: true,
            maxBudgetPerCreator: true,
            status: true,
            rejectionReason: true,
            createdAt: true,
            updatedAt: true,
            approvedAt: true,
            advertiser: {
              select: {
                id: true,
                companyName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
        // Add null values for payment fields
        campaigns = campaigns.map((c) => ({
          ...c,
          paymentStatus: null,
          stripePaymentId: null,
          paidAt: null,
        }))
      } else {
        throw error
      }
    }

    return NextResponse.json({ campaigns })
  } catch (error: any) {
    console.error('[API /admin/campaigns] Error:', error.message)
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch campaigns',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
