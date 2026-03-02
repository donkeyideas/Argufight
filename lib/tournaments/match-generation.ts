/**
 * Tournament Match Generation Logic
 * Generates matches for a tournament round based on bracket seeding
 */

import { prisma } from '@/lib/db/prisma'
import { createKingOfTheHillRound1 } from './king-of-the-hill'

export interface TournamentParticipantData {
  id: string
  userId: string
  seed: number | null
  eloAtStart: number
  user: {
    id: string
    username: string
    eloRating: number
  }
}

/**
 * Generate matches for a tournament round
 * Uses standard bracket seeding: 1 vs 16, 2 vs 15, etc.
 */
export async function generateTournamentMatches(
  tournamentId: string,
  roundNumber: number
): Promise<void> {
  // Get tournament
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              eloRating: true,
            },
          },
        },
        orderBy: {
          seed: 'asc', // Order by seed (1, 2, 3, ...)
        },
      },
    },
  })

  if (!tournament) {
    throw new Error('Tournament not found')
  }

  // Don't create matches for completed tournaments
  if (tournament.status === 'COMPLETED') {
    console.log(`[Match Generation] Tournament ${tournamentId} is already COMPLETED - skipping match generation`)
    return
  }

  // King of the Hill format: Rounds are created by createKingOfTheHillRound() functions
  // Don't create standard 1v1 matches
  if (tournament.format === 'KING_OF_THE_HILL') {
    console.log(`[Match Generation] King of the Hill format - rounds created separately, skipping match generation`)
    return
  }

  // Filter active participants (not eliminated)
  const activeParticipants = tournament.participants.filter(
    (p) => p.status === 'REGISTERED' || p.status === 'ACTIVE'
  )

  if (activeParticipants.length < 2) {
    throw new Error('Not enough active participants to generate matches')
  }

  // Create or get tournament round
  let round = await prisma.tournamentRound.findUnique({
    where: {
      tournamentId_roundNumber: {
        tournamentId,
        roundNumber,
      },
    },
  })

  if (!round) {
    round = await prisma.tournamentRound.create({
      data: {
        tournamentId,
        roundNumber,
        status: 'UPCOMING',
        startDate: new Date(),
      },
    })
  }

  // Generate bracket matches
  // For round 1: Seed 1 vs Seed N, Seed 2 vs Seed N-1, etc.
  // For subsequent rounds: Winners face each other based on bracket position
  const matches: Array<{
    participant1Id: string
    participant2Id: string
  }> = []

  if (roundNumber === 1) {
    // First round: Different logic for Championship vs Bracket format
    if (tournament.format === 'CHAMPIONSHIP') {
      // Championship format: Pair PRO vs CON only
      const proParticipants = activeParticipants.filter((p) => p.selectedPosition === 'PRO')
      const conParticipants = activeParticipants.filter((p) => p.selectedPosition === 'CON')

      // Ensure positions are balanced
      if (proParticipants.length !== conParticipants.length) {
        throw new Error(
          `Championship format requires balanced positions. PRO: ${proParticipants.length}, CON: ${conParticipants.length}`
        )
      }

      // Shuffle or pair randomly within PRO vs CON constraint
      // For now, pair by seed order: highest PRO seed vs highest CON seed, etc.
      const sortedPro = [...proParticipants].sort((a, b) => (a.seed || 0) - (b.seed || 0))
      const sortedCon = [...conParticipants].sort((a, b) => (a.seed || 0) - (b.seed || 0))

      for (let i = 0; i < sortedPro.length; i++) {
        matches.push({
          participant1Id: sortedPro[i].id,
          participant2Id: sortedCon[i].id,
        })
      }
    } else {
      // Bracket format: Standard bracket seeding
      const numMatches = activeParticipants.length / 2
      for (let i = 0; i < numMatches; i++) {
        const participant1 = activeParticipants[i]
        const participant2 = activeParticipants[activeParticipants.length - 1 - i]
        matches.push({
          participant1Id: participant1.id,
          participant2Id: participant2.id,
        })
      }
    }
  } else {
    // Subsequent rounds: Get advancing participants from previous round
    const previousRound = await prisma.tournamentRound.findUnique({
      where: {
        tournamentId_roundNumber: {
          tournamentId,
          roundNumber: roundNumber - 1,
        },
      },
      include: {
        matches: {
          include: {
            participant1: true,
            participant2: true,
            winner: true,
          },
        },
      },
    })

    if (!previousRound) {
      throw new Error(`Previous round ${roundNumber - 1} not found`)
    }

    // For Championship format Round 2+, use advancing participants (ACTIVE status)
    // For Bracket format, use match winners
    let advancingParticipants: typeof activeParticipants = []

    if (tournament.format === 'CHAMPIONSHIP' && roundNumber === 2) {
      // Round 2: Use participants who advanced from Round 1 (ACTIVE status)
      advancingParticipants = activeParticipants.filter((p) => p.status === 'ACTIVE')
    } else {
      // Round 3+ or Bracket format: Use match winners
      const winners = previousRound.matches
        .map((m) => m.winner)
        .filter((w): w is NonNullable<typeof w> => w !== null)
        .sort((a, b) => {
          // Sort by original match order to maintain bracket structure
          const matchA = previousRound.matches.find((m) => m.winnerId === a.id)
          const matchB = previousRound.matches.find((m) => m.winnerId === b.id)
          return (matchA?.id || '').localeCompare(matchB?.id || '')
        })

      // Find participant records for winners
      advancingParticipants = winners
        .map((winner) => activeParticipants.find((p) => p.id === winner.id))
        .filter((p): p is NonNullable<typeof p> => p !== undefined)
    }

    if (advancingParticipants.length < 2) {
      throw new Error('Not enough advancing participants from previous round')
    }

    // For Championship Finals (last round), ensure opposite positions
    if (tournament.format === 'CHAMPIONSHIP' && roundNumber === tournament.totalRounds) {
      const proParticipants = advancingParticipants.filter((p) => p.selectedPosition === 'PRO')
      const conParticipants = advancingParticipants.filter((p) => p.selectedPosition === 'CON')

      if (proParticipants.length === 1 && conParticipants.length === 1) {
        // Perfect: One PRO vs One CON
        matches.push({
          participant1Id: proParticipants[0].id,
          participant2Id: conParticipants[0].id,
        })
      } else {
        // Fallback: Use bracket pairing (shouldn't happen if logic is correct)
        console.warn(
          `[Championship Finals] Expected 1 PRO and 1 CON, got ${proParticipants.length} PRO and ${conParticipants.length} CON. Using bracket pairing.`
        )
        const numMatches = Math.floor(advancingParticipants.length / 2)
        for (let i = 0; i < numMatches; i++) {
          matches.push({
            participant1Id: advancingParticipants[i * 2].id,
            participant2Id: advancingParticipants[i * 2 + 1].id,
          })
        }
      }
    } else {
      // Standard bracket pairing: 1st vs 2nd, 3rd vs 4th, etc.
      const numMatches = Math.floor(advancingParticipants.length / 2)
      for (let i = 0; i < numMatches; i++) {
        matches.push({
          participant1Id: advancingParticipants[i * 2].id,
          participant2Id: advancingParticipants[i * 2 + 1].id,
        })
      }
    }
  }

  // Create match records
  for (const match of matches) {
    await prisma.tournamentMatch.create({
      data: {
        tournamentId,
        roundId: round.id,
        participant1Id: match.participant1Id,
        participant2Id: match.participant2Id,
        status: 'SCHEDULED',
      },
    })
  }

  console.log(`Generated ${matches.length} matches for tournament ${tournamentId}, round ${roundNumber}`)
}

