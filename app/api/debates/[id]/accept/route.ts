import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

// POST /api/debates/[id]/accept - Accept challenge
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

    const { id } = await params
    const userId = getUserIdFromSession(session)
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is suspended
    const user = await prisma.user.findUnique({
      where: { id: userId || undefined },
      select: { id: true, bannedUntil: true, username: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if user is currently suspended
    if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
      const daysRemaining = Math.ceil((new Date(user.bannedUntil).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      return NextResponse.json(
        { 
          error: 'You are currently suspended from debating',
          suspensionDaysRemaining: daysRemaining,
          suspensionEndDate: user.bannedUntil,
        },
        { status: 403 }
      )
    }

    console.log('Accept challenge request:', { debateId: id, userId })

    const debate = await prisma.debate.findUnique({
      where: { id },
    })

    if (!debate) {
      console.error('Debate not found:', id)
      return NextResponse.json(
        { error: 'Debate not found' },
        { status: 404 }
      )
    }

    console.log('Debate found:', {
      id: debate.id,
      status: debate.status,
      challengerId: debate.challengerId,
      opponentId: debate.opponentId,
      challengeType: debate.challengeType,
      invitedUserIds: debate.invitedUserIds,
    })

    if (debate.status !== 'WAITING') {
      console.error('Debate not in WAITING status:', debate.status)
      return NextResponse.json(
        { error: `Debate is not available for acceptance. Current status: ${debate.status}` },
        { status: 400 }
      )
    }

    if (debate.challengerId === userId) {
      console.error('User trying to accept their own challenge')
      return NextResponse.json(
        { error: 'Cannot accept your own challenge' },
        { status: 400 }
      )
    }

    // Handle GROUP challenges differently
    if (debate.challengeType === 'GROUP') {
      // Check if user is already a participant
      const existingParticipant = await prisma.debateParticipant.findUnique({
        where: {
          debateId_userId: {
            debateId: id,
            userId: userId,
          },
        },
      })

      if (!existingParticipant) {
        return NextResponse.json(
          { error: 'You are not a participant in this group challenge' },
          { status: 403 }
        )
      }

      if (existingParticipant.status === 'ACCEPTED') {
        return NextResponse.json(
          { error: 'You have already accepted this challenge' },
          { status: 400 }
        )
      }

      if (existingParticipant.status === 'DECLINED') {
        return NextResponse.json(
          { error: 'You have already declined this challenge' },
          { status: 400 }
        )
      }

      // Update participant status to ACCEPTED
      await prisma.debateParticipant.update({
        where: { id: existingParticipant.id },
        data: {
          status: 'ACCEPTED',
          joinedAt: new Date(),
        },
      })

      // Check if all participants have accepted (or minimum threshold)
      const allParticipants = await prisma.debateParticipant.findMany({
        where: { debateId: id },
      })

      const acceptedCount = allParticipants.filter(p => p.status === 'ACCEPTED').length
      const totalCount = allParticipants.length
      const minimumToStart = Math.max(2, Math.ceil(totalCount * 0.5)) // At least 50% or minimum 2

      // If enough participants have accepted, start the debate
      if (acceptedCount >= minimumToStart && debate.status === 'WAITING') {
        const now = new Date()
        const deadline = new Date(now.getTime() + debate.roundDuration)

        await prisma.debate.update({
          where: { id },
          data: {
            status: 'ACTIVE',
            startedAt: now,
            currentRound: 1,
            roundDeadline: deadline,
          },
        })

        // Update all accepted participants to ACTIVE
        await prisma.debateParticipant.updateMany({
          where: {
            debateId: id,
            status: 'ACCEPTED',
          },
          data: {
            status: 'ACTIVE',
          },
        })

        // Notify all participants that debate has started (with push notifications)
        const { createDebateNotification } = await import('@/lib/notifications/debateNotifications')
        const participantIds = allParticipants.map(p => p.userId)
        for (const participantId of participantIds) {
          await createDebateNotification(
            debate.id,
            participantId,
            'DEBATE_ACCEPTED',
            'Group Challenge Started',
            `The group challenge "${debate.topic}" has started!`
          )
        }
      }

      // Fetch updated debate with participants
      const updatedDebate = await prisma.debate.findUnique({
        where: { id },
        include: {
          challenger: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              eloRating: true,
            },
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  avatarUrl: true,
                  eloRating: true,
                },
              },
            },
          },
        },
      })

      return NextResponse.json(updatedDebate)
    }

    // For DIRECT and OPEN challenges, use existing logic
    // Check if debate already has an opponent
    if (debate.opponentId) {
      if (debate.challengeType === 'DIRECT') {
        // For DIRECT challenges, opponentId is the intended opponent
        // If it matches the current user, they can accept
        if (debate.opponentId !== userId) {
          console.error('Direct challenge opponentId does not match current user:', {
            opponentId: debate.opponentId,
            userId,
          })
          return NextResponse.json(
            { error: 'This challenge is not for you' },
            { status: 403 }
          )
        }
        // If opponentId matches, continue (they're accepting their own invitation)
      } else {
        // For OPEN challenges, if opponentId exists, it's already accepted
        console.error('Debate already has an opponent:', debate.opponentId)
        return NextResponse.json(
          { error: 'This challenge has already been accepted by another user' },
          { status: 400 }
        )
      }
    }

    // For direct/group challenges, verify user is invited
    if (debate.challengeType === 'DIRECT' || debate.challengeType === 'GROUP') {
      if (!debate.invitedUserIds) {
        console.error('Direct/Group challenge has no invitedUserIds')
        return NextResponse.json(
          { error: 'This challenge has no invited users' },
          { status: 400 }
        )
      }

      let invitedIds: string[]
      try {
        invitedIds = JSON.parse(debate.invitedUserIds) as string[]
      } catch (error) {
        console.error('Failed to parse invitedUserIds:', debate.invitedUserIds, error)
        return NextResponse.json(
          { error: 'Invalid challenge invitation data' },
          { status: 400 }
        )
      }

      if (!Array.isArray(invitedIds)) {
        console.error('invitedUserIds is not an array:', invitedIds)
        return NextResponse.json(
          { error: 'Invalid challenge invitation format' },
          { status: 400 }
        )
      }

      if (!invitedIds.includes(userId)) {
        console.error('User not in invited list:', { userId, invitedIds })
        return NextResponse.json(
          { error: 'You are not invited to this challenge' },
          { status: 403 }
        )
      }
    }

    // Calculate round deadline
    const now = new Date()
    const deadline = new Date(now.getTime() + debate.roundDuration)

    // Use transaction to prevent race condition where two users accept simultaneously
    const updatedDebate = await prisma.$transaction(async (tx) => {
      // Re-check debate status inside transaction
      const current = await tx.debate.findUnique({ where: { id } })
      if (!current || current.status !== 'WAITING') {
        throw new Error('Debate is no longer available for acceptance')
      }
      if (current.opponentId && current.challengeType !== 'DIRECT') {
        throw new Error('This challenge has already been accepted by another user')
      }

      return tx.debate.update({
        where: { id },
        data: {
          opponentId: userId,
          status: 'ACTIVE',
          startedAt: now,
          currentRound: 1,
          roundDeadline: deadline,
        },
        include: {
          challenger: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              eloRating: true,
            }
          },
          opponent: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              eloRating: true,
            }
          },
        },
      })
    })

    // Notify challenger (with push notification)
    try {
      const { createDebateNotification } = await import('@/lib/notifications/debateNotifications')
      await createDebateNotification(
        debate.id,
        debate.challengerId,
        'DEBATE_ACCEPTED',
        'Challenge Accepted',
        `Your challenge "${debate.topic}" has been accepted!`
      )
    } catch (notifError) {
      console.error('Failed to create notification (non-fatal):', notifError)
      // Don't fail the request if notification creation fails
    }

    console.log('Challenge accepted successfully:', updatedDebate.id)
    return NextResponse.json(updatedDebate)
  } catch (error: any) {
    console.error('Failed to accept debate:', error)
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    })
    return NextResponse.json(
      { 
        error: 'Failed to accept debate',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    )
  }
}

