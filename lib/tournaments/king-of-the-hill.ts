/**
 * King of the Hill Tournament Round Creation
 * Handles creating GROUP debates for elimination rounds and ONE_ON_ONE for finals
 */

import { prisma } from '@/lib/db/prisma'
import { generateKingOfTheHillRoundVerdicts } from './king-of-the-hill-ai'

/**
 * Create Round 1 for King of the Hill tournament
 * All registered participants debate simultaneously in a GROUP debate
 */
export async function createKingOfTheHillRound1(tournamentId: string): Promise<void> {
  // Get tournament with all participants
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
          seed: 'asc', // Order by seed
        },
      },
    },
  })

  if (!tournament) {
    throw new Error('Tournament not found')
  }

  // Get all registered/active participants (for Round 1, all should be REGISTERED)
  const participants = tournament.participants.filter(
    (p) => p.status === 'REGISTERED' || p.status === 'ACTIVE'
  )

  if (participants.length < 3) {
    throw new Error('King of the Hill requires at least 3 participants')
  }

  // Create tournament round
  const round = await prisma.tournamentRound.create({
    data: {
      tournamentId,
      roundNumber: 1,
      status: 'UPCOMING',
      startDate: new Date(),
    },
  })

  // Create GROUP debate with all participants
  const debate = await prisma.debate.create({
    data: {
      topic: tournament.name, // Tournament name as topic
      description: `King of the Hill Tournament - Round 1: ${participants.length} participants`,
      category: 'SPORTS', // Default category
      challengerId: participants[0].userId, // First participant as challenger (required field)
      challengerPosition: 'FOR', // Required field, but not used for GROUP debates
      opponentPosition: 'AGAINST', // Required field, but not used for GROUP debates
      opponentId: participants[1]?.userId || participants[0].userId, // Second participant or fallback
      totalRounds: 1, // Single submission per participant
      currentRound: 1,
      roundDuration: tournament.roundDuration, // Already in milliseconds
      speedMode: false,
      allowCopyPaste: true,
      status: 'ACTIVE',
      challengeType: 'GROUP', // Critical: GROUP challenge type
      startedAt: new Date(), // Mark as started
    },
  })

  // Create DebateParticipant records for all participants
  // King of the Hill is an open debate - no FOR/AGAINST positions
  // Position field is required in schema, but we'll hide it in the UI
  for (let i = 0; i < participants.length; i++) {
    await prisma.debateParticipant.create({
      data: {
        debateId: debate.id,
        userId: participants[i].userId,
        position: 'FOR', // Required field, but not displayed/used for King of the Hill GROUP debates
        status: 'ACTIVE', // All participants are active
        joinedAt: new Date(),
      },
    })
  }

  // Create TournamentMatch record to link debate to round
  // For GROUP debates, we use the first two participants as placeholders
  // The actual participants are tracked via DebateParticipant
  const match = await prisma.tournamentMatch.create({
    data: {
      tournamentId,
      roundId: round.id,
      participant1Id: participants[0].id,
      participant2Id: participants[1]?.id || participants[0].id, // Use second or fallback
      debateId: debate.id,
      status: 'IN_PROGRESS',
    },
  })

  // Update tournament status and current round
  // For King of the Hill, totalRounds will be updated dynamically as rounds are created
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      status: 'IN_PROGRESS',
      currentRound: 1,
      totalRounds: 1, // Will be updated as more rounds are created
    },
  })

  console.log(
    `[King of the Hill] Created Round 1: Debate ${debate.id} with ${participants.length} participants`
  )
}

/**
 * Create subsequent elimination rounds for King of the Hill tournament
 * Only ACTIVE participants (survivors) participate
 */