/**
 * Start a tournament: Generate first round matches and create debates
 */
export async function startTournament(tournamentId: string): Promise<void> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              eloRating: true,
            },
          },
        },
      },
      judge: true,
    },
  })

  if (!tournament) {
    throw new Error('Tournament not found')
  }

  if (tournament.status === 'IN_PROGRESS' || tournament.status === 'COMPLETED') {
    throw new Error('Tournament has already started or completed')
  }

  if (tournament.participants.length < 2) {
    throw new Error('Tournament needs at least 2 participants to start')
  }

  // For Championship format, check position balance
  if (tournament.format === 'CHAMPIONSHIP') {
    const proCount = tournament.participants.filter((p) => p.selectedPosition === 'PRO').length
    const conCount = tournament.participants.filter((p) => p.selectedPosition === 'CON').length
    const maxPerPosition = tournament.maxParticipants / 2

    if (proCount !== conCount || proCount !== maxPerPosition) {
      throw new Error(
        `Championship format requires balanced positions. Current: ${proCount} PRO, ${conCount} CON. Required: ${maxPerPosition} each.`
      )
    }

    if (proCount === 0 || conCount === 0) {
      throw new Error('Championship format requires at least one participant in each position (PRO and CON)')
    }
  }

  // For Championship format, assign 7 judges before starting
  let assignedJudges: string[] | null = null
  if (tournament.format === 'CHAMPIONSHIP') {
    // Get all available judges
    const allJudges = await prisma.judge.findMany({
      select: { id: true },
    })

    if (allJudges.length < 7) {
      throw new Error('Championship format requires at least 7 judges, but only ${allJudges.length} are available')
    }

    // Randomly select 7 judges
    const shuffled = [...allJudges].sort(() => Math.random() - 0.5)
    assignedJudges = shuffled.slice(0, 7).map((j) => j.id)

    // Store assigned judges in tournament
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        assignedJudges: JSON.stringify(assignedJudges),
      },
    })

    console.log(`[Championship] Assigned ${assignedJudges.length} judges: ${assignedJudges.join(', ')}`)
  }

  // Update tournament status
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      status: 'IN_PROGRESS',
      currentRound: 1,
    },
  })

  // Reseed participants based on tournament's reseed method before creating round 1 matches
  // This ensures proper bracket seeding based on ELO, tournament wins, or random
  const { reseedTournamentParticipants } = await import('./reseed')
  await reseedTournamentParticipants(tournamentId, tournament.reseedMethod)
  console.log(`[Tournament Start] Reseeded participants using ${tournament.reseedMethod} method`)

  // Generate first round matches
  // For King of the Hill, use special round creation function
  if (tournament.format === 'KING_OF_THE_HILL') {
    await createKingOfTheHillRound1(tournamentId)
    return // Don't create standard matches
  }

  // For other formats, generate standard matches
  await generateTournamentMatches(tournamentId, 1)

  // Create debates for each match
  const round = await prisma.tournamentRound.findUnique({
    where: {
      tournamentId_roundNumber: {
        tournamentId,
        roundNumber: 1,
      },
    },
    include: {
      matches: {
        include: {
          participant1: {
            include: {
              user: true,
            },
          },
          participant2: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  })

  if (!round) {
    throw new Error('Failed to create tournament round')
  }

  // Create debates for each match
  for (const match of round.matches) {
    const participant1 = match.participant1.user
    const participant2 = match.participant2.user

    // Create debate topic based on tournament name
    const debateTopic = `${tournament.name} - Round ${round.roundNumber}, Match ${match.id.slice(0, 8)}`

    // Create debate
    // Note: Judge is assigned when creating verdicts, not when creating the debate
    const debate = await prisma.debate.create({
      data: {
        topic: debateTopic,
        description: `Tournament match: ${participant1.username} vs ${participant2.username}`,
        category: 'SPORTS', // Default category, could be configurable
        challengerId: participant1.id,
        challengerPosition: 'FOR',
        opponentPosition: 'AGAINST',
        opponentId: participant2.id,
        totalRounds: 3, // Tournament matches are 3 rounds
        roundDuration: tournament.roundDuration * 3600000, // Convert hours to milliseconds
        speedMode: false,
        allowCopyPaste: true,
        status: 'ACTIVE',
        challengeType: 'DIRECT', // Explicitly set for 1v1 debates
        // judgeId is not part of Debate model - judges are assigned in Verdict model
      },
    })

    // Link debate to match
    await prisma.tournamentMatch.update({
      where: { id: match.id },
      data: {
        debateId: debate.id,
        status: 'IN_PROGRESS',
      },
    })

    console.log(`Created debate ${debate.id} for match ${match.id}`)
  }

  console.log(`Tournament ${tournamentId} started with ${round.matches.length} matches`)
}

/**
 * Advance tournament to next round
 * Updates participant statuses, generates new matches, creates debates
 */
export async function advanceToNextRound(tournamentId: string): Promise<void> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              eloRating: true,
            },
          },
        },
      },
      judge: true,
    },
  })

  if (!tournament) {
    throw new Error('Tournament not found')
  }

  if (tournament.status !== 'IN_PROGRESS') {
    throw new Error('Tournament is not in progress')
  }

  const currentRound = tournament.currentRound
  const nextRound = currentRound + 1

  if (nextRound > tournament.totalRounds) {
    throw new Error('Tournament has already reached final round')
  }

  // Get current round matches to determine winners/losers
  const currentRoundMatches = await prisma.tournamentMatch.findMany({
    where: {
      tournamentId,
      round: {
        roundNumber: currentRound,
      },
    },
    include: {
      participant1: true,
      participant2: true,
      winner: true,
    },
  })

  // Update participant statuses based on match results
  // Winners stay ACTIVE, losers become ELIMINATED
  const winnerIds = new Set<string>()
  const loserIds = new Set<string>()

  for (const match of currentRoundMatches) {
    if (match.winnerId) {
      winnerIds.add(match.winnerId)

      // Add loser to eliminated set
      const loserId = match.participant1Id === match.winnerId
        ? match.participant2Id
        : match.participant1Id
      loserIds.add(loserId)
    }
  }

  // Update eliminated participants
  if (loserIds.size > 0) {
    await prisma.tournamentParticipant.updateMany({
      where: {
        id: { in: Array.from(loserIds) },
        tournamentId,
      },
      data: {
        status: 'ELIMINATED',
      },
    })
  }

  // Update tournament to next round
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      currentRound: nextRound,
    },
  })

  // Generate matches for next round
  // For King of the Hill, use special round creation function
  if (tournament.format === 'KING_OF_THE_HILL') {
    // King of the Hill advancement is handled separately
    console.log(`[advanceToNextRound] King of the Hill format - using special advancement logic`)
    return
  }

  // For other formats, generate standard matches
  await generateTournamentMatches(tournamentId, nextRound)

  // Get the newly created round and matches
  const newRound = await prisma.tournamentRound.findUnique({
    where: {
      tournamentId_roundNumber: {
        tournamentId,
        roundNumber: nextRound,
      },
    },
    include: {
      matches: {
        include: {
          participant1: {
            include: {
              user: true,
            },
          },
          participant2: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  })

  if (!newRound) {
    throw new Error('Failed to create next tournament round')
  }

  // Create debates for each new match
  for (const match of newRound.matches) {
    const participant1 = match.participant1.user
    const participant2 = match.participant2.user

    // Create debate topic based on tournament name
    const debateTopic = `${tournament.name} - Round ${newRound.roundNumber}, Match ${match.id.slice(0, 8)}`

    // Create debate
    const debate = await prisma.debate.create({
      data: {
        topic: debateTopic,
        description: `Tournament match: ${participant1.username} vs ${participant2.username}`,
        category: 'SPORTS', // Default category, could be configurable
        challengerId: participant1.id,
        challengerPosition: 'FOR',
        opponentPosition: 'AGAINST',
        opponentId: participant2.id,
        totalRounds: 3, // Tournament matches are 3 rounds
        roundDuration: tournament.roundDuration * 3600000, // Convert hours to milliseconds
        speedMode: false,
        allowCopyPaste: true,
        status: 'ACTIVE',
        challengeType: 'DIRECT',
      },
    })

    // Link debate to match
    await prisma.tournamentMatch.update({
      where: { id: match.id },
      data: {
        debateId: debate.id,
        status: 'IN_PROGRESS',
      },
    })

    // Send notifications to both participants
    await prisma.notification.createMany({
      data: [
        {
          userId: participant1.id,
          type: 'OTHER',
          title: 'Tournament Round Advanced',
          message: `Round ${nextRound} of "${tournament.name}" has started. Your match against ${participant2.username} is now active.`,
        },
        {
          userId: participant2.id,
          type: 'OTHER',
          title: 'Tournament Round Advanced',
          message: `Round ${nextRound} of "${tournament.name}" has started. Your match against ${participant1.username} is now active.`,
        },
      ],
    })

    console.log(`Created debate ${debate.id} for round ${nextRound} match ${match.id}`)
  }

  console.log(`Tournament ${tournamentId} advanced to round ${nextRound} with ${newRound.matches.length} matches`)
}

