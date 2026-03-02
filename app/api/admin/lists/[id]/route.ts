import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// PATCH /api/admin/lists/[id] - Update a list
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
    const { name, position, isArchived } = body

    const list = await prisma.list.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(position !== undefined && { position }),
        ...(isArchived !== undefined && { isArchived }),
      },
      include: {
        cards: {
          include: {
            labels: true,
          },
        },
      },
    })

    return NextResponse.json({ list })
  } catch (error: any) {
    console.error('Failed to update list:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Failed to update list' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/lists/[id] - Delete a list
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
    await prisma.list.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete list:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Failed to delete list' },
      { status: 500 }
    )
  }
}

