import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// DELETE /api/admin/tournaments/[id] - Delete a tournament (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: tournamentId } = await params

    // Get tournament to verify it exists
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        name: true,
        status: true,
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    // Admin can delete any tournament regardless of status
    // Delete tournament (cascade will handle related records: matches, rounds, participants, etc.)
    await prisma.tournament.delete({
      where: { id: tournamentId },
    })

    console.log(`[ADMIN] Tournament "${tournament.name}" (${tournamentId}) deleted by admin ${userId}`)

    return NextResponse.json({ 
      success: true, 
      message: 'Tournament deleted successfully' 
    })
  } catch (error: any) {
    console.error('Failed to delete tournament:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete tournament' },
      { status: 500 }
    )
  }
}

