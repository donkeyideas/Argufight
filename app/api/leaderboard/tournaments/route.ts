import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// GET /api/leaderboard/tournaments - Get tournament leaderboard
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const skip = (page - 1) * limit

    // Get all users who have participated in tournaments
    const users = await prisma.user.findMany({
      where: {
        isAdmin: false,
        isBanned: false,
        tournamentParticipations: {
          some: {},
        },
      },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        tournamentParticipations: {
          include: {
            tournament: {
              select: {
                id: true,
                status: true,
                totalRounds: true,
                format: true,
              },
            },
            matches1: {
              where: {
                status: 'COMPLETED',
              },
              select: {
                participant1Score: true,
                participant2Score: true,
                winnerId: true,
              },
            },
            matches2: {
              where: {
                status: 'COMPLETED',
              },
              select: {
                participant1Score: true,
                participant2Score: true,
                winnerId: true,
              },
            },
            wonMatches: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    })

    // Calculate tournament stats for each user
    const tournamentStats = users.map((user) => {
      const participations = user.tournamentParticipations

      // Count tournaments won (champion = only ACTIVE participant in COMPLETED tournament)
      const tournamentsWon = participations.filter((p) => {
        return (
          p.tournament.status === 'COMPLETED' &&
          p.status === 'ACTIVE' &&
          // Verify this user is the only ACTIVE participant (champion)
          participations.filter(
            (other) =>
              other.tournamentId === p.tournamentId && other.status === 'ACTIVE'
          ).length === 1
        )
      }).length

      // Calculate total tournament wins and losses (from matches)
      let totalTournamentWins = 0
      let totalTournamentLosses = 0
      let totalTournamentScore = 0
      let totalTournamentMatches = 0

      for (const participation of participations) {
        // Count wins from wonMatches
        const wins = participation.wonMatches.length
        totalTournamentWins += wins

        // Count losses (matches where user participated but didn't win)
        const losses =
          participation.matches1.length +
          participation.matches2.length -
          wins
        totalTournamentLosses += losses

        // Calculate average score from matches
        for (const match of participation.matches1) {
          if (match.participant1Score !== null) {
            totalTournamentScore += match.participant1Score
            totalTournamentMatches++
          }
        }
        for (const match of participation.matches2) {
          if (match.participant2Score !== null) {
            totalTournamentScore += match.participant2Score
            totalTournamentMatches++
          }
        }
      }

      const averageTournamentScore =
        totalTournamentMatches > 0
          ? Math.round(totalTournamentScore / totalTournamentMatches)
          : 0

      const totalTournamentMatchesPlayed =
        totalTournamentWins + totalTournamentLosses
      const tournamentWinRate =
        totalTournamentMatchesPlayed > 0
          ? (totalTournamentWins / totalTournamentMatchesPlayed) * 100
          : 0

      // Calculate tournament score (weighted formula)
      // Formula: (Tournaments Won * 1000) + (Average Score * 10) + (Win Rate * 5) + (Total Wins * 10)
      const tournamentScore =
        tournamentsWon * 1000 +
        averageTournamentScore * 10 +
        tournamentWinRate * 5 +
        totalTournamentWins * 10

      return {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        tournamentsWon,
        totalTournamentWins,
        totalTournamentLosses,
        totalTournamentMatches: totalTournamentMatchesPlayed,
        tournamentWinRate: Math.round(tournamentWinRate * 10) / 10, // Round to 1 decimal
        averageTournamentScore,
        tournamentScore,
      }
    })

    // Sort by tournament score (descending)
    tournamentStats.sort((a, b) => b.tournamentScore - a.tournamentScore)

    // Get total count
    const total = tournamentStats.length

    // Apply pagination
    const paginatedStats = tournamentStats.slice(skip, skip + limit)

    // Add rank
    const leaderboardWithRank = paginatedStats.map((stat, index) => ({
      rank: skip + index + 1,
      ...stat,
    }))

    return NextResponse.json({
      leaderboard: leaderboardWithRank,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Failed to fetch tournament leaderboard:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tournament leaderboard' },
      { status: 500 }
    )
  }
}

