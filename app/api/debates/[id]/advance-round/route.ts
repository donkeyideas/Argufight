import { NextRequest, NextResponse } from 'next/server'
import { advanceDebateRound } from '@/lib/debates/round-advancement'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/debates/[id]/advance-round - Manually advance a debate round
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Optional: Add admin/moderator check if only privileged users should advance rounds
    // const session = await verifySessionWithDb()
    // if (!session || !session.user.isAdmin) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const { id: debateId } = await params
    const result = await advanceDebateRound(debateId)

    if (result.skipped) {
      return NextResponse.json({ success: true, message: result.reason }, { status: 200 })
    }

    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('Failed to advance debate round:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to advance debate round' },
      { status: 500 }
    )
  }
}
