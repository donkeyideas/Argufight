import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import crypto from 'crypto'

/**
 * POST /api/debates/process-expired
 * 
 * This endpoint processes debates with expired round deadlines.
 * Should be called by a cron job every 5-10 minutes.
 * 
 * Logic:
 * - If one person submitted and the other didn't: submitter wins the round, non-submitter loses
 * - If both submitted: round should have already advanced (this is a safety check)
 * - If neither submitted: both get a tie for that round
 * - Advance to next round or end debate if it's the final round
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication for cron job
    // For development, allow without auth. In production, require CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    // Only require auth if CRON_SECRET is set (production)
    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    const now = new Date()
    console.log('Processing expired rounds at:', now.toISOString())

    // First, handle WAITING debates that have been waiting too long (e.g., 7 days)
    // These should be marked as CANCELLED
    // Also handle edge case: debates that were accepted (have opponent_id) but are still WAITING
    // This shouldn't happen, but if it does, mark them as CANCELLED too
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const expiredWaitingDebates = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM debates
      WHERE status = 'WAITING'
        AND (
          created_at <= ${sevenDaysAgo}
          OR opponent_id IS NOT NULL
        )
    `

    console.log(`Found ${expiredWaitingDebates.length} WAITING debates that expired (older than 7 days)`)

    for (const debate of expiredWaitingDebates) {
      try {
        await prisma.$executeRaw`
          UPDATE debates
          SET status = ${'CANCELLED'}::"DebateStatus", ended_at = ${now}
          WHERE id = ${debate.id}
        `

        console.log(`Cancelled expired WAITING debate: ${debate.id}`)
      } catch (error) {
        console.error(`Failed to cancel WAITING debate ${debate.id}:`, error)
      }
    }

    // Find all active debates with expired deadlines using raw SQL
    const expiredDebatesRaw = await prisma.$queryRaw<Array<{
      id: string
      topic: string
      status: string
      current_round: number
      total_rounds: number
      round_duration: number
      round_deadline: string | null
      challenger_id: string
      opponent_id: string | null
    }>>`
      SELECT 
        id,
        topic,
        status,
        current_round,
        total_rounds,
        round_duration,
        round_deadline,
        challenger_id,
        opponent_id
      FROM debates
      WHERE status = 'ACTIVE'
        AND round_deadline IS NOT NULL
        AND round_deadline <= ${now}
    `

    // Fetch statements for each debate
    const expiredDebates = await Promise.all(
      expiredDebatesRaw.map(async (debate) => {
        const statements = await prisma.statement.findMany({
          where: {
            debateId: debate.id,
            round: debate.current_round,
          },
        })

        return {
          id: debate.id,
          topic: debate.topic,
          status: debate.status,
          currentRound: debate.current_round,
          totalRounds: debate.total_rounds,
          roundDuration: debate.round_duration,
          roundDeadline: debate.round_deadline,
          challengerId: debate.challenger_id,
          opponentId: debate.opponent_id,
          statements,
        }
      })
    )

    console.log(`Found ${expiredDebates.length} debates with expired rounds`)

    const results = {
      processed: 0,
      advanced: 0,
      completed: 0,
      cancelled: expiredWaitingDebates.length,
      errors: [] as string[],
    }

    for (const debate of expiredDebates) {
      try {
        // Get statements for current round
        const roundStatements = debate.statements || []
        const currentRoundStatements = roundStatements.filter(
          s => s.round === debate.currentRound
        )

        const challengerSubmitted = currentRoundStatements.some(
          s => s.authorId === debate.challengerId
        )
        const opponentSubmitted = debate.opponentId
          ? currentRoundStatements.some(s => s.authorId === debate.opponentId)
          : false

        // Skip debates that were just accepted (round 1, no statements, future deadline)
        // This prevents newly accepted debates from being processed as expired
        const deadlineDate = debate.roundDeadline ? new Date(debate.roundDeadline) : null
        const isNewlyAccepted = debate.currentRound === 1 && 
                                currentRoundStatements.length === 0 && 
                                deadlineDate && 
                                deadlineDate > now

        if (isNewlyAccepted) {
          console.log(`Skipping newly accepted debate ${debate.id} - not yet expired`)
          continue
        }

        console.log(`Processing debate ${debate.id}:`, {
          round: debate.currentRound,
          challengerSubmitted,
          opponentSubmitted,
          deadline: debate.roundDeadline,
          isExpired: deadlineDate ? deadlineDate <= now : false,
        })

        // Case 0: Round 1 with neither player submitting - CANCEL the debate
        // Neither player showed up, so the debate should just die
        if (debate.currentRound === 1 && !challengerSubmitted && !opponentSubmitted) {
          await prisma.$executeRaw`
            UPDATE debates
            SET status = ${'CANCELLED'}::"DebateStatus", ended_at = ${now}, round_deadline = NULL
            WHERE id = ${debate.id}
          `

          // Notify both participants
          const cancelMessage = `The debate "${debate.topic}" was cancelled because neither participant submitted an argument in Round 1.`
          try {
            await Promise.all([
              prisma.$executeRaw`
                INSERT INTO notifications (id, user_id, type, title, message, debate_id, created_at, read)
                VALUES (${crypto.randomUUID()}, ${debate.challengerId}, ${'OTHER'}, ${'Debate Cancelled'}, ${cancelMessage}, ${debate.id}, ${now}, ${false})
              `,
              debate.opponentId
                ? prisma.$executeRaw`
                    INSERT INTO notifications (id, user_id, type, title, message, debate_id, created_at, read)
                    VALUES (${crypto.randomUUID()}, ${debate.opponentId}, ${'OTHER'}, ${'Debate Cancelled'}, ${cancelMessage}, ${debate.id}, ${now}, ${false})
                  `
                : Promise.resolve(),
            ])
          } catch (error) {
            console.error('Failed to create cancel notifications:', error)
          }

          console.log(`Cancelled Round 1 no-show debate: ${debate.id}`)
          results.cancelled++
          continue
        }

        // Case 1: Both submitted - should have already advanced, but check anyway
        if (challengerSubmitted && opponentSubmitted) {
          // Both submitted - only end if it's the final round
          // Don't end early at halfway point if both submitted - let them continue
          const isFinalRound = debate.currentRound >= debate.totalRounds

          if (isFinalRound) {
            // Final round completed - end debate and trigger AI judgment
            await prisma.debate.update({
              where: { id: debate.id },
              data: {
                status: 'COMPLETED',
                endedAt: now,
                roundDeadline: null,
              },
            })

            // Trigger verdict generation
            // IMPORTANT: Await this to ensure verdicts are generated before returning
            try {
              const generateModule = await import('@/lib/verdicts/generate-initial')
              console.log(`[Process Expired] Starting verdict generation for completed debate ${debate.id}`)
              await generateModule.generateInitialVerdicts(debate.id)
              console.log('✅ [Process Expired] Verdict generation completed for debate:', debate.id)
              
              // Update debate status to VERDICT_READY after verdicts are generated
              await prisma.debate.update({
                where: { id: debate.id },
                data: {
                  status: 'VERDICT_READY',
                },
              })
              console.log(`[Process Expired] Updated debate ${debate.id} status to VERDICT_READY`)
            } catch (error: any) {
              console.error('❌ [Process Expired] Error generating verdicts:', {
                debateId: debate.id,
                error: error.message,
                stack: error.stack,
              })
              // Don't throw - log the error but continue processing other debates
            }

            results.completed++
          } else {
            // Advance to next round (both submitted, so continue normally)
            const newDeadline = new Date(now.getTime() + debate.roundDuration)
            await prisma.debate.update({
              where: { id: debate.id },
              data: {
                currentRound: debate.currentRound + 1,
                roundDeadline: newDeadline,
              },
            })
            results.advanced++
          }
        }
        // Case 2: Only challenger submitted
        else if (challengerSubmitted && !opponentSubmitted) {
          await handleMissingSubmission(
            debate,
            debate.challengerId,
            debate.opponentId,
            now
          )
          results.processed++
        }
        // Case 3: Only opponent submitted
        else if (!challengerSubmitted && opponentSubmitted && debate.opponentId) {
          await handleMissingSubmission(
            debate,
            debate.opponentId,
            debate.challengerId,
            now
          )
          results.processed++
        }
        // Case 4: Neither submitted
        else {
          await handleBothMissing(debate, now)
          results.processed++
        }
      } catch (error: any) {
        console.error(`Error processing debate ${debate.id}:`, error)
        results.errors.push(`Debate ${debate.id}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      results,
    })
  } catch (error: any) {
    console.error('Failed to process expired rounds:', error)
    return NextResponse.json(
      { error: 'Failed to process expired rounds', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Handle case where one person submitted and the other didn't
 */