export async function createKingOfTheHillRound(
  tournamentId: string,
  roundNumber: number
): Promise<void> {
  // Get tournament with participants
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
    },
  })

  if (!tournament) {
    throw new Error('Tournament not found')
  }

  // Get only ACTIVE participants (survivors from previous rounds)
  const participants = tournament.participants.filter((p) => p.status === 'ACTIVE')

  if (participants.length < 2) {
    throw new Error(
      `Not enough active participants for round ${roundNumber}. Expected at least 2, got ${participants.length}`
    )
  }

  // If exactly 2 participants, create finals instead
  if (participants.length === 2) {
    await createKingOfTheHillFinals(tournamentId, roundNumber, participants)
    return
  }

  // Create tournament round
  const round = await prisma.tournamentRound.create({
    data: {
      tournamentId,
      roundNumber,
      status: 'UPCOMING',
      startDate: new Date(),
    },
  })

  // Create GROUP debate with all active participants
  const debate = await prisma.debate.create({
    data: {
      topic: tournament.name, // Tournament name as topic
      description: `King of the Hill Tournament - Round ${roundNumber}: ${participants.length} participants`,
      category: 'SPORTS',
      challengerId: participants[0].userId,
      challengerPosition: 'FOR', // Required field, but not used for GROUP debates
      opponentPosition: 'AGAINST', // Required field, but not used for GROUP debates
      opponentId: participants[1]?.userId || participants[0].userId,
      totalRounds: 1, // Single submission per participant
      currentRound: 1,
      roundDuration: tournament.roundDuration, // Already in milliseconds
      speedMode: false,
      allowCopyPaste: true,
      status: 'ACTIVE',
      challengeType: 'GROUP', // Critical: GROUP challenge type
      startedAt: new Date(),
    },
  })

  // Create DebateParticipant records for all active participants
  // King of the Hill is an open debate - no FOR/AGAINST positions
  // Position field is required in schema, but we'll hide it in the UI
  for (let i = 0; i < participants.length; i++) {
    await prisma.debateParticipant.create({
      data: {
        debateId: debate.id,
        userId: participants[i].userId,
        position: 'FOR', // Required field, but not displayed/used for King of the Hill GROUP debates
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    })
  }

  // Create TournamentMatch record
  const match = await prisma.tournamentMatch.create({
    data: {
      tournamentId,
      roundId: round.id,
      participant1Id: participants[0].id,
      participant2Id: participants[1]?.id || participants[0].id,
      debateId: debate.id,
      status: 'IN_PROGRESS',
    },
  })

  // Update tournament current round and totalRounds
  // For King of the Hill, totalRounds should match the highest round number created
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      currentRound: roundNumber,
      totalRounds: roundNumber, // Update totalRounds to match actual rounds created
    },
  })

  console.log(
    `[King of the Hill] Created Round ${roundNumber}: Debate ${debate.id} with ${participants.length} participants`
  )
}

/**
 * Create finals for King of the Hill tournament
 * Finals is a traditional 3-round ONE_ON_ONE debate between the last 2 participants
 */
export async function createKingOfTheHillFinals(
  tournamentId: string,
  roundNumber: number,
  participants: Array<{
    id: string
    userId: string
    user: {
      id: string
      username: string
      eloRating: number
    }
  }>
): Promise<void> {
  if (participants.length !== 2) {
    throw new Error(`Finals requires exactly 2 participants, got ${participants.length}`)
  }

  // Get tournament
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  })

  if (!tournament) {
    throw new Error('Tournament not found')
  }

  // Create tournament round
  const round = await prisma.tournamentRound.create({
    data: {
      tournamentId,
      roundNumber,
      status: 'UPCOMING',
      startDate: new Date(),
    },
  })

  // Create ONE_ON_ONE debate (traditional 3-round debate)
  const debate = await prisma.debate.create({
    data: {
      topic: tournament.name, // Tournament name as topic
      description: `King of the Hill Tournament - Finals: ${participants[0].user.username} vs ${participants[1].user.username}`,
      category: 'SPORTS',
      challengerId: participants[0].userId,
      challengerPosition: 'FOR',
      opponentPosition: 'AGAINST',
      opponentId: participants[1].userId,
      totalRounds: 3, // Traditional 3-round debate for finals
      currentRound: 1,
      roundDuration: tournament.roundDuration, // Already in milliseconds
      speedMode: false,
      allowCopyPaste: true,
      status: 'ACTIVE',
      challengeType: 'ONE_ON_ONE', // Finals use ONE_ON_ONE, not GROUP
      startedAt: new Date(), // Critical: Frontend needs this to recognize debate has started
    },
  })

  // Create DebateParticipant records for both participants
  await prisma.debateParticipant.create({
    data: {
      debateId: debate.id,
      userId: participants[0].userId,
      position: 'FOR',
      status: 'ACTIVE',
      joinedAt: new Date(),
    },
  })

  await prisma.debateParticipant.create({
    data: {
      debateId: debate.id,
      userId: participants[1].userId,
      position: 'AGAINST',
      status: 'ACTIVE',
      joinedAt: new Date(),
    },
  })

  // Create TournamentMatch record
  const match = await prisma.tournamentMatch.create({
    data: {
      tournamentId,
      roundId: round.id,
      participant1Id: participants[0].id,
      participant2Id: participants[1].id,
      debateId: debate.id,
      status: 'IN_PROGRESS',
    },
  })

  // Update tournament current round and totalRounds
  // Finals is the last round, so totalRounds should equal roundNumber
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      currentRound: roundNumber,
      totalRounds: roundNumber, // Finals is the final round, so totalRounds = roundNumber
    },
  })

  console.log(
    `[King of the Hill] Created Finals (Round ${roundNumber}): Debate ${debate.id} - ${participants[0].user.username} vs ${participants[1].user.username}`
  )
}

