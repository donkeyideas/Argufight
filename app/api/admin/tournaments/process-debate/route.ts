import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { updateTournamentMatchOnDebateComplete } from '@/lib/tournaments/match-completion'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/tournaments/process-debate
 * Manually trigger tournament match completion for a debate
 * Used to process already-completed debates that need evaluation
 *
 * Body: { debateId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { debateId } = body

    if (!debateId) {
      return NextResponse.json(
        { error: 'Debate ID is required in request body' },
        { status: 400 }
      )
    }

    console.log(`[Admin] Manually triggering tournament match completion for debate ${debateId} by admin ${userId}`)

    // Trigger tournament match completion
    await updateTournamentMatchOnDebateComplete(debateId)

    return NextResponse.json({
      success: true,
      message: 'Tournament match completion triggered successfully',
      debateId,
    })
  } catch (error: any) {
    console.error('Failed to process debate:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process debate' },
      { status: 500 }
    )
  }
}








