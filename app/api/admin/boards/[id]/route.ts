import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/boards/[id] - Get a specific board
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const board = await prisma.board.findUnique({
      where: { id },
      include: {
        lists: {
          where: { isArchived: false },
          include: {
            cards: {
              where: { isArchived: false },
              include: {
                labels: true,
                checklists: {
                  include: {
                    items: {
                      orderBy: { position: 'asc' },
                    },
                  },
                  orderBy: { position: 'asc' },
                },
                members: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        username: true,
                        email: true,
                        avatarUrl: true,
                      },
                    },
                  },
                },
                attachments: {
                  orderBy: { createdAt: 'desc' },
                },
                customFields: {
                  orderBy: { position: 'asc' },
                },
              },
              orderBy: { position: 'asc' },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    })

    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 })
    }

    return NextResponse.json({ board })
  } catch (error) {
    console.error('Failed to fetch board:', error)
    return NextResponse.json(
      { error: 'Failed to fetch board' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/boards/[id] - Update a board
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
    const { name, description, color, isArchived } = body

    const board = await prisma.board.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(color !== undefined && { color }),
        ...(isArchived !== undefined && { isArchived }),
      },
    })

    return NextResponse.json({ board })
  } catch (error: any) {
    console.error('Failed to update board:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Failed to update board' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/boards/[id] - Delete a board
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await prisma.board.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete board:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Failed to delete board' },
      { status: 500 }
    )
  }
}

