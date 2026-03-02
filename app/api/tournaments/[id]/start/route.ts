import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { startTournament } from '@/lib/tournaments/match-generation'

/**
 * POST /api/tournaments/[id]/start
 * Manually start a tournament (creator only)
 */
export async function POST(
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

    const { id: tournamentId } = await params

    // Verify user is the creator
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        creatorId: true,
        status: true,
        participants: {
          select: {
            id: true,
          },
        },
        maxParticipants: true,
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    if (tournament.creatorId !== userId) {
      return NextResponse.json(
        { error: 'Only the tournament creator can start it' },
        { status: 403 }
      )
    }

    if (tournament.status === 'IN_PROGRESS' || tournament.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Tournament has already started or completed' },
        { status: 400 }
      )
    }

    if (tournament.participants.length < 2) {
      return NextResponse.json(
        { error: 'Tournament needs at least 2 participants to start' },
        { status: 400 }
      )
    }

    // Start the tournament
    await startTournament(tournamentId)

    return NextResponse.json({ success: true, message: 'Tournament started successfully' })
  } catch (error: any) {
    console.error('Failed to start tournament:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to start tournament' },
      { status: 500 }
    )
  }
}

