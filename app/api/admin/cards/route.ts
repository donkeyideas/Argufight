import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// POST /api/admin/cards - Create a new card
export async function POST(request: Request) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { listId, title, description, position } = body

    if (!listId || !title) {
      return NextResponse.json(
        { error: 'listId and title are required' },
        { status: 400 }
      )
    }

    // Get max position if not provided
    let cardPosition = position
    if (cardPosition === undefined) {
      const maxCard = await prisma.card.findFirst({
        where: { listId },
        orderBy: { position: 'desc' },
      })
      cardPosition = maxCard ? maxCard.position + 1 : 0
    }

    const card = await prisma.card.create({
      data: {
        listId,
        title,
        description: description || null,
        position: cardPosition,
      },
      include: {
        labels: true,
      },
    })

    return NextResponse.json({ card })
  } catch (error: any) {
    console.error('Failed to create card:', error)
    return NextResponse.json(
      { error: 'Failed to create card' },
      { status: 500 }
    )
  }
}

