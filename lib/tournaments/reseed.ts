/**
 * Tournament Reseeding Logic
 * Reseeds participants between rounds based on specified method
 */

import { prisma } from '@/lib/db/prisma'

export type ReseedMethod = 'ELO_BASED' | 'TOURNAMENT_WINS' | 'RANDOM'

/**
 * Reseed tournament participants based on the specified method
 */
export async function reseedTournamentParticipants(
  tournamentId: string,
  method: ReseedMethod
): Promise<void> {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                eloRating: true,
              },
            },
          },
          where: {
            status: {
              in: ['REGISTERED', 'ACTIVE'],
            },
          },
        },
      },
    })

    if (!tournament) {
      throw new Error(`Tournament ${tournamentId} not found`)
    }

    // Get active participants (not eliminated)
    const activeParticipants = tournament.participants.filter(
      (p) => p.status === 'REGISTERED' || p.status === 'ACTIVE'
    )

    if (activeParticipants.length === 0) {
      console.log(`[Tournament Reseed] No active participants to reseed`)
      return
    }

    let sortedParticipants: typeof activeParticipants

    switch (method) {
      case 'ELO_BASED':
        // Sort by current ELO (highest first)
        sortedParticipants = [...activeParticipants].sort((a, b) => {
          return b.user.eloRating - a.user.eloRating
        })
        break

      case 'TOURNAMENT_WINS':
        // Sort by tournament wins (most wins first), then by ELO
        sortedParticipants = [...activeParticipants].sort((a, b) => {
          if (b.wins !== a.wins) {
            return b.wins - a.wins
          }
          return b.user.eloRating - a.user.eloRating
        })
        break

      case 'RANDOM':
        // Random shuffle
        sortedParticipants = [...activeParticipants].sort(() => Math.random() - 0.5)
        break

      default:
        console.warn(`[Tournament Reseed] Unknown reseed method: ${method}, using ELO_BASED`)
        sortedParticipants = [...activeParticipants].sort((a, b) => {
          return b.user.eloRating - a.user.eloRating
        })
    }

    // Update seeds (1-indexed)
    await Promise.all(
      sortedParticipants.map((participant, index) => {
        const newSeed = index + 1
        return prisma.tournamentParticipant.update({
          where: { id: participant.id },
          data: {
            seed: newSeed,
            currentSeed: newSeed,
          },
        })
      })
    )

    console.log(
      `[Tournament Reseed] Reseeded ${sortedParticipants.length} participants using ${method} method`
    )
  } catch (error: any) {
    console.error(`[Tournament Reseed] Error reseeding tournament ${tournamentId}:`, error)
    throw error
  }
}

