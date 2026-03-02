import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { stakeBeltInTournament } from '@/lib/belts/tournament'

// POST /api/belts/[id]/stake - Stake a belt in a tournament
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySessionWithDb()
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: beltId } = await params
    const body = await request.json()
    const { tournamentId } = body

    if (!tournamentId) {
      return NextResponse.json(
        { error: 'Tournament ID is required' },
        { status: 400 }
      )
    }

    const belt = await stakeBeltInTournament(beltId, tournamentId, session.userId)

    return NextResponse.json({ belt })
  } catch (error: any) {
    console.error('Failed to stake belt:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to stake belt' },
      { status: 500 }
    )
  }
}
