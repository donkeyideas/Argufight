import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// PATCH /api/admin/marketing/calendar/[id] - Update calendar item
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

    const updateData: any = {}
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.scheduledDate) updateData.scheduledDate = new Date(body.scheduledDate)
    if (body.scheduledTime !== undefined) updateData.scheduledTime = body.scheduledTime
    if (body.status !== undefined) {
      updateData.status = body.status
      // Automatically set approvedBy and approvedAt when status is APPROVED
      if (body.status === 'APPROVED') {
        updateData.approvedAt = new Date()
        updateData.approvedBy = userId
      }
    }
    if (body.platform !== undefined) updateData.platform = body.platform
    if (body.requiresApproval !== undefined) updateData.requiresApproval = body.requiresApproval
    if (body.approvedAt !== undefined) {
      updateData.approvedAt = body.approvedAt ? new Date(body.approvedAt) : null
    }
    if (body.approvedBy !== undefined) updateData.approvedBy = body.approvedBy

    const item = await prisma.contentCalendarItem.update({
      where: { id },
      data: updateData,
      include: {
        strategy: true,
        socialPost: true,
        blogPost: true,
        newsletter: true,
      },
    })

    return NextResponse.json({ success: true, item })
  } catch (error: any) {
    console.error('Failed to update calendar item:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update calendar item' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/marketing/calendar/[id] - Delete calendar item
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

    await prisma.contentCalendarItem.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete calendar item:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete calendar item' },
      { status: 500 }
    )
  }
}

