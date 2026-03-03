import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/judges/[id] — Single judge with recent verdicts
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const judge = await prisma.judge.findUnique({
      where: { id },
      include: {
        verdicts: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            debate: {
              select: {
                id: true,
                topic: true,
                category: true,
                status: true,
                challenger: { select: { username: true } },
                opponent: { select: { username: true } },
              },
            },
          },
        },
        _count: { select: { verdicts: true } },
      },
    })

    if (!judge) {
      return NextResponse.json({ error: 'Judge not found' }, { status: 404 })
    }

    return NextResponse.json({ judge })
  } catch (error) {
    console.error('Failed to fetch judge:', error)
    return NextResponse.json({ error: 'Failed to fetch judge' }, { status: 500 })
  }
}

// PATCH /api/admin/judges/[id] — Update judge fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const allowedFields = ['name', 'personality', 'emoji', 'description', 'systemPrompt', 'avatarUrl']
    const data: Record<string, string> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field]
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const judge = await prisma.judge.update({
      where: { id },
      data,
    })

    return NextResponse.json({ judge })
  } catch (error: any) {
    console.error('Failed to update judge:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A judge with this name already exists' }, { status: 400 })
    }
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Judge not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to update judge' }, { status: 500 })
  }
}

// DELETE /api/admin/judges/[id] — Delete a judge
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    await prisma.judge.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete judge:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Judge not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to delete judge' }, { status: 500 })
  }
}
