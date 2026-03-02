import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

// POST /api/debates/[id]/decline - Decline a challenge invitation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: debateId } = await params
    const userId = getUserIdFromSession(session)
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      include: {
        challenger: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    })

    if (!debate) {
      return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
    }

    // Check if debate is in WAITING status
    if (debate.status !== 'WAITING') {
      return NextResponse.json(
        { error: 'This challenge is no longer available' },
        { status: 400 }
      )
    }

    // Check if user is invited (for DIRECT or GROUP challenges)
    if (debate.challengeType === 'DIRECT' || debate.challengeType === 'GROUP') {
      // Handle GROUP challenges differently
      if (debate.challengeType === 'GROUP') {
        // Check if user is a participant
        const participant = await prisma.debateParticipant.findUnique({
          where: {
            debateId_userId: {
              debateId: debateId,
              userId: userId,
            },
          },
        })

        if (!participant) {
          return NextResponse.json(
            { error: 'You are not a participant in this group challenge' },
            { status: 403 }
          )
        }

        if (participant.status === 'DECLINED') {
          return NextResponse.json(
            { error: 'You have already declined this challenge' },
            { status: 400 }
          )
        }

        // Update participant status to DECLINED
        await prisma.debateParticipant.update({
          where: { id: participant.id },
          data: {
            status: 'DECLINED',
          },
        })

        // Check if enough participants remain (at least 2)
        const allParticipants = await prisma.debateParticipant.findMany({
          where: { debateId: debateId },
        })

        const activeCount = allParticipants.filter(
          p => p.status === 'ACCEPTED' || p.status === 'ACTIVE'
        ).length

        // If less than 2 active participants, cancel the debate
        if (activeCount < 2) {
          await prisma.debate.update({
            where: { id: debateId },
            data: {
              status: 'CANCELLED',
            },
          })
        }

        // Send notification to challenger
        await prisma.$executeRawUnsafe(`
          INSERT INTO notifications (id, user_id, type, title, message, debate_id, created_at)
          VALUES (gen_random_uuid(), $1, $2::"NotificationType", $3, $4, $5, NOW())
        `,
          debate.challengerId,
          'DEBATE_ACCEPTED', // Using existing enum value
          'Challenge Declined',
          `A participant declined your group challenge: "${debate.topic}"`,
          debateId
        )

        return NextResponse.json({ 
          success: true,
          message: 'Challenge declined',
        })
      }

      // Handle DIRECT challenges (existing logic)
      if (!debate.invitedUserIds) {
        return NextResponse.json(
          { error: 'This challenge has no invited users' },
          { status: 400 }
        )
      }

      const invitedIds = JSON.parse(debate.invitedUserIds) as string[]
      if (!invitedIds.includes(userId)) {
        return NextResponse.json(
          { error: 'You are not invited to this challenge' },
          { status: 403 }
        )
      }

      // Remove user from invited list
      const updatedInvitedIds = invitedIds.filter((id) => id !== userId)
      
      // If no more invited users and it's a DIRECT challenge, cancel the debate
      if (updatedInvitedIds.length === 0 || (debate.challengeType === 'DIRECT' && updatedInvitedIds.length === 0)) {
        await prisma.debate.update({
          where: { id: debateId },
          data: {
            status: 'CANCELLED',
            invitedUserIds: null,
          },
        })
      } else {
        // Update invited list
        await prisma.debate.update({
          where: { id: debateId },
          data: {
            invitedUserIds: JSON.stringify(updatedInvitedIds),
          },
        })
      }

      // Send notification to challenger using raw SQL
      await prisma.$executeRawUnsafe(`
        INSERT INTO notifications (id, user_id, type, title, message, debate_id, created_at)
        VALUES (gen_random_uuid(), $1, $2::"NotificationType", $3, $4, $5, NOW())
      `,
        debate.challengerId,
        'DEBATE_ACCEPTED', // Using existing enum value
        'Challenge Declined',
        `Your challenge "${debate.topic}" was declined`,
        debateId
      )

      return NextResponse.json({ 
        success: true,
        message: 'Challenge declined',
      })
    }

    // For OPEN challenges, user can't decline (they just don't accept)
    return NextResponse.json(
      { error: 'You can only decline direct or group challenges you were invited to' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Failed to decline challenge:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to decline challenge' },
      { status: 500 }
    )
  }
}

