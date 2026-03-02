import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

// GET /api/debates/rematch-requests - Get rematch requests for a user
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

    const { searchParams } = new URL(request.url)
    // Use the userId from the query param if provided, otherwise use session userId
    // But verify it matches the session user (for security)
    const requestedUserId = searchParams.get('userId')
    
    // If a userId param is provided, verify it matches the session user
    // (users can only see their own rematch requests)
    const finalUserId = requestedUserId && requestedUserId === userId ? requestedUserId : userId

    console.log('Fetching rematch requests:')
    console.log('  Session userId:', userId)
    console.log('  Requested userId param:', requestedUserId)
    console.log('  Final userId to query:', finalUserId)

    // First check if rematch columns exist
    try {
      const tableInfo = await prisma.$queryRawUnsafe<Array<{name: string}>>(`PRAGMA table_info(debates)`)
      const hasRematchColumns = tableInfo.some(col => col.name === 'rematch_requested_by')
      console.log('Rematch columns exist:', hasRematchColumns)
      
      if (!hasRematchColumns) {
        console.warn('Rematch columns do not exist in debates table')
        return NextResponse.json([])
      }
    } catch (error) {
      console.error('Error checking table structure:', error)
      // Continue anyway
    }

    // Fetch debates where user requested a rematch (pending or accepted)
    // Use raw SQL to get rematch fields
    const rematchDebates = await prisma.$queryRawUnsafe<Array<{
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
    }>>(`
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
      WHERE d.rematch_requested_by = $1
        AND (d.rematch_status = 'PENDING' OR d.rematch_status = 'ACCEPTED')
    `, finalUserId)

    console.log('Found rematch debates:', rematchDebates.length)
    console.log('Rematch debates raw:', JSON.stringify(rematchDebates, null, 2))

    // Fetch challenger and opponent info for each debate
    const debatesWithUsers = await Promise.all(
      rematchDebates.map(async (debate) => {
        const [challenger, opponent] = await Promise.all([
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
          isRematch: true, // Flag to identify as rematch request
        }
      })
    )

    console.log('Returning debates with users:', debatesWithUsers.length)
    return NextResponse.json(debatesWithUsers)
  } catch (error: any) {
    console.error('Failed to fetch rematch requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rematch requests', details: error.message },
      { status: 500 }
    )
  }
}

