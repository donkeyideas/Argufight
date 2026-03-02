import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { decrementFeatureUsage, recordFeatureUsage } from '@/lib/subscriptions/subscription-utils'
import { FEATURES } from '@/lib/subscriptions/features'

// GET /api/tournaments/[id] - Get tournament details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    const { id: tournamentId } = await params

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            eloRating: true,
          },
        },
        judge: {
          select: {
            id: true,
            name: true,
            emoji: true,
            personality: true,
          },
        },
        participants: {
          select: {
            id: true,
            userId: true,
            seed: true,
            status: true,
            selectedPosition: true,
            eliminationRound: true,
            eliminationReason: true,
            cumulativeScore: true,
            wins: true,
            losses: true,
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                eloRating: true,
              },
            },
          },
          orderBy: {
            seed: 'asc',
          },
        },
        matches: {
          include: {
            debate: {
              select: {
                id: true,
                topic: true,
                status: true,
                winnerId: true,
                challengeType: true,
                challenger: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
                opponent: {
                  select: {
                    id: true,
                    username: true,
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
            },
            round: {
              select: {
                roundNumber: true,
              },
            },
          },
          orderBy: [
            { round: { roundNumber: 'asc' } },
          ],
        },
        rounds: {
          orderBy: {
            roundNumber: 'asc',
          },
        },
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    // Check if tournament is private and user has access
    if (tournament.isPrivate) {
      if (tournament.creatorId !== userId) {
        // User is not the creator, check if they're invited
        if (!tournament.invitedUserIds) {
          return NextResponse.json(
            { error: 'This is a private tournament and you are not invited' },
            { status: 403 }
          )
        }

        let invitedIds: string[]
        try {
          invitedIds = JSON.parse(tournament.invitedUserIds) as string[]
        } catch (error) {
          console.error('Failed to parse invitedUserIds:', tournament.invitedUserIds, error)
          return NextResponse.json(
            { error: 'Invalid tournament invitation data' },
            { status: 500 }
          )
        }

        if (!Array.isArray(invitedIds) || !invitedIds.includes(userId || '')) {
          return NextResponse.json(
            { error: 'This is a private tournament and you are not invited' },
            { status: 403 }
          )
        }
      }
    }

    // Check if user is participant
    const isParticipant = userId
      ? tournament.participants.some((p) => p.userId === userId)
      : false

    // Check if user is creator
    const isCreator = userId === tournament.creatorId

    return NextResponse.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        description: tournament.description,
        status: tournament.status,
        maxParticipants: tournament.maxParticipants,
        currentRound: tournament.currentRound,
        totalRounds: tournament.totalRounds,
        startDate: tournament.startDate,
        endDate: tournament.endDate,
        minElo: tournament.minElo,
        roundDuration: tournament.roundDuration,
        reseedAfterRound: tournament.reseedAfterRound,
        reseedMethod: tournament.reseedMethod,
        creator: tournament.creator,
        judge: tournament.judge,
        participants: tournament.participants.map((p) => ({
          id: p.id,
          userId: p.userId,
          seed: p.seed,
          status: p.status,
          selectedPosition: p.selectedPosition,
          eliminationRound: p.eliminationRound,
          eliminationReason: p.eliminationReason,
          cumulativeScore: p.cumulativeScore,
          wins: p.wins,
          losses: p.losses,
          user: p.user,
        })),
        matches: tournament.matches.map((m, index, allMatches) => {
          const roundNumber = m.round?.roundNumber || 0
          // Calculate matchNumber within the round (1-indexed)
          const matchesInRound = allMatches.filter(
            (match) => (match.round?.roundNumber || 0) === roundNumber
          )
          const matchNumber = matchesInRound.findIndex((match) => match.id === m.id) + 1
          
          return {
            id: m.id,
            round: roundNumber,
            matchNumber,
            participant1Id: m.participant1Id,
            participant2Id: m.participant2Id,
            winnerId: m.winnerId,
            status: m.status,
            participant1Score: m.participant1Score,
            participant2Score: m.participant2Score,
            participant1ScoreBreakdown: m.participant1ScoreBreakdown,
            participant2ScoreBreakdown: m.participant2ScoreBreakdown,
            debate: m.debate ? {
              ...m.debate,
              participants: m.debate.participants?.map((p: any) => ({
                id: p.id,
                userId: p.userId,
                position: p.position,
                status: p.status,
                user: p.user,
              })) || [],
            } : null,
          }
        }),
        rounds: tournament.rounds,
        isParticipant,
        isCreator,
        isPrivate: tournament.isPrivate,
        format: tournament.format,
        assignedJudges: tournament.assignedJudges ? JSON.parse(tournament.assignedJudges) : null,
        createdAt: tournament.createdAt,
      },
    })
  } catch (error: any) {
    console.error('Failed to fetch tournament:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tournament' },
      { status: 500 }
    )
  }
}

// DELETE /api/tournaments/[id] - Delete a tournament (creator only)
export async function DELETE(
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

    // Get tournament to verify ownership
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        creatorId: true,
        status: true,
        name: true,
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    // Only creator can delete
    if (tournament.creatorId !== userId) {
      return NextResponse.json(
        { error: 'Only the tournament creator can delete it' },
        { status: 403 }
      )
    }

    // Only allow deletion if tournament hasn't started (UPCOMING status)
    if (tournament.status !== 'UPCOMING') {
      return NextResponse.json(
        { error: 'Can only delete tournaments that have not started yet' },
        { status: 400 }
      )
    }

    // If tournament is UPCOMING, decrement usage (it shouldn't have counted yet, but check just in case)
    // This ensures that if usage was recorded when status changed, we refund it
    await decrementFeatureUsage(userId, FEATURES.TOURNAMENTS)

    // Delete tournament (cascade will handle related records)
    await prisma.tournament.delete({
      where: { id: tournamentId },
    })

    console.log(`Tournament "${tournament.name}" (${tournamentId}) deleted by creator ${userId} - usage decremented`)

    return NextResponse.json({ success: true, message: 'Tournament deleted successfully' })
  } catch (error: any) {
    console.error('Failed to delete tournament:', error)
    return NextResponse.json(
      { error: 'Failed to delete tournament' },
      { status: 500 }
    )
  }
}

