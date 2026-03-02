import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'


// GET /api/admin/advertisers?status=PENDING
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

    // Query with all fields - if new fields don't exist, Prisma will error
    // We'll catch and retry with basic fields only
    let advertisers
    try {
      advertisers = await prisma.advertiser.findMany({
        where,
        select: {
          id: true,
          companyName: true,
          industry: true,
          contactEmail: true,
          contactName: true,
          website: true,
          businessEIN: true,
          status: true,
          createdAt: true,
          approvedAt: true,
          rejectionReason: true,
          suspendedAt: true,
          suspensionReason: true,
          contactPhone: true,
          companySize: true,
          monthlyAdBudget: true,
          marketingGoals: true,
        },
        orderBy: { createdAt: 'desc' },
      })
    } catch (error: any) {
      // If error is about missing columns, retry with basic fields only
      const errorMessage = error?.message || ''
      if (
        errorMessage.includes('contact_phone') ||
        errorMessage.includes('company_size') ||
        errorMessage.includes('monthly_ad_budget') ||
        errorMessage.includes('marketing_goals') ||
        errorMessage.includes('does not exist')
      ) {
        // Retry with basic fields only
        advertisers = await prisma.advertiser.findMany({
          where,
          select: {
            id: true,
            companyName: true,
            industry: true,
            contactEmail: true,
            contactName: true,
            website: true,
            businessEIN: true,
            status: true,
            createdAt: true,
            approvedAt: true,
            rejectionReason: true,
            suspendedAt: true,
            suspensionReason: true,
          },
          orderBy: { createdAt: 'desc' },
        })
        // Add null values for new fields
        advertisers = advertisers.map((adv) => ({
          ...adv,
          contactPhone: null,
          companySize: null,
          monthlyAdBudget: null,
          marketingGoals: null,
        }))
      } else {
        // Different error - rethrow
        throw error
      }
    }

    return NextResponse.json({ advertisers: advertisers || [] })
  } catch (error: any) {
    console.error('[API /admin/advertisers] Error:', error.message)
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch advertisers',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
