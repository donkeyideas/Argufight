import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// POST /api/admin/cards/[id]/checklists - Create a checklist
export async function POST(
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
    const { title } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const checklist = await prisma.cardChecklist.create({
      data: {
        cardId: id,
        title: title || 'Checklist',
      },
      include: {
        items: true,
      },
    })

    return NextResponse.json({ checklist })
  } catch (error: any) {
    console.error('Failed to create checklist:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create checklist' },
      { status: 500 }
    )
  }
}

// GET /api/admin/cards/[id]/checklists - Get all checklists for a card
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
    const checklists = await prisma.cardChecklist.findMany({
      where: { cardId: id },
      include: {
        items: {
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { position: 'asc' },
    })

    return NextResponse.json({ checklists })
  } catch (error: any) {
    console.error('Failed to fetch checklists:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch checklists' },
      { status: 500 }
    )
  }
}

