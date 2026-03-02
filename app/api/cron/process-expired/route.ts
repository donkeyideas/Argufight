// Cron Job: Process Expired Debate Rounds
// Schedule: daily (free tier)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import crypto from 'crypto'
import { sendPushNotificationForNotification } from '@/lib/notifications/push-notifications'
import { verifyCronAuth } from '@/lib/auth/cron-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    console.log('[Cron] Starting expired debate rounds processing...')

    const now = new Date()

    // --- WAITING debates older than 7 days or with an opponent (should have started) ---
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    let cancelledCount = Number(await prisma.$executeRaw`
      UPDATE debates
      SET status = 'CANCELLED'::"DebateStatus", ended_at = ${now}
      WHERE status = 'WAITING'
        AND (
          created_at <= ${sevenDaysAgo}
          OR opponent_id IS NOT NULL
        )
    `)

    console.log(`[Cron] Bulk cancelled ${cancelledCount} WAITING debates`)

    // --- ACTIVE debates with expired round deadlines ---
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
        id, topic, status, current_round, total_rounds,
        round_duration, round_deadline, challenger_id, opponent_id
      FROM debates
      WHERE status = 'ACTIVE'
        AND round_deadline IS NOT NULL
        AND round_deadline <= ${now}
    `

    // Fetch statements for each debate
    const expiredDebates = await Promise.all(
      expiredDebatesRaw.map(async (debate) => {
        const statements = await prisma.statement.findMany({
          where: { debateId: debate.id, round: debate.current_round },
        })
        return {
          id: debate.id,
          topic: debate.topic,
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

    console.log(`[Cron] Found ${expiredDebates.length} ACTIVE debates with expired rounds`)

    let processedCount = 0
    let advancedCount = 0
    let completedCount = 0
    const errors: string[] = []

    for (const debate of expiredDebates) {
      try {
        const currentRoundStatements = (debate.statements || []).filter(
          s => s.round === debate.currentRound
        )
        const challengerSubmitted = currentRoundStatements.some(s => s.authorId === debate.challengerId)
        const opponentSubmitted = debate.opponentId
          ? currentRoundStatements.some(s => s.authorId === debate.opponentId)
          : false

        // Skip debates that haven't actually expired yet (safety check)
        const deadlineDate = debate.roundDeadline ? new Date(debate.roundDeadline) : null
        if (deadlineDate && deadlineDate > now) continue

        // Round 1 with neither submitting: CANCEL
        if (debate.currentRound === 1 && !challengerSubmitted && !opponentSubmitted) {
          await prisma.$executeRaw`
            UPDATE debates
            SET status = ${'CANCELLED'}::"DebateStatus", ended_at = ${now}, round_deadline = NULL
            WHERE id = ${debate.id}
          `
          const msg = `The debate "${debate.topic}" was cancelled because neither participant submitted an argument in Round 1.`
          try {
            await prisma.$executeRaw`
              INSERT INTO notifications (id, user_id, type, title, message, debate_id, created_at, read)
              VALUES (${crypto.randomUUID()}, ${debate.challengerId}, ${'OTHER'}, ${'Debate Cancelled'}, ${msg}, ${debate.id}, ${now}, ${false})
            `
            if (debate.opponentId) {
              await prisma.$executeRaw`
                INSERT INTO notifications (id, user_id, type, title, message, debate_id, created_at, read)
                VALUES (${crypto.randomUUID()}, ${debate.opponentId}, ${'OTHER'}, ${'Debate Cancelled'}, ${msg}, ${debate.id}, ${now}, ${false})
              `
            }
          } catch (e) { console.error('Failed to notify:', e) }
          // Push notifications for cancellation (non-blocking)
          sendPushNotificationForNotification(debate.challengerId, 'OTHER', 'Debate Cancelled', msg, debate.id).catch(() => {})
          if (debate.opponentId) {
            sendPushNotificationForNotification(debate.opponentId, 'OTHER', 'Debate Cancelled', msg, debate.id).catch(() => {})
          }
          cancelledCount++
          console.log(`[Cron] Cancelled Round 1 no-show debate: ${debate.id}`)
          continue
        }

        // One submitted, one didn't
        if (challengerSubmitted && !opponentSubmitted) {
          await handleMissingSubmission(debate, debate.challengerId, debate.opponentId, now)
          processedCount++
        } else if (!challengerSubmitted && opponentSubmitted && debate.opponentId) {
          await handleMissingSubmission(debate, debate.opponentId, debate.challengerId, now)
          processedCount++
        } else if (challengerSubmitted && opponentSubmitted) {
          // Both submitted — advance or complete
          const isFinalRound = debate.currentRound >= debate.totalRounds
          if (isFinalRound) {
            await prisma.$executeRaw`
              UPDATE debates
              SET status = ${'COMPLETED'}::"DebateStatus", ended_at = ${now}, round_deadline = NULL
              WHERE id = ${debate.id}
            `
            try {
              const generateModule = await import('@/lib/verdicts/generate-initial')
              await generateModule.generateInitialVerdicts(debate.id)
              await prisma.$executeRaw`
                UPDATE debates SET status = ${'VERDICT_READY'}::"DebateStatus" WHERE id = ${debate.id}
              `
            } catch (e: any) {
              console.error(`[Cron] Verdict generation failed for ${debate.id}:`, e.message)
            }
            completedCount++
          } else {
            const newDeadline = new Date(now.getTime() + debate.roundDuration)
            await prisma.$executeRaw`
              UPDATE debates
              SET current_round = ${debate.currentRound + 1}, round_deadline = ${newDeadline}
              WHERE id = ${debate.id}
            `
            advancedCount++
          }
        } else {
          // Neither submitted (but not Round 1 — that's handled above)
          await handleBothMissing(debate, now)
          processedCount++
        }
      } catch (error: any) {
        console.error(`[Cron] Error processing debate ${debate.id}:`, error)
        errors.push(`${debate.id}: ${error.message}`)
      }
    }

    const summary = {
      success: true,
      timestamp: now.toISOString(),
      cancelled: cancelledCount,
      processed: processedCount,
      advanced: advancedCount,
      completed: completedCount,
      errors: errors.length > 0 ? errors : undefined,
    }

    console.log('[Cron] Expired debate processing complete:', summary)
    return NextResponse.json(summary)
  } catch (error: any) {
    console.error('[Cron] Process expired failed:', error)
    return NextResponse.json(
      { success: false, error: error.message, timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}

async function handleMissingSubmission(debate: any, submitterId: string, nonSubmitterId: string | null, now: Date) {
  if (nonSubmitterId) {
    try {
      await prisma.statement.create({
        data: { debateId: debate.id, authorId: nonSubmitterId, round: debate.currentRound, content: '[No submission - Time expired]' },
      })
    } catch { /* may already exist */ }

    try {
      await prisma.$executeRaw`
        INSERT INTO notifications (id, user_id, type, title, message, debate_id, created_at, read)
        VALUES (${crypto.randomUUID()}, ${nonSubmitterId}, ${'DEBATE_LOST'}, ${'Round Time Expired'}, ${`You missed the deadline for Round ${debate.currentRound} in "${debate.topic}". Your opponent's argument was accepted.`}, ${debate.id}, ${now}, ${false})
      `
    } catch (e) { console.error('Failed to notify:', e) }
    // Push notification for missed deadline (non-blocking)
    sendPushNotificationForNotification(
      nonSubmitterId, 'DEBATE_LOST', 'Round Time Expired',
      `You missed the deadline for Round ${debate.currentRound} in "${debate.topic}".`, debate.id
    ).catch(() => {})
  }

  const halfwayPoint = Math.ceil(debate.totalRounds / 2)
  const isFinalRound = debate.currentRound >= debate.totalRounds
  const isHalfwayThrough = debate.currentRound >= halfwayPoint

  if (isFinalRound || isHalfwayThrough) {
    await prisma.$executeRaw`
      UPDATE debates SET status = ${'COMPLETED'}::"DebateStatus", ended_at = ${now}, round_deadline = NULL WHERE id = ${debate.id}
    `
    try {
      const generateModule = await import('@/lib/verdicts/generate-initial')
      await generateModule.generateInitialVerdicts(debate.id)
      await prisma.$executeRaw`
        UPDATE debates SET status = ${'VERDICT_READY'}::"DebateStatus" WHERE id = ${debate.id}
      `
    } catch (e: any) { console.error(`Verdict gen failed for ${debate.id}:`, e.message) }
  } else {
    const newDeadline = new Date(now.getTime() + debate.roundDuration)
    await prisma.$executeRaw`
      UPDATE debates SET current_round = ${debate.currentRound + 1}, round_deadline = ${newDeadline} WHERE id = ${debate.id}
    `
  }
}

async function handleBothMissing(debate: any, now: Date) {
  try {
    await Promise.all([
      prisma.statement.create({
        data: { debateId: debate.id, authorId: debate.challengerId, round: debate.currentRound, content: '[No submission - Time expired]' },
      }).catch(() => {}),
      debate.opponentId
        ? prisma.statement.create({
            data: { debateId: debate.id, authorId: debate.opponentId, round: debate.currentRound, content: '[No submission - Time expired]' },
          }).catch(() => {})
        : Promise.resolve(),
    ])
  } catch { /* ignore */ }

  const msg = `Both participants missed the deadline for Round ${debate.currentRound}. The round was marked as a tie.`
  try {
    await prisma.$executeRaw`
      INSERT INTO notifications (id, user_id, type, title, message, debate_id, created_at, read)
      VALUES (${crypto.randomUUID()}, ${debate.challengerId}, ${'DEBATE_TIED'}, ${'Round Time Expired'}, ${msg}, ${debate.id}, ${now}, ${false})
    `
    if (debate.opponentId) {
      await prisma.$executeRaw`
        INSERT INTO notifications (id, user_id, type, title, message, debate_id, created_at, read)
        VALUES (${crypto.randomUUID()}, ${debate.opponentId}, ${'DEBATE_TIED'}, ${'Round Time Expired'}, ${msg}, ${debate.id}, ${now}, ${false})
      `
    }
  } catch (e) { console.error('Failed to notify:', e) }
  // Push notifications for both missing (non-blocking)
  sendPushNotificationForNotification(debate.challengerId, 'DEBATE_TIED', 'Round Time Expired', msg, debate.id).catch(() => {})
  if (debate.opponentId) {
    sendPushNotificationForNotification(debate.opponentId, 'DEBATE_TIED', 'Round Time Expired', msg, debate.id).catch(() => {})
  }

  const halfwayPoint = Math.ceil(debate.totalRounds / 2)
  const isFinalRound = debate.currentRound >= debate.totalRounds
  const isHalfwayThrough = debate.currentRound >= halfwayPoint

  if (isFinalRound || isHalfwayThrough) {
    await prisma.$executeRaw`
      UPDATE debates SET status = ${'COMPLETED'}::"DebateStatus", ended_at = ${now}, round_deadline = NULL WHERE id = ${debate.id}
    `
    try {
      const generateModule = await import('@/lib/verdicts/generate-initial')
      await generateModule.generateInitialVerdicts(debate.id)
      await prisma.$executeRaw`
        UPDATE debates SET status = ${'VERDICT_READY'}::"DebateStatus" WHERE id = ${debate.id}
      `
    } catch (e: any) { console.error(`Verdict gen failed for ${debate.id}:`, e.message) }
  } else {
    const newDeadline = new Date(now.getTime() + debate.roundDuration)
    await prisma.$executeRaw`
      UPDATE debates SET current_round = ${debate.currentRound + 1}, round_deadline = ${newDeadline} WHERE id = ${debate.id}
    `
  }
}
