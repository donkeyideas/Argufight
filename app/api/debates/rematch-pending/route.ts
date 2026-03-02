import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

// GET /api/debates/rematch-pending - Get rematch requests pending user's response (for winners)
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('Fetching pending rematch requests for winner:', userId)

    // Fetch debates where user is the winner and there's a pending rematch request
    const rematchDebates = await prisma.$queryRaw<Array<{
      id: string
      topic: string
      description: string | null
      category: string
      status: string
      challenger_id: string
      opponent_id: string | null
      winner_id: string | null
      rematch_requested_by: string | null
      rematch_status: string | null
      rematch_debate_id: string | null
      created_at: Date
    }>>`
      SELECT 
        d.id,
        d.topic,
        d.description,
        d.category,
        d.status,
        d.challenger_id,
        d.opponent_id,
        d.winner_id,
        d.rematch_requested_by,
        d.rematch_status,
        d.rematch_debate_id,
        d.created_at
      FROM debates d
      WHERE d.winner_id = ${userId}
        AND d.rematch_status = 'PENDING'
        AND d.rematch_requested_by != ${userId}
    `

    console.log('Found pending rematch requests:', rematchDebates.length)

    // Fetch challenger and opponent info for each debate
    const debatesWithUsers = await Promise.all(
      rematchDebates.map(async (debate) => {
        const [challenger, opponent, requester] = await Promise.all([
          prisma.user.findUnique({
            where: { id: debate.challenger_id },
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              eloRating: true,
            },
          }),
          debate.opponent_id ? prisma.user.findUnique({
            where: { id: debate.opponent_id },
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              eloRating: true,
            },
          }) : null,
          debate.rematch_requested_by ? prisma.user.findUnique({
            where: { id: debate.rematch_requested_by },
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          }) : null,
        ])

        return {
          id: debate.id,
          topic: debate.topic,
          description: debate.description,
          category: debate.category,
          status: debate.status,
          challengerId: debate.challenger_id,
          opponentId: debate.opponent_id,
          winnerId: debate.winner_id,
          rematchRequestedBy: debate.rematch_requested_by,
          rematchStatus: debate.rematch_status,
          rematchDebateId: debate.rematch_debate_id,
          createdAt: debate.created_at,
          challenger: challenger!,
          opponent: opponent,
          requester: requester, // The person who requested the rematch
          isPendingRematch: true, // Flag to identify as pending rematch for winner
        }
      })
    )

    console.log('Returning pending rematch debates:', debatesWithUsers.length)
    return NextResponse.json(debatesWithUsers)
  } catch (error: any) {
    console.error('Failed to fetch pending rematch requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pending rematch requests', details: error.message },
      { status: 500 }
    )
  }
}

