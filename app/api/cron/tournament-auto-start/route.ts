/**
 * Cron Job: Auto-Start Tournaments
 * Runs every hour to check for tournaments ready to start
 *
 * Schedule: 0 * * * * (every hour)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { startTournament } from '@/lib/tournaments/match-generation'
import { verifyCronAuth } from '@/lib/auth/cron-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  console.log('[Tournament Auto-Start] ========== Starting tournament auto-start cron ==========')

  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const now = new Date()
    let startedCount = 0
    const errors: string[] = []

    // Find tournaments ready to start
    const readyTournaments = await prisma.tournament.findMany({
      where: {
        status: 'REGISTRATION_OPEN',
      },
      include: {
        participants: true,
      },
    })

    console.log(`[Tournament Auto-Start] Found ${readyTournaments.length} tournaments in registration`)

    for (const tournament of readyTournaments) {
      try {
        const participantCount = tournament.participants.length
        const isFull = participantCount >= tournament.maxParticipants
        const isPastStartDate = tournament.startDate && tournament.startDate <= now
        const hasMinParticipants = participantCount >= 2 // Need at least 2 for a tournament

        // Start if:
        // 1. Tournament is full (regardless of start date), OR
        // 2. Start date has passed AND has minimum participants
        if (isFull || (isPastStartDate && hasMinParticipants)) {
          const reason = isFull
            ? `full (${participantCount}/${tournament.maxParticipants})`
            : `past start date with ${participantCount} participants`

          console.log(`[Tournament Auto-Start] Starting "${tournament.name}" (${tournament.id}) - ${reason}`)

          await startTournament(tournament.id)

          startedCount++
          console.log(`[Tournament Auto-Start] ✅ Successfully started tournament ${tournament.id}`)
        } else {
          console.log(
            `[Tournament Auto-Start] Skipping "${tournament.name}" (${tournament.id}): ` +
            `${participantCount}/${tournament.maxParticipants} participants, ` +
            `start date: ${tournament.startDate?.toISOString() || 'none'}`
          )
        }
      } catch (error: any) {
        const errorMsg = `Failed to start tournament ${tournament.id} "${tournament.name}": ${error.message}`
        console.error(`[Tournament Auto-Start] ❌ ${errorMsg}`)
        errors.push(errorMsg)

        // Mark tournament as failed if auto-start fails
        try {
          await prisma.tournament.update({
            where: { id: tournament.id },
            data: {
              status: 'CANCELLED',
            },
          })
          console.log(`[Tournament Auto-Start] Marked tournament ${tournament.id} as CANCELLED due to start failure`)
        } catch (updateError) {
          console.error(`[Tournament Auto-Start] Failed to update tournament status:`, updateError)
        }
      }
    }

    const duration = Date.now() - startTime
    const summary = {
      success: true,
      timestamp: now.toISOString(),
      duration,
      found: readyTournaments.length,
      started: startedCount,
      errors: errors.length > 0 ? errors : undefined,
    }

    console.log('[Tournament Auto-Start] ========== Cron job complete ==========')
    console.log(`[Tournament Auto-Start] Duration: ${duration}ms`)
    console.log(`[Tournament Auto-Start] Tournaments started: ${startedCount}`)
    if (errors.length > 0) {
      console.error(`[Tournament Auto-Start] Errors: ${errors.length}`)
    }

    return NextResponse.json(summary)
  } catch (error: any) {
    console.error('[Tournament Auto-Start] Cron job failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to process tournament auto-start',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
