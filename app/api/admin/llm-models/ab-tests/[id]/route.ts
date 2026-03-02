import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

export const dynamic = 'force-dynamic'

// PUT /api/admin/llm-models/ab-tests/[id] - Update an A/B test
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const body = await request.json()
    const {
      name,
      description,
      trafficSplit,
      startDate,
      endDate,
      status,
      isActive,
      modelAScore,
      modelBScore,
      winner,
    } = body

    // If activating, deactivate other active tests
    if (isActive) {
      await prisma.aBTest.updateMany({
        where: {
          isActive: true,
          NOT: { id },
        },
        data: {
          isActive: false,
        },
      })
    }

    const updatedTest = await prisma.aBTest.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(trafficSplit !== undefined && { trafficSplit }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(status && { status }),
        ...(isActive !== undefined && { isActive }),
        ...(modelAScore !== undefined && { modelAScore }),
        ...(modelBScore !== undefined && { modelBScore }),
        ...(winner !== undefined && { winner }),
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

    return NextResponse.json({ test: updatedTest })
  } catch (error) {
    console.error('Failed to update A/B test:', error)
    return NextResponse.json(
      { error: 'Failed to update A/B test' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/llm-models/ab-tests/[id] - Delete an A/B test
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    await prisma.aBTest.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete A/B test:', error)
    return NextResponse.json(
      { error: 'Failed to delete A/B test' },
      { status: 500 }
    )
  }
}










