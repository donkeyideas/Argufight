import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// POST /api/admin/cards/[id]/checklists/[checklistId]/items - Add item to checklist
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; checklistId: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { checklistId } = await params
    const body = await request.json()
    const { text } = body

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    // Get current max position
    const maxItem = await prisma.cardChecklistItem.findFirst({
      where: { checklistId },
      orderBy: { position: 'desc' },
    })

    const item = await prisma.cardChecklistItem.create({
      data: {
        checklistId,
        text,
        position: (maxItem?.position || 0) + 1,
      },
    })

    return NextResponse.json({ item })
  } catch (error: any) {
    console.error('Failed to add checklist item:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add checklist item' },
      { status: 500 }
    )
  }
}

