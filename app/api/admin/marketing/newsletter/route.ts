import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/marketing/newsletter - Get all newsletters
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const strategyId = searchParams.get('strategyId')

    const where: any = {}
    if (status) where.status = status
    if (strategyId) where.strategyId = strategyId

    const newsletters = await prisma.emailNewsletter.findMany({
      where,
      include: {
        strategy: {
          select: {
            id: true,
            name: true,
          },
        },
        calendarItem: {
          select: {
            id: true,
            scheduledDate: true,
            scheduledTime: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({ newsletters })
  } catch (error: any) {
    console.error('Failed to fetch newsletters:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch newsletters' },
      { status: 500 }
    )
  }
}

// POST /api/admin/marketing/newsletter - Create newsletter
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      subject,
      content,
      htmlContent,
      status = 'DRAFT',
      strategyId,
      calendarItemId,
    } = body

    if (!subject || !content) {
      return NextResponse.json(
        { error: 'subject and content are required' },
        { status: 400 }
      )
    }

    const newsletter = await prisma.emailNewsletter.create({
      data: {
        subject: subject.trim(),
        content: content.trim(),
        htmlContent: htmlContent?.trim() || null,
        status,
        strategyId: strategyId || null,
        calendarItemId: calendarItemId || null,
      },
      include: {
        strategy: true,
        calendarItem: true,
      },
    })

    return NextResponse.json({ newsletter })
  } catch (error: any) {
    console.error('Failed to create newsletter:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create newsletter' },
      { status: 500 }
    )
  }
}

