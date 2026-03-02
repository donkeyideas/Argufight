import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get user's email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Find advertiser
    const advertiser = await prisma.advertiser.findUnique({
      where: { contactEmail: user.email },
      select: { id: true },
    })

    if (!advertiser) {
      return NextResponse.json({ error: 'Advertiser account not found' }, { status: 404 })
    }

    // Get campaign with contracts (but NOT impressions/clicks — aggregate those separately)
    const [campaign, impressionCount, clickCount, impressionsByDay, clicksByDay] = await Promise.all([
      prisma.campaign.findUnique({
        where: {
          id,
          advertiserId: advertiser.id,
        },
        include: {
          contracts: {
            include: {
              creator: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
          },
        },
      }),

      // Count impressions (instead of loading all into memory)
      prisma.impression.count({ where: { campaignId: id } }),

      // Count clicks (instead of loading all into memory)
      prisma.click.count({ where: { campaignId: id } }),

      // Aggregate impressions by day using raw SQL
      prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT DATE("timestamp") as date, COUNT(*) as count
        FROM ad_impressions
        WHERE campaign_id = ${id}
        GROUP BY DATE("timestamp")
        ORDER BY date ASC
      `.catch(() => []),

      // Aggregate clicks by day using raw SQL
      prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT DATE("timestamp") as date, COUNT(*) as count
        FROM ad_clicks
        WHERE campaign_id = ${id}
        GROUP BY DATE("timestamp")
        ORDER BY date ASC
      `.catch(() => []),
    ])

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Calculate metrics using counts (not array.length)
    const impressions = impressionCount
    const clicks = clickCount
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0

    // Calculate spent
    let spent = 0
    if (campaign.type === 'PLATFORM_ADS') {
      spent = campaign.paymentStatus === 'PAID' ? Number(campaign.budget) : 0
    } else {
      spent = campaign.contracts.reduce(
        (sum, contract) => sum + Number(contract.totalAmount),
        0
      )
    }

    const remaining = Number(campaign.budget) - spent

    // Generate time-series data for chart (daily aggregation)
    const startDate = new Date(campaign.startDate)
    const endDate = new Date(campaign.endDate)
    const today = new Date()
    const chartEndDate = endDate > today ? today : endDate

    // Build lookup maps from aggregated data
    const impressionsByDate = new Map<string, number>()
    const clicksByDate = new Map<string, number>()

    for (const row of impressionsByDay) {
      const dateKey = new Date(row.date).toISOString().split('T')[0]
      impressionsByDate.set(dateKey, Number(row.count))
    }

    for (const row of clicksByDay) {
      const dateKey = new Date(row.date).toISOString().split('T')[0]
      clicksByDate.set(dateKey, Number(row.count))
    }

    // Create date range and build chart data
    const chartData: Array<{ date: string; impressions: number; clicks: number }> = []
    const currentDate = new Date(startDate)
    while (currentDate <= chartEndDate) {
      const dateKey = currentDate.toISOString().split('T')[0]
      chartData.push({
        date: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        impressions: impressionsByDate.get(dateKey) || 0,
        clicks: clicksByDate.get(dateKey) || 0,
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    const analytics = {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      budget: campaign.budget,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      impressions,
      clicks,
      ctr,
      spent,
      remaining,
      chartData,
      type: campaign.type,
      contracts: campaign.contracts.map((contract) => ({
        id: contract.id,
        creator: contract.creator,
        impressionsDelivered: contract.impressionsDelivered,
        clicksDelivered: contract.clicksDelivered,
        status: contract.status,
      })),
    }

    return NextResponse.json({ analytics })
  } catch (error: any) {
    console.error('Failed to fetch campaign analytics:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
