import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/marketing/calendar - Get content calendar items
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: any = {}
    if (startDate && endDate) {
      where.scheduledDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    const items = await prisma.contentCalendarItem.findMany({
      where,
      include: {
        strategy: {
          select: {
            id: true,
            name: true,
          },
        },
        socialPost: {
          select: {
            id: true,
            platform: true,
            content: true,
          },
        },
        blogPost: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        newsletter: {
          select: {
            id: true,
            subject: true,
          },
        },
      },
      orderBy: { scheduledDate: 'asc' },
    })

    return NextResponse.json({ items })
  } catch (error: any) {
    console.error('Failed to fetch calendar items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calendar items' },
      { status: 500 }
    )
  }
}

// POST /api/admin/marketing/calendar - Create calendar item
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      strategyId,
      contentType,
      title,
      description,
      scheduledDate,
      scheduledTime,
      platform,
      requiresApproval = true,
    } = body

    if (!contentType || !scheduledDate) {
      return NextResponse.json(
        { error: 'Content type and scheduled date are required' },
        { status: 400 }
      )
    }

    const item = await prisma.contentCalendarItem.create({
      data: {
        strategyId: strategyId || null,
        contentType,
        title,
        description,
        scheduledDate: new Date(scheduledDate),
        scheduledTime,
        platform: platform || null,
        requiresApproval,
        status: 'DRAFT',
      },
      include: {
        strategy: true,
      },
    })

    return NextResponse.json({ success: true, item })
  } catch (error: any) {
    console.error('Failed to create calendar item:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create calendar item' },
      { status: 500 }
    )
  }
}

