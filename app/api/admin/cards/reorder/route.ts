import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// POST /api/admin/cards/reorder - Reorder cards (drag and drop)
export async function POST(request: Request) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { cardId, newListId, newPosition, oldListId, oldPosition } = body

    if (!cardId || newListId === undefined || newPosition === undefined) {
      return NextResponse.json(
        { error: 'cardId, newListId, and newPosition are required' },
        { status: 400 }
      )
    }

    // Update the moved card
    await prisma.card.update({
      where: { id: cardId },
      data: {
        listId: newListId,
        position: newPosition,
      },
    })

    // If moved to a different list, update positions in both lists
    if (oldListId !== newListId) {
      // Update cards in old list (decrease position for cards after old position)
      await prisma.card.updateMany({
        where: {
          listId: oldListId,
          position: { gt: oldPosition },
        },
        data: {
          position: { decrement: 1 },
        },
      })

      // Update cards in new list (increase position for cards at or after new position)
      await prisma.card.updateMany({
        where: {
          listId: newListId,
          position: { gte: newPosition },
          id: { not: cardId },
        },
        data: {
          position: { increment: 1 },
        },
      })
    } else {
      // Same list, just reorder
      if (oldPosition < newPosition) {
        // Moving down
        await prisma.card.updateMany({
          where: {
            listId: newListId,
            position: { gt: oldPosition, lte: newPosition },
            id: { not: cardId },
          },
          data: {
            position: { decrement: 1 },
          },
        })
      } else if (oldPosition > newPosition) {
        // Moving up
        await prisma.card.updateMany({
          where: {
            listId: newListId,
            position: { gte: newPosition, lt: oldPosition },
            id: { not: cardId },
          },
          data: {
            position: { increment: 1 },
          },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to reorder cards:', error)
    return NextResponse.json(
      { error: 'Failed to reorder cards' },
      { status: 500 }
    )
  }
}

