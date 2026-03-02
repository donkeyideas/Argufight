import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

// DELETE /api/debates/[id]/comments/[commentId] - Delete a comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: debateId, commentId } = await params

    // Find the comment
    const comment = await prisma.debateComment.findUnique({
      where: { id: commentId },
    })

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    // Verify comment belongs to this debate
    if (comment.debateId !== debateId) {
      return NextResponse.json(
        { error: 'Comment does not belong to this debate' },
        { status: 400 }
      )
    }

    // Only allow user to delete their own comments
    if (comment.userId !== userId) {
      return NextResponse.json(
        { error: 'You can only delete your own comments' },
        { status: 403 }
      )
    }

    // Soft delete (mark as deleted instead of actually deleting)
    await prisma.debateComment.update({
      where: { id: commentId },
      data: { deleted: true },
    })

    return NextResponse.json({
      success: true,
      message: 'Comment deleted',
    })
  } catch (error) {
    console.error('Delete comment error:', error)
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    )
  }
}










