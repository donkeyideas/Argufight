import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

export const dynamic = 'force-dynamic'

// DELETE /api/admin/debates/[id] - Delete a debate (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Check if debate exists
    const debate = await prisma.debate.findUnique({
      where: { id },
      select: { id: true, topic: true },
    })

    if (!debate) {
      return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
    }

    // Delete the debate (cascade will handle related records)
    await prisma.debate.delete({
      where: { id },
    })

    console.log(`[ADMIN] Debate deleted: ${debate.topic} (${id}) by admin ${userId}`)

    return NextResponse.json({ 
      success: true,
      message: 'Debate deleted successfully'
    })
  } catch (error: any) {
    console.error('Failed to delete debate:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Failed to delete debate' },
      { status: 500 }
    )
  }
}










