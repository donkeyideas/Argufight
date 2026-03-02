import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const category = searchParams.get('category')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (category) where.category = category

    const recommendations = await prisma.seoRecommendation.findMany({
      where,
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    })

    const counts = await prisma.seoRecommendation.groupBy({
      by: ['status'],
      _count: { id: true },
    })

    const statusCounts = {
      pending: 0,
      implemented: 0,
      dismissed: 0,
    }
    for (const c of counts) {
      if (c.status in statusCounts) {
        statusCounts[c.status as keyof typeof statusCounts] = c._count.id
      }
    }

    return NextResponse.json({ recommendations, statusCounts })
  } catch (error) {
    console.error('Error fetching recommendations:', error)
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, status } = body

    if (!id || !status || !['pending', 'implemented', 'dismissed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const updated = await prisma.seoRecommendation.update({
      where: { id },
      data: {
        status,
        resolvedAt: status !== 'pending' ? new Date() : null,
        resolvedBy: status !== 'pending' ? userId : null,
      },
    })

    return NextResponse.json({ recommendation: updated })
  } catch (error) {
    console.error('Error updating recommendation:', error)
    return NextResponse.json({ error: 'Failed to update recommendation' }, { status: 500 })
  }
}
