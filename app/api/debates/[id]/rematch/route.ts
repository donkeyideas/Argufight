import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import crypto from 'crypto'

// POST /api/debates/[id]/rematch - Request, accept, or decline a rematch
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: debateId } = await params
    const { action } = await request.json()

    if (!['request', 'accept', 'decline'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "request", "accept", or "decline"' },
        { status: 400 }
      )
    }

    // Fetch debate - use raw SQL to get all fields including rematch fields
    let debate: any
    try {
      // Fetch all debate fields including rematch fields using raw SQL
      const debateResult = await prisma.$queryRawUnsafe<Array<{
        id: string
        topic: string
        description: string | null
        category: string
        status: string
        challenger_id: string
        opponent_id: string | null
        winner_id: string | null
        challenger_position: string
        opponent_position: string
        total_rounds: number
        round_duration: number
        speed_mode: number
        rematch_requested_by: string | null
        rematch_status: string | null
        rematch_debate_id: string | null
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
          d.challenger_position,
          d.opponent_position,
          d.total_rounds,
          d.round_duration,
          d.speed_mode,
          d.rematch_requested_by,
          d.rematch_status,
          d.rematch_debate_id
        FROM debates d
        WHERE d.id = $1
      `, debateId)

      if (debateResult.length === 0) {
        return NextResponse.json(
          { error: 'Debate not found' },
          { status: 404 }
        )
      }

      const debateRow = debateResult[0]

      // Fetch challenger and opponent info
      const [challenger, opponent] = await Promise.all([
        prisma.user.findUnique({
          where: { id: debateRow.challenger_id },
          select: { id: true, username: true },
        }),
        debateRow.opponent_id ? prisma.user.findUnique({
          where: { id: debateRow.opponent_id },
          select: { id: true, username: true },
        }) : null,
      ])

      debate = {
        id: debateRow.id,
        topic: debateRow.topic,
        description: debateRow.description,
        category: debateRow.category,
        status: debateRow.status,
        challengerId: debateRow.challenger_id,
        opponentId: debateRow.opponent_id,
        winnerId: debateRow.winner_id,
        challengerPosition: debateRow.challenger_position,
        opponentPosition: debateRow.opponent_position,
        totalRounds: debateRow.total_rounds,
        roundDuration: debateRow.round_duration,
        speedMode: debateRow.speed_mode === 1,
        rematchRequestedBy: debateRow.rematch_requested_by,
        rematchStatus: debateRow.rematch_status,
        rematchDebateId: debateRow.rematch_debate_id,
        challenger: challenger!,
        opponent: opponent,
      }
    } catch (error: any) {
      console.error('Failed to fetch debate:', error)
      return NextResponse.json(
        { error: 'Failed to fetch debate', details: error.message },
        { status: 500 }
      )
    }

    if (!debate) {
      return NextResponse.json(
        { error: 'Debate not found' },
        { status: 404 }
      )
    }

    // Verify user is a participant
    const isParticipant = userId === debate.challengerId || userId === debate.opponentId
    if (!isParticipant) {
      return NextResponse.json(
        { error: 'Only debate participants can request rematches' },
        { status: 403 }
      )
    }

    // Verify debate is finished
    if (debate.status !== 'VERDICT_READY') {
      return NextResponse.json(
        { error: 'Rematches can only be requested for completed debates' },
        { status: 400 }
      )
    }

    // Verify there's a winner (no rematch for ties)
    if (!debate.winnerId) {
      return NextResponse.json(
        { error: 'Rematches cannot be requested for tied debates' },
        { status: 400 }
      )
    }

    // Handle different actions
    if (action === 'request') {
      // Verify user is the loser
      if (userId === debate.winnerId) {
        return NextResponse.json(
          { error: 'Only the loser can request a rematch' },
          { status: 403 }
        )
      }

      // Check if rematch already requested
      if (debate.rematchStatus === 'PENDING') {
        return NextResponse.json(
          { error: 'A rematch request is already pending' },
          { status: 400 }
        )
      }

      if (debate.rematchStatus === 'ACCEPTED') {
        return NextResponse.json(
          { error: 'A rematch has already been accepted' },
          { status: 400 }
        )
      }

      // Request rematch - use raw SQL since Prisma may not have these fields yet
      // First check if columns exist
      const tableInfo = await prisma.$queryRawUnsafe<Array<{name: string}>>(`PRAGMA table_info(debates)`)
      const hasRematchColumns = tableInfo.some(col => col.name === 'rematch_requested_by')
      
      if (!hasRematchColumns) {
        console.error('Rematch columns do not exist in debates table. Please run the add-rematch-fields script.')
        return NextResponse.json(
          { error: 'Rematch feature not available. Database columns missing.' },
          { status: 500 }
        )
      }

      await prisma.$executeRawUnsafe(`
        UPDATE debates
        SET 
          rematch_requested_by = $1,
          rematch_requested_at = $2,
          rematch_status = $3
        WHERE id = $4
      `, userId, new Date().toISOString(), 'PENDING', debateId)
      
      console.log('Rematch requested successfully for debate:', debateId, 'by user:', userId)

      // Notify the winner - use raw SQL since Prisma may not have new notification types yet
      const winnerId = debate.winnerId
      const notificationId = crypto.randomUUID()
      const requesterUsername = debate.challengerId === userId ? debate.challenger.username : debate.opponent?.username
      
      console.log('Creating rematch notification for winner:', winnerId)
      console.log('Requester username:', requesterUsername)
      console.log('Debate topic:', debate.topic)
      
      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO notifications (id, user_id, type, title, message, debate_id, created_at, read)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
          notificationId,
          winnerId,
          'REMATCH_REQUESTED',
          'Rematch Requested',
          `${requesterUsername} has requested a rematch for "${debate.topic}"`,
          debateId,
          new Date().toISOString(),
          0  // unread
        )
        console.log('Rematch notification created successfully')
      } catch (error: any) {
        console.error('Failed to create rematch notification:', error)
        // Don't fail the request if notification creation fails
      }

      return NextResponse.json({
        success: true,
        message: 'Rematch requested successfully',
      })
    }

    if (action === 'accept' || action === 'decline') {
      // Verify user is the winner
      if (userId !== debate.winnerId) {
        return NextResponse.json(
          { error: 'Only the winner can respond to rematch requests' },
          { status: 403 }
        )
      }

      // Verify rematch is pending
      if (debate.rematchStatus !== 'PENDING') {
        return NextResponse.json(
          { error: 'No pending rematch request' },
          { status: 400 }
        )
      }

      if (action === 'decline') {
        // Decline rematch - use raw SQL
        await prisma.$executeRawUnsafe(`
          UPDATE debates
          SET rematch_status = $1
          WHERE id = $2
        `, 'DECLINED', debateId)

        // Notify the requester - use raw SQL
        const declineNotificationId = crypto.randomUUID()
        const declinerUsername = debate.challengerId === userId ? debate.challenger.username : debate.opponent?.username
        
        await prisma.$executeRawUnsafe(`
          INSERT INTO notifications (id, user_id, type, title, message, debate_id, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
          declineNotificationId,
          debate.rematchRequestedBy!,
          'REMATCH_DECLINED',
          'Rematch Declined',
          `${declinerUsername} declined your rematch request for "${debate.topic}"`,
          debateId,
          new Date().toISOString()
        )

        return NextResponse.json({
          success: true,
          message: 'Rematch declined',
        })
      }

      // Accept rematch - create new debate
      // Swap positions: loser becomes challenger, winner becomes opponent
      const loserId = debate.challengerId === debate.winnerId ? debate.opponentId! : debate.challengerId
      const winnerId = debate.winnerId

      // Determine new positions (swap them)
      // Positions are already in debate object from the raw SQL query
      const newChallengerPosition = debate.challengerId === debate.winnerId 
        ? debate.opponentPosition 
        : debate.challengerPosition
      const newOpponentPosition = debate.challengerId === debate.winnerId
        ? debate.challengerPosition
        : debate.opponentPosition

      // Create new debate
      const rematchDebateId = crypto.randomUUID()
      const now = new Date().toISOString()

      // Use raw SQL directly to handle any category and rematch fields
      await prisma.$executeRawUnsafe(`
        INSERT INTO debates (
          id, topic, description, category, challenger_id, challenger_position, 
          opponent_position, opponent_id, total_rounds, round_duration, speed_mode, 
          challenge_type, status, original_debate_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `,
        rematchDebateId,
        debate.topic,
        debate.description || null,
        debate.category,
        loserId,
        newChallengerPosition,
        newOpponentPosition,
        winnerId,
        debate.totalRounds,
        debate.roundDuration,
        debate.speedMode ? 1 : 0,
        'DIRECT',
        'WAITING',
        debateId,
        now,
        now
      )

      // Update original debate with rematch info - use raw SQL
      await prisma.$executeRawUnsafe(`
        UPDATE debates
        SET 
          rematch_status = $1,
          rematch_debate_id = $2
        WHERE id = $3
      `, 'ACCEPTED', rematchDebateId, debateId)

      // Notify both participants - use raw SQL
      const notificationNow = new Date().toISOString()
      const loserNotificationId = crypto.randomUUID()
      const winnerNotificationId = crypto.randomUUID()
      
      await prisma.$executeRawUnsafe(`
        INSERT INTO notifications (id, user_id, type, title, message, debate_id, created_at)
        VALUES 
          (?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?)
      `,
        loserNotificationId,
        loserId,
        'REMATCH_ACCEPTED',
        'Rematch Accepted!',
        `Your rematch request for "${debate.topic}" has been accepted. The debate is ready!`,
        rematchDebateId,
        notificationNow,
        winnerNotificationId,
        winnerId,
        'REMATCH_ACCEPTED',
        'Rematch Created',
        `You accepted the rematch for "${debate.topic}". The debate is ready!`,
        rematchDebateId,
        notificationNow
      )

      return NextResponse.json({
        success: true,
        message: 'Rematch accepted and debate created',
        rematchDebateId,
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Rematch error:', error)
    return NextResponse.json(
      { error: 'Failed to process rematch request', details: error.message },
      { status: 500 }
    )
  }
}

