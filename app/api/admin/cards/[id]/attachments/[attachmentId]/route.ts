import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// DELETE /api/admin/cards/[id]/attachments/[attachmentId] - Remove attachment from card
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { attachmentId } = await params
    await prisma.cardAttachment.delete({
      where: { id: attachmentId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to remove attachment:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to remove attachment' },
      { status: 500 }
    )
  }
}

