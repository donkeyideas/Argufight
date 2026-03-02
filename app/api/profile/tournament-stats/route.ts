import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

// GET /api/profile/tournament-stats - Get current user's tournament statistics
export async function GET() {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all tournament participations
    const participations = await prisma.tournamentParticipant.findMany({
      where: { userId },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            status: true,
            totalRounds: true,
            currentRound: true,
            endDate: true,
          },
        },
      },
    })

    // Calculate stats
    const totalTournaments = participations.length
    const completedTournaments = participations.filter(
      (p) => p.tournament.status === 'COMPLETED'
    ).length
    const activeTournaments = participations.filter(
      (p) => p.tournament.status === 'IN_PROGRESS'
    ).length

    // Get tournament wins (champion) - find tournaments where user is the only ACTIVE participant
    const championships = await prisma.tournament.findMany({
      where: {
        status: 'COMPLETED',
        participants: {
          some: {
            userId,
            status: 'ACTIVE', // Champion is still ACTIVE at the end
          },
        },
      },
      select: {
        id: true,
        name: true,
        endDate: true,
        participants: {
          where: {
            status: 'ACTIVE',
          },
          select: {
            userId: true,
          },
        },
      },
    })

    // Filter to only tournaments where this user is the ONLY active participant (champion)
    const userChampionships = championships.filter(
      (t) => t.participants.length === 1 && t.participants[0].userId === userId
    )

    // Calculate total tournament wins and losses
    const totalTournamentWins = participations.reduce((sum, p) => sum + p.wins, 0)
    const totalTournamentLosses = participations.reduce((sum, p) => sum + p.losses, 0)

    // Get best finish (highest round reached)
    const bestFinish = participations.reduce((best, p) => {
      const tournament = p.tournament
      if (tournament.status === 'COMPLETED' && p.status === 'ACTIVE') {
        return tournament.totalRounds // Champion
      }
      // Find the highest round this participant reached
      const participantMatches = participations
        .filter((part) => part.tournamentId === tournament.id)
        .flatMap((part) => [part.wins, part.losses])
      // This is a simplified calculation - in reality, we'd need to check match history
      return best
    }, 0)

    return NextResponse.json({
      stats: {
        totalTournaments,
        completedTournaments,
        activeTournaments,
        championships: userChampionships.length,
        totalTournamentWins,
        totalTournamentLosses,
        winRate:
          totalTournamentWins + totalTournamentLosses > 0
            ? Math.round(
                (totalTournamentWins / (totalTournamentWins + totalTournamentLosses)) * 100
              )
            : 0,
        bestFinish,
      },
    })
  } catch (error) {
    console.error('Failed to fetch tournament stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tournament stats' },
      { status: 500 }
    )
  }
}

