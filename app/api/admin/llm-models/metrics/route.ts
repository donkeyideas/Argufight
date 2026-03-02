import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

export const dynamic = 'force-dynamic'

// GET /api/admin/llm-models/metrics - Get metrics for model versions
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

    const { searchParams } = new URL(request.url)
    const modelVersionId = searchParams.get('modelVersionId')
    const metricType = searchParams.get('metricType')
    const period = searchParams.get('period') // daily, weekly, monthly

    const where: any = {}
    if (modelVersionId) {
      where.modelVersionId = modelVersionId
    }
    if (metricType) {
      where.metricType = metricType
    }
    if (period) {
      where.period = period
    }

    const metrics = await prisma.modelMetric.findMany({
      where,
      include: {
        modelVersion: {
          select: {
            id: true,
            name: true,
            version: true,
            modelType: true,
          },
        },
      },
      orderBy: {
        recordedAt: 'desc',
      },
      take: 100,
    })

    return NextResponse.json({ metrics })
  } catch (error) {
    console.error('Failed to fetch metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}

// POST /api/admin/llm-models/metrics - Record a new metric
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { modelVersionId, metricType, metricValue, dataset, period, notes } = body

    if (!modelVersionId || !metricType || metricValue === undefined) {
      return NextResponse.json(
        { error: 'modelVersionId, metricType, and metricValue are required' },
        { status: 400 }
      )
    }

    const metric = await prisma.modelMetric.create({
      data: {
        modelVersionId,
        metricType,
        metricValue,
        dataset,
        period,
        notes,
      },
    })

    return NextResponse.json({ metric })
  } catch (error) {
    console.error('Failed to create metric:', error)
    return NextResponse.json(
      { error: 'Failed to create metric' },
      { status: 500 }
    )
  }
}