async function handleMissingSubmission(
  debate: any,
  submitterId: string,
  nonSubmitterId: string | null,
  now: Date
) {
  console.log(`Handling missing submission: ${submitterId} submitted, ${nonSubmitterId} did not`)

  // Create a "penalty" statement for the non-submitter (empty or default)
  // This marks that they missed the deadline
  if (nonSubmitterId) {
    try {
      await prisma.statement.create({
        data: {
          debateId: debate.id,
          authorId: nonSubmitterId,
          round: debate.currentRound,
          content: '[No submission - Time expired]',
        },
      })
    } catch (error) {
      // Statement might already exist, that's okay
      console.log('Statement may already exist for non-submitter')
    }
  }

  // Notify non-submitter about the penalty
  if (nonSubmitterId) {
    try {
      await prisma.$executeRaw`
        INSERT INTO notifications (id, user_id, type, title, message, debate_id, created_at, read)
        VALUES (${crypto.randomUUID()}, ${nonSubmitterId}, ${'DEBATE_LOST'}, ${'Round Time Expired'}, ${`You missed the deadline for Round ${debate.currentRound} in "${debate.topic}". Your opponent's argument was accepted.`}, ${debate.id}, ${now}, ${false})
      `
    } catch (error) {
      console.error('Failed to create notification:', error)
    }
  }

    // Check if debate is halfway through (at least 50% of rounds completed)
    const halfwayPoint = Math.ceil(debate.totalRounds / 2)
    const isHalfwayThrough = debate.currentRound >= halfwayPoint
    const isFinalRound = debate.currentRound >= debate.totalRounds

    // End debate and trigger AI judgment if:
    // 1. It's the final round, OR
    // 2. It's at least halfway through and time expired
    if (isFinalRound || isHalfwayThrough) {
      // End debate - AI will judge whatever arguments exist
      await prisma.$executeRaw`
        UPDATE debates
        SET status = ${'COMPLETED'}::"DebateStatus", ended_at = ${now}, round_deadline = NULL
        WHERE id = ${debate.id}
      `

      console.log(`[Process Expired] Ending debate ${debate.id} - Round ${debate.currentRound}/${debate.totalRounds} ${isHalfwayThrough && !isFinalRound ? '(halfway through)' : '(final round)'} - Time expired, generating verdicts`)

      // Trigger verdict generation automatically (direct function call)
      // AI will judge whatever arguments are available, even if incomplete
      // IMPORTANT: Await this to ensure verdicts are generated before returning
      try {
        const generateModule = await import('@/lib/verdicts/generate-initial')
        console.log(`[Process Expired] Starting verdict generation for expired debate ${debate.id}`)
        await generateModule.generateInitialVerdicts(debate.id)
        console.log('✅ [Process Expired] Verdict generation completed for debate:', debate.id)
        
        // Update debate status to VERDICT_READY after verdicts are generated
        await prisma.$executeRaw`
          UPDATE debates
          SET status = ${'VERDICT_READY'}::"DebateStatus"
          WHERE id = ${debate.id}
        `
        console.log(`[Process Expired] Updated debate ${debate.id} status to VERDICT_READY`)
      } catch (error: any) {
        console.error('❌ [Process Expired] Error generating verdicts:', {
          debateId: debate.id,
          error: error.message,
          stack: error.stack,
        })
        // Don't throw - log the error but continue processing other debates
        // The debate remains COMPLETED but without verdicts - can be retried later
      }
    } else {
      // Not halfway through yet - advance to next round
      const newDeadline = new Date(now.getTime() + debate.roundDuration)
      await prisma.$executeRaw`
        UPDATE debates
        SET current_round = ${debate.currentRound + 1}, round_deadline = ${newDeadline}
        WHERE id = ${debate.id}
      `
      console.log(`[Process Expired] Advancing debate ${debate.id} to round ${debate.currentRound + 1}/${debate.totalRounds}`)
    }
}

/**
 * Handle case where neither person submitted
 */
async function handleBothMissing(debate: any, now: Date) {
  console.log(`Handling both missing: Neither participant submitted for round ${debate.currentRound}`)

  // Create penalty statements for both
  try {
    await Promise.all([
      prisma.statement.create({
        data: {
          debateId: debate.id,
          authorId: debate.challengerId,
          round: debate.currentRound,
          content: '[No submission - Time expired]',
        },
      }).catch(() => {}), // Ignore if already exists
      debate.opponentId
        ? prisma.statement.create({
            data: {
              debateId: debate.id,
              authorId: debate.opponentId,
              round: debate.currentRound,
              content: '[No submission - Time expired]',
            },
          }).catch(() => {})
        : Promise.resolve(),
    ])
  } catch (error) {
    console.error('Error creating penalty statements:', error)
  }

  // Notify both participants
  const notificationMessage = `Both participants missed the deadline for Round ${debate.currentRound}. The round was marked as a tie.`

  try {
    await Promise.all([
      prisma.$executeRaw`
        INSERT INTO notifications (id, user_id, type, title, message, debate_id, created_at, read)
        VALUES (${crypto.randomUUID()}, ${debate.challengerId}, ${'DEBATE_TIED'}, ${'Round Time Expired'}, ${notificationMessage}, ${debate.id}, ${now}, ${false})
      `,
      debate.opponentId
        ? prisma.$executeRaw`
            INSERT INTO notifications (id, user_id, type, title, message, debate_id, created_at, read)
            VALUES (${crypto.randomUUID()}, ${debate.opponentId}, ${'DEBATE_TIED'}, ${'Round Time Expired'}, ${notificationMessage}, ${debate.id}, ${now}, ${false})
          `
        : Promise.resolve(),
    ])
  } catch (error) {
    console.error('Failed to create notifications:', error)
  }

  // Check if debate is halfway through (at least 50% of rounds completed)
  const halfwayPoint = Math.ceil(debate.totalRounds / 2)
  const isHalfwayThrough = debate.currentRound >= halfwayPoint
  const isFinalRound = debate.currentRound >= debate.totalRounds

  // End debate and trigger AI judgment if:
  // 1. It's the final round, OR
  // 2. It's at least halfway through and time expired
  if (isFinalRound || isHalfwayThrough) {
    // End debate - AI will judge whatever arguments exist (even if incomplete)
    await prisma.debate.update({
      where: { id: debate.id },
      data: {
        status: 'COMPLETED',
        endedAt: now,
        roundDeadline: null,
      },
    })

    console.log(`[Process Expired] Ending debate ${debate.id} (both missing) - Round ${debate.currentRound}/${debate.totalRounds} ${isHalfwayThrough && !isFinalRound ? '(halfway through)' : '(final round)'} - Time expired, generating verdicts`)

    // Trigger verdict generation (AI will judge whatever arguments exist)
    // IMPORTANT: Await this to ensure verdicts are generated before returning
    try {
      const generateModule = await import('@/lib/verdicts/generate-initial')
      console.log(`[Process Expired] Starting verdict generation for expired debate ${debate.id} (both participants missed deadline)`)
      await generateModule.generateInitialVerdicts(debate.id)
      console.log('✅ [Process Expired] Verdict generation completed for debate:', debate.id)
      
      // Update debate status to VERDICT_READY after verdicts are generated
      await prisma.debate.update({
        where: { id: debate.id },
        data: {
          status: 'VERDICT_READY',
        },
      })
      console.log(`[Process Expired] Updated debate ${debate.id} status to VERDICT_READY`)
    } catch (error: any) {
      console.error('❌ [Process Expired] Error generating verdicts:', {
        debateId: debate.id,
        error: error.message,
        stack: error.stack,
      })
      // Don't throw - log the error but continue processing other debates
      // The debate remains COMPLETED but without verdicts - can be retried later
    }
  } else {
    // Not halfway through yet - advance to next round
    const newDeadline = new Date(now.getTime() + debate.roundDuration)
    await prisma.debate.update({
      where: { id: debate.id },
      data: {
        currentRound: debate.currentRound + 1,
        roundDeadline: newDeadline,
      },
    })
    console.log(`[Process Expired] Advancing debate ${debate.id} (both missing) to round ${debate.currentRound + 1}/${debate.totalRounds}`)
  }
}

