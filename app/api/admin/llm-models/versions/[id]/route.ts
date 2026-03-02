import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

export const dynamic = 'force-dynamic'

// GET /api/admin/llm-models/versions/[id] - Get a specific model version
export async function GET(
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

    const version = await prisma.modelVersion.findUnique({
      where: { id },
      include: {
        metrics: {
          orderBy: {
            recordedAt: 'desc',
          },
        },
        appealPredictions: {
          take: 20,
          orderBy: {
            predictedAt: 'desc',
          },
          include: {
            debate: {
              select: {
                id: true,
                topic: true,
                category: true,
              },
            },
          },
        },
        _count: {
          select: {
            appealPredictions: true,
            metrics: true,
          },
        },
      },
    })

    if (!version) {
      return NextResponse.json({ error: 'Model version not found' }, { status: 404 })
    }

    return NextResponse.json({ version })
  } catch (error) {
    console.error('Failed to fetch model version:', error)
    return NextResponse.json(
      { error: 'Failed to fetch model version' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/llm-models/versions/[id] - Update a model version
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
    const { name, version, description, modelType, config, isActive, isDefault } = body

    // Get current version to check modelType
    const currentVersion = await prisma.modelVersion.findUnique({
      where: { id },
      select: { modelType: true },
    })

    if (!currentVersion) {
      return NextResponse.json({ error: 'Model version not found' }, { status: 404 })
    }

    // If setting as default, unset other defaults of same type
    if (isDefault) {
      await prisma.modelVersion.updateMany({
        where: {
          modelType: modelType || currentVersion.modelType,
          isDefault: true,
          NOT: { id },
        },
        data: {
          isDefault: false,
        },
      })
    }

    const updatedVersion = await prisma.modelVersion.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(version && { version }),
        ...(description !== undefined && { description }),
        ...(modelType && { modelType }),
        ...(config !== undefined && { config: config ? JSON.stringify(config) : null }),
        ...(isActive !== undefined && { isActive }),
        ...(isDefault !== undefined && { isDefault }),
      },
    })

    return NextResponse.json({ version: updatedVersion })
  } catch (error: any) {
    console.error('Failed to update model version:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A model with this name and version already exists' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to update model version' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/llm-models/versions/[id] - Delete a model version
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

    await prisma.modelVersion.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete model version:', error)
    return NextResponse.json(
      { error: 'Failed to delete model version' },
      { status: 500 }
    )
  }
}










