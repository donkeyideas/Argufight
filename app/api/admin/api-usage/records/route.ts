import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'


export async function GET(request: NextRequest) {
  try {
    const session = await verifySession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin
    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get time range from query params
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || 'all'

    let startDate: Date | undefined
    let endDate: Date | undefined

    const now = new Date()
    switch (range) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0))
        endDate = new Date()
        break
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7))
        endDate = new Date()
        break
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1))
        endDate = new Date()
        break
      default:
        startDate = undefined
        endDate = undefined
    }

    const where: any = {}
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = startDate
      if (endDate) where.createdAt.lte = endDate
    }

    const records = await prisma.apiUsage.findMany({
      where,
      select: {
        id: true,
        provider: true,
        endpoint: true,
        model: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        cost: true,
        success: true,
        errorMessage: true,
        responseTime: true,
        createdAt: true,
        metadata: true, // Include metadata
        debate: {
          select: {
            id: true,
            topic: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Limit to 100 most recent records
    })

    return NextResponse.json(records)
  } catch (error) {
    console.error('Failed to fetch API usage records:', error)
    return NextResponse.json(
      { error: 'Failed to fetch API usage records' },
      { status: 500 }
    )
  }
}

