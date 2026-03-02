/**
 * Tournament Match Completion Logic
 * Handles updating tournament matches when debates complete
 */

import { prisma } from '@/lib/db/prisma'
import { checkAndAdvanceTournamentRound } from './round-advancement'
import { processKingOfTheHillDebateCompletion } from './king-of-the-hill'

/**
 * Update tournament match when linked debate completes
 * Called after verdict is generated and debate status is VERDICT_READY
 */
export async function updateTournamentMatchOnDebateComplete(debateId: string): Promise<void> {
  try {
    // Find the tournament match linked to this debate
    const match = await prisma.tournamentMatch.findUnique({
      where: { debateId },
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
        round: {
          include: {
            tournament: true,
          },
        },
        debate: {
          select: {
            id: true,
            winnerId: true,
            challengerId: true,
            opponentId: true,
            status: true,
            challengeType: true, // Needed to detect King of the Hill finals
          },
        },
      },
    })

    if (!match) {
      // Not a tournament debate, nothing to do
      return
    }

    // King of the Hill format: Use special completion logic
    if (match.round.tournament.format === 'KING_OF_THE_HILL') {
      // For King of the Hill, check if debate is VERDICT_READY (verdicts generated and elimination processed)
      if (!match.debate || match.debate.status !== 'VERDICT_READY') {
        console.log(
          `[Tournament Match] King of the Hill debate ${debateId} not ready (status: ${match.debate?.status})`
        )
        return
      }

      // Process King of the Hill completion (this will advance to next round if needed)
      await processKingOfTheHillDebateCompletion(debateId)
      return
    }

    // Use standard logic for Bracket and Championship formats
    // Check if debate has a winner
    // Note: DebateStatus enum doesn't have FORFEITED or CANCELLED
    // Forfeits are handled by checking if debate is COMPLETED but has no winner
    // or if we need to handle timeouts differently
    // Accept both VERDICT_READY and COMPLETED statuses (debate can be COMPLETED after verdict)
    const hasWinner = match.debate?.winnerId && 
      (match.debate?.status === 'VERDICT_READY' || match.debate?.status === 'COMPLETED')

    if (!match.debate || !hasWinner) {
      console.log(`[Tournament Match] Debate ${debateId} not ready for match completion (status: ${match.debate?.status}, winner: ${match.debate?.winnerId})`)
      return
    }

    // Note: Forfeit handling is not needed here
    // If a debate times out or is cancelled, the process-expired endpoint will handle it
    // and set a winner before this function is called
    // We only process debates with VERDICT_READY status and a winner

    // For Championship format, extract scores from verdicts
    let participant1Score: number | null = null
    let participant2Score: number | null = null
    let participant1ScoreBreakdown: Record<string, number> | null = null
    let participant2ScoreBreakdown: Record<string, number> | null = null

    if (match.round.tournament.format === 'CHAMPIONSHIP') {
      // Get all verdicts for this debate
      const verdicts = await prisma.verdict.findMany({
        where: { debateId },
        select: {
          id: true,
          judgeId: true,
          challengerScore: true,
          opponentScore: true,
        },
      })

      if (verdicts.length > 0) {
        // Determine which participant is challenger and which is opponent
        const isParticipant1Challenger = match.participant1.userId === match.debate.challengerId
        const isParticipant2Challenger = match.participant2.userId === match.debate.challengerId

        // Extract scores and build breakdown
        const p1Scores: number[] = []
        const p2Scores: number[] = []
        const p1Breakdown: Record<string, number> = {}
        const p2Breakdown: Record<string, number> = {}

        for (const verdict of verdicts) {
          if (isParticipant1Challenger) {
            // Participant 1 is challenger
            if (verdict.challengerScore !== null) {
              p1Scores.push(verdict.challengerScore)
              if (verdict.judgeId) {
                p1Breakdown[verdict.judgeId] = verdict.challengerScore
              }
            }
            if (verdict.opponentScore !== null) {
              p2Scores.push(verdict.opponentScore)
              if (verdict.judgeId) {
                p2Breakdown[verdict.judgeId] = verdict.opponentScore
              }
            }
          } else if (isParticipant2Challenger) {
            // Participant 2 is challenger
            if (verdict.challengerScore !== null) {
              p2Scores.push(verdict.challengerScore)
              if (verdict.judgeId) {
                p2Breakdown[verdict.judgeId] = verdict.challengerScore
              }
            }
            if (verdict.opponentScore !== null) {
              p1Scores.push(verdict.opponentScore)
              if (verdict.judgeId) {
                p1Breakdown[verdict.judgeId] = verdict.opponentScore
              }
            }
          }
        }

        // Calculate averages (0-100 scale)
        if (p1Scores.length > 0) {
          participant1Score = Math.round(p1Scores.reduce((a, b) => a + b, 0) / p1Scores.length)
        }
        if (p2Scores.length > 0) {
          participant2Score = Math.round(p2Scores.reduce((a, b) => a + b, 0) / p2Scores.length)
        }

        participant1ScoreBreakdown = Object.keys(p1Breakdown).length > 0 ? p1Breakdown : null
        participant2ScoreBreakdown = Object.keys(p2Breakdown).length > 0 ? p2Breakdown : null

        console.log(
          `[Championship] Extracted scores for match ${match.id}: P1=${participant1Score}, P2=${participant2Score}`
        )
      }
    }

    // Determine which participant won
    let winningParticipantId: string | null = null
    let losingParticipantId: string | null = null

    if (match.debate.winnerId === match.debate.challengerId) {
      // Challenger won - check if they're participant1 or participant2
      if (match.participant1.userId === match.debate.challengerId) {
        winningParticipantId = match.participant1Id
        losingParticipantId = match.participant2Id
      } else if (match.participant2.userId === match.debate.challengerId) {
        winningParticipantId = match.participant2Id
        losingParticipantId = match.participant1Id
      }
    } else if (match.debate.winnerId === match.debate.opponentId) {
      // Opponent won
      if (match.participant1.userId === match.debate.opponentId) {
        winningParticipantId = match.participant1Id
        losingParticipantId = match.participant2Id
      } else if (match.participant2.userId === match.debate.opponentId) {
        winningParticipantId = match.participant2Id
        losingParticipantId = match.participant1Id
      }
    }

    if (!winningParticipantId || !losingParticipantId) {
      console.error(`[Tournament Match] Could not determine winner for match ${match.id}`)
      return
    }

    // Update match
    await prisma.tournamentMatch.update({
      where: { id: match.id },
      data: {
        winnerId: winningParticipantId,
        status: 'COMPLETED',
        completedAt: new Date(),
        // Store scores for Championship format
        participant1Score: participant1Score,
        participant2Score: participant2Score,
        participant1ScoreBreakdown: participant1ScoreBreakdown || undefined,
        participant2ScoreBreakdown: participant2ScoreBreakdown || undefined,
      },
    })

    // Update participant stats
    await Promise.all([
      // Winner
      prisma.tournamentParticipant.update({
        where: { id: winningParticipantId },
        data: {
          wins: { increment: 1 },
          status: 'ACTIVE',
        },
      }),
      // Loser
      prisma.tournamentParticipant.update({
        where: { id: losingParticipantId },
        data: {
          losses: { increment: 1 },
          status: 'ELIMINATED',
          eliminatedAt: new Date(),
          // For King of the Hill finals, set eliminationRound
          ...((match.round.tournament.format as string) === 'KING_OF_THE_HILL' && {
            eliminationRound: match.round.roundNumber,
            eliminationReason: 'Eliminated in finals - lost to champion',
          }),
        },
      }),
    ])

    console.log(`[Tournament Match] Match ${match.id} completed. Winner: ${winningParticipantId}, Loser: ${losingParticipantId}`)


    // Check if round is complete and advance if needed
    await checkAndAdvanceTournamentRound(match.round.tournamentId, match.round.roundNumber)
  } catch (error: any) {
    console.error(`[Tournament Match] Error updating match for debate ${debateId}:`, error)
    // Don't throw - we don't want to break verdict generation if tournament update fails
  }
}