/**
 * Process King of the Hill debate completion
 * Generates verdicts, eliminates bottom 25%, and advances to next round or finals
 */
export async function processKingOfTheHillDebateCompletion(debateId: string): Promise<void> {
  try {
    console.log(`[King of the Hill] Processing debate completion for debate ${debateId}`)

    // Get debate with tournament info
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      include: {
        tournamentMatch: {
          include: {
            round: {
              include: {
                tournament: {
                  select: {
                    id: true,
                    format: true,
                    currentRound: true,
                    totalRounds: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!debate) {
      throw new Error('Debate not found')
    }

    const match = debate.tournamentMatch
    if (!match) {
      throw new Error('Tournament match not found for debate')
    }

    const tournament = match.round.tournament
    if (tournament.format !== 'KING_OF_THE_HILL') {
      throw new Error('This function is only for King of the Hill tournaments')
    }

    const roundNumber = match.round.roundNumber

    // Check if this is finals (ONE_ON_ONE debate)
    const isFinals = debate.challengeType === 'ONE_ON_ONE' && debate.totalRounds === 3

    if (isFinals) {
      // Finals: Use standard verdict system, then complete tournament
      console.log(`[King of the Hill] Finals debate completed - checking if ready for tournament completion`)
      
      // Check if debate has a winner (standard 1v1 verdict system)
      if (debate.status === 'VERDICT_READY') {
        // If no winnerId but verdicts exist, check for tie-breaker
        if (!debate.winnerId) {
          // Check verdicts to determine winner from scores
          const verdicts = await prisma.verdict.findMany({
            where: { debateId },
            select: {
              challengerScore: true,
              opponentScore: true,
              decision: true,
            },
          })

          if (verdicts.length > 0) {
            // Calculate total scores
            const challengerTotal = verdicts.reduce((sum, v) => sum + (v.challengerScore || 0), 0)
            const opponentTotal = verdicts.reduce((sum, v) => sum + (v.opponentScore || 0), 0)

            // Determine winner based on total scores
            let winnerId: string | null = null
            if (challengerTotal > opponentTotal) {
              winnerId = debate.challengerId
            } else if (opponentTotal > challengerTotal) {
              winnerId = debate.opponentId
            } else {
              // True tie - use first participant as winner (or could be random)
              winnerId = debate.challengerId
              console.log(`[King of the Hill] Finals ended in tie - using challenger as winner`)
            }

            // Update debate with winner
            if (winnerId) {
              await prisma.debate.update({
                where: { id: debateId },
                data: { winnerId },
              })
              console.log(`[King of the Hill] Finals winner determined: ${winnerId}`)
            }
          }
        }

        // Now complete tournament if we have a winner
        const updatedDebate = await prisma.debate.findUnique({
          where: { id: debateId },
          select: { winnerId: true },
        })

        if (updatedDebate?.winnerId) {
          // Mark the loser as eliminated
          const loserId = updatedDebate.winnerId === debate.challengerId 
            ? debate.opponentId 
            : debate.challengerId
          
          if (loserId) {
            // Find the tournament participant for the loser
            const loserParticipant = await prisma.tournamentParticipant.findFirst({
              where: {
                tournamentId: tournament.id,
                userId: loserId,
              },
            })
            
            if (loserParticipant) {
              await prisma.tournamentParticipant.update({
                where: { id: loserParticipant.id },
                data: {
                  status: 'ELIMINATED',
                  eliminatedAt: new Date(),
                  eliminationRound: roundNumber, // Mark as eliminated in finals round
                  eliminationReason: 'Eliminated in finals - lost to champion',
                },
              })
              console.log(`[King of the Hill] Marked loser as eliminated in round ${roundNumber}`)
            }
          }
          
          // Update match status to COMPLETED
          await prisma.tournamentMatch.update({
            where: { id: match.id },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
            },
          })
          
          // Finals complete - complete tournament
          console.log(`[King of the Hill] Finals complete - completing tournament`)
          const { completeTournament } = await import('./tournament-completion')
          await completeTournament(tournament.id)
          
          // Update round status
          await prisma.tournamentRound.update({
            where: { id: match.round.id },
            data: {
              status: 'COMPLETED',
              endDate: new Date(),
            },
          })
          return
        } else {
          console.log(`[King of the Hill] Finals still no winner after tie-breaker check`)
          return
        }
      } else {
        // Finals not ready yet
        console.log(`[King of the Hill] Finals not ready yet (status: ${debate.status})`)
        return
      }
    }

    // Elimination round: Use King of the Hill verdict system
    // Check if verdicts already exist
    const existingVerdicts = await prisma.verdict.count({
      where: { debateId },
    })

    if (existingVerdicts === 0) {
      // Generate verdicts if not already generated
      console.log(`[King of the Hill] Generating verdicts for round ${roundNumber}`)
      await generateKingOfTheHillRoundVerdicts(debateId, tournament.id, roundNumber)
    } else {
      console.log(`[King of the Hill] Verdicts already exist for round ${roundNumber}`)
    }

    // Get active participants after elimination
    const activeParticipants = await prisma.tournamentParticipant.findMany({
      where: {
        tournamentId: tournament.id,
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            eloRating: true,
          },
        },
      },
    })

    console.log(
      `[King of the Hill] After round ${roundNumber}: ${activeParticipants.length} active participants remaining`
    )

    // Check if tournament should advance
    if (activeParticipants.length === 2) {
      // Finals: Create 1v1 debate
      console.log(`[King of the Hill] 2 participants remaining - creating finals`)
      const nextRoundNumber = roundNumber + 1
      await createKingOfTheHillFinals(tournament.id, nextRoundNumber, activeParticipants)
    } else if (activeParticipants.length > 2) {
      // Next elimination round: Create GROUP debate
      console.log(
        `[King of the Hill] ${activeParticipants.length} participants remaining - creating next elimination round`
      )
      const nextRoundNumber = roundNumber + 1
      await createKingOfTheHillRound(tournament.id, nextRoundNumber)
    } else if (activeParticipants.length === 1) {
      // Only 1 participant left - tournament complete (shouldn't happen, but handle it)
      console.log(`[King of the Hill] Only 1 participant remaining - completing tournament`)
      const { completeTournament } = await import('./tournament-completion')
      await completeTournament(tournament.id)
    } else if (activeParticipants.length < 1) {
      // Error: No participants
      console.error(
        `[King of the Hill] ERROR: No participants remaining (${activeParticipants.length})`
      )
      // Complete tournament anyway
      await prisma.tournament.update({
        where: { id: tournament.id },
        data: {
          status: 'COMPLETED',
          endDate: new Date(),
        },
      })
    }

    // Update round status to COMPLETED
    await prisma.tournamentRound.update({
      where: { id: match.round.id },
      data: {
        status: 'COMPLETED',
        endDate: new Date(),
      },
    })

    console.log(`[King of the Hill] ✅ Round ${roundNumber} processed and advanced`)
  } catch (error: any) {
    console.error('[King of the Hill] Error processing debate completion:', error)
    throw error
  }
}
