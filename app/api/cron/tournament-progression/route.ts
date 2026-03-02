/**
 * Cron Job: Tournament Round Progression
 * Runs every 30 minutes to advance tournaments to next round when all matches complete
 *
 * Schedule: Every 30 minutes (cron: 0,30 * * * *)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { advanceToNextRound } from '@/lib/tournaments/match-generation'
import { verifyCronAuth } from '@/lib/auth/cron-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  console.log('[Tournament Progression] ========== Starting tournament progression cron ==========')

  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    let advancedCount = 0
    let completedCount = 0
    const errors: string[] = []

    // Find active tournaments
    const activeTournaments = await prisma.tournament.findMany({
      where: {
        status: 'IN_PROGRESS',
      },
    })

    console.log(`[Tournament Progression] Found ${activeTournaments.length} active tournaments`)

    for (const tournament of activeTournaments) {
      try {
        // Get matches for current round
        const currentRoundMatches = await prisma.tournamentMatch.findMany({
          where: {
            tournamentId: tournament.id,
            round: {
              roundNumber: tournament.currentRound,
            },
          },
          include: {
            debate: true,
          },
        })

        if (currentRoundMatches.length === 0) {
          console.log(`[Tournament Progression] Tournament ${tournament.id} "${tournament.name}" has no matches in current round`)
          continue
        }

        // Check if all matches in current round are complete
        const allMatchesComplete = currentRoundMatches.every(match => {
          // Match is complete if:
          // 1. It has a winner (winnerId is set), OR
          // 2. The debate is completed
          return match.winnerId !== null || (match.debate && match.debate.status === 'COMPLETED')
        })

        if (!allMatchesComplete) {
          const completedMatches = currentRoundMatches.filter(m => m.winnerId !== null).length
          console.log(
            `[Tournament Progression] Tournament ${tournament.id} "${tournament.name}" round ${tournament.currentRound}: ` +
            `${completedMatches}/${currentRoundMatches.length} matches complete`
          )
          continue
        }

        // All matches complete - check if tournament is done or advance to next round
        if (tournament.currentRound >= tournament.totalRounds) {
          // Tournament complete - find final winner
          const finalMatch = currentRoundMatches[0] // Should only be 1 match in final round
          if (finalMatch && finalMatch.winnerId) {
            await prisma.tournament.update({
              where: { id: tournament.id },
              data: {
                status: 'COMPLETED',
                winnerId: finalMatch.winnerId,
                endDate: new Date(),
              },
            })

            // Send notification to winner
            await prisma.notification.create({
              data: {
                userId: finalMatch.winnerId,
                type: 'OTHER',
                title: 'Tournament Victory!',
                message: `Congratulations! You won the tournament "${tournament.name}"! (Tournament ID: ${tournament.id})`,
              },
            })

            // Distribute tournament prizes (if prize pool exists)
            try {
              const { distributeTournamentPrizes } = await import('@/lib/tournaments/prizes')
              await distributeTournamentPrizes(tournament.id)
              console.log(`[Tournament Progression] ✅ Prizes distributed for tournament "${tournament.name}"`)
            } catch (prizeError: any) {
              console.error(`[Tournament Progression] Failed to distribute prizes: ${prizeError.message}`)
              // Don't fail the entire process if prize distribution fails
            }

            completedCount++
            console.log(`[Tournament Progression] ✅ Tournament ${tournament.id} "${tournament.name}" completed. Winner: ${finalMatch.winnerId}`)
          }
        } else {
          // Advance to next round
          await advanceToNextRound(tournament.id)

          advancedCount++
          console.log(`[Tournament Progression] ✅ Tournament ${tournament.id} "${tournament.name}" advanced to round ${tournament.currentRound + 1}`)
        }
      } catch (error: any) {
        const errorMsg = `Failed to process tournament ${tournament.id} "${tournament.name}": ${error.message}`
        console.error(`[Tournament Progression] ❌ ${errorMsg}`)
        errors.push(errorMsg)
      }
    }

    const duration = Date.now() - startTime
    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      duration,
      found: activeTournaments.length,
      advanced: advancedCount,
      completed: completedCount,
      errors: errors.length > 0 ? errors : undefined,
    }

    console.log('[Tournament Progression] ========== Cron job complete ==========')
    console.log(`[Tournament Progression] Duration: ${duration}ms`)
    console.log(`[Tournament Progression] Tournaments advanced: ${advancedCount}`)
    console.log(`[Tournament Progression] Tournaments completed: ${completedCount}`)
    if (errors.length > 0) {
      console.error(`[Tournament Progression] Errors: ${errors.length}`)
    }

    return NextResponse.json(summary)
  } catch (error: any) {
    console.error('[Tournament Progression] Cron job failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to process tournament progression',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
