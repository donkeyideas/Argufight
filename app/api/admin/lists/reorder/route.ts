import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// POST /api/admin/lists/reorder - Reorder lists (drag and drop)
export async function POST(request: Request) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { listId, newPosition, oldPosition, boardId } = body

    if (!listId || newPosition === undefined || oldPosition === undefined || !boardId) {
      return NextResponse.json(
        { error: 'listId, newPosition, oldPosition, and boardId are required' },
        { status: 400 }
      )
    }

    // Update the moved list
    await prisma.list.update({
      where: { id: listId },
      data: {
        position: newPosition,
      },
    })

    // Reorder other lists
    if (oldPosition < newPosition) {
      // Moving right
      await prisma.list.updateMany({
        where: {
          boardId,
          position: { gt: oldPosition, lte: newPosition },
          id: { not: listId },
        },
        data: {
          position: { decrement: 1 },
        },
      })
    } else if (oldPosition > newPosition) {
      // Moving left
      await prisma.list.updateMany({
        where: {
          boardId,
          position: { gte: newPosition, lt: oldPosition },
          id: { not: listId },
        },
        data: {
          position: { increment: 1 },
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to reorder lists:', error)
    return NextResponse.json(
      { error: 'Failed to reorder lists' },
      { status: 500 }
    )
  }
}

