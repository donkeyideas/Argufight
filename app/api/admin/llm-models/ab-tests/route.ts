import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

export const dynamic = 'force-dynamic'

// GET /api/admin/llm-models/ab-tests - Get all A/B tests
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

    const tests = await prisma.aBTest.findMany({
      include: {
        modelVersionA: {
          select: {
            id: true,
            name: true,
            version: true,
          },
        },
        modelVersionB: {
          select: {
            id: true,
            name: true,
            version: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ tests })
  } catch (error) {
    console.error('Failed to fetch A/B tests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch A/B tests' },
      { status: 500 }
    )
  }
}

// POST /api/admin/llm-models/ab-tests - Create a new A/B test
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
    const {
      name,
      description,
      modelVersionAId,
      modelVersionBId,
      trafficSplit,
      startDate,
      endDate,
      status,
      isActive,
    } = body

    if (!name || !modelVersionAId || !modelVersionBId || !startDate) {
      return NextResponse.json(
        { error: 'Name, modelVersionAId, modelVersionBId, and startDate are required' },
        { status: 400 }
      )
    }

    if (modelVersionAId === modelVersionBId) {
      return NextResponse.json(
        { error: 'Model A and Model B must be different' },
        { status: 400 }
      )
    }

    if (trafficSplit < 0 || trafficSplit > 100) {
      return NextResponse.json(
        { error: 'Traffic split must be between 0 and 100' },
        { status: 400 }
      )
    }

    // If activating, deactivate other active tests
    if (isActive) {
      await prisma.aBTest.updateMany({
        where: {
          isActive: true,
        },
        data: {
          isActive: false,
        },
      })
    }

    const test = await prisma.aBTest.create({
      data: {
        name,
        description,
        modelVersionAId,
        modelVersionBId,
        trafficSplit: trafficSplit || 50,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        status: status || 'draft',
        isActive: isActive || false,
        createdBy: userId,
      },
      include: {
        modelVersionA: {
          select: {
            id: true,
            name: true,
            version: true,
          },
        },
        modelVersionB: {
          select: {
            id: true,
            name: true,
            version: true,
          },
        },
      },
    })

    return NextResponse.json({ test })
  } catch (error) {
    console.error('Failed to create A/B test:', error)
    return NextResponse.json(
      { error: 'Failed to create A/B test' },
      { status: 500 }
    )
  }
}










