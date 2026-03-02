import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

export const dynamic = 'force-dynamic'

// GET /api/admin/llm-models/versions - Get all model versions
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

    const versions = await prisma.modelVersion.findMany({
      include: {
        metrics: {
          orderBy: {
            recordedAt: 'desc',
          },
          take: 10, // Latest 10 metrics per version
        },
        _count: {
          select: {
            appealPredictions: true,
            abTestsA: true,
            abTestsB: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ versions })
  } catch (error) {
    console.error('Failed to fetch model versions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch model versions' },
      { status: 500 }
    )
  }
}

// POST /api/admin/llm-models/versions - Create a new model version
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
    const { name, version, description, modelType, config, isActive, isDefault } = body

    if (!name || !version || !modelType) {
      return NextResponse.json(
        { error: 'Name, version, and modelType are required' },
        { status: 400 }
      )
    }

    // If setting as default, unset other defaults of same type
    if (isDefault) {
      await prisma.modelVersion.updateMany({
        where: {
          modelType,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      })
    }

    const modelVersion = await prisma.modelVersion.create({
      data: {
        name,
        version,
        description,
        modelType,
        config: config ? JSON.stringify(config) : null,
        isActive: isActive || false,
        isDefault: isDefault || false,
        createdBy: userId,
      },
    })

    return NextResponse.json({ version: modelVersion })
  } catch (error: any) {
    console.error('Failed to create model version:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A model with this name and version already exists' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create model version' },
      { status: 500 }
    )
  }
}










