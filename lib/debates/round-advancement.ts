import { prisma } from '@/lib/db/prisma'
import { DebateStatus } from '@prisma/client'

/**
 * Check and advance debates where the round deadline has expired
 * This should be called periodically (e.g., via cron job or API route)
 */
export async function checkAndAdvanceExpiredRounds() {
  const now = new Date()
  
  // Find all active debates where the round deadline has passed
  const expiredDebates = await prisma.debate.findMany({
    where: {
      status: 'ACTIVE',
      roundDeadline: {
        lte: now, // Round deadline is less than or equal to now (expired)
      },
    },
    include: {
      statements: {
        select: {
          round: true,
          authorId: true,
        },
      },
    },
  })

  const results = []
  for (const debate of expiredDebates) {
    const result = await advanceDebateRound(debate.id)
    results.push({ debateId: debate.id, ...result })
  }

  return {
    processed: expiredDebates.length,
    debates: results,
  }
}

/**
 * Advance a debate to the next round or complete it
 */
export async function advanceDebateRound(debateId: string) {
  const debate = await prisma.debate.findUnique({
    where: { id: debateId },
    include: {
      statements: {
        select: {
          round: true,
          authorId: true,
        },
      },
    },
  })

  if (!debate) {
    throw new Error(`Debate ${debateId} not found`)
  }

  if (debate.status !== 'ACTIVE') {
    return { skipped: true, reason: `Debate is not ACTIVE (status: ${debate.status})` }
  }

  const now = new Date()
  
  // SPECIAL RULE: If no statements in round 1, end the debate immediately (no penalties)
  // This check happens FIRST, regardless of deadline or current round
  const round1Statements = debate.statements.filter(s => s.round === 1)
  const totalStatements = debate.statements.length
  
  // If no statements in round 1, end the debate immediately (regardless of current round or deadline)
  if (round1Statements.length === 0) {
    // End debate - no one participated in round 1
    // Set verdictReached to true since there's nothing to judge
    await prisma.debate.update({
      where: { id: debateId },
      data: {
        status: DebateStatus.COMPLETED,
        endedAt: now,
        roundDeadline: null,
        verdictReached: true, // No verdict needed - no statements to judge
        verdictDate: now,
      },
    })

    return {
      completed: true,
      reason: 'No statements submitted in round 1 - debate ended automatically',
      message: 'Debate ended automatically - no statements in first round',
    }
  }
  
  // Also end if we're past round 1 but still have zero statements total
  if (totalStatements === 0 && debate.currentRound > 1) {
    await prisma.debate.update({
      where: { id: debateId },
      data: {
        status: DebateStatus.COMPLETED,
        endedAt: now,
        roundDeadline: null,
        verdictReached: true, // No verdict needed - no statements to judge
        verdictDate: now,
      },
    })

    return {
      completed: true,
      reason: 'No statements submitted in any round - debate ended automatically',
      message: 'Debate ended automatically - no statements submitted',
    }
  }
  
  // Check if round deadline has actually passed (only if round 1 has statements)
  if (debate.roundDeadline && debate.roundDeadline > now) {
    return { skipped: true, reason: 'Round deadline has not passed yet' }
  }

  // Check if this is the last round
  if (debate.currentRound >= debate.totalRounds) {
    // Complete the debate
    await prisma.debate.update({
      where: { id: debateId },
      data: {
        status: DebateStatus.COMPLETED,
        endedAt: now,
        roundDeadline: null,
      },
    })

    // TODO: Trigger AI judgment/verdict generation here
    // This would typically call an AI service to generate the verdict

    return {
      completed: true,
      message: 'Debate completed - last round finished',
    }
  } else {
    // Advance to next round
    const nextRound = debate.currentRound + 1
    const nextRoundDeadline = new Date(now.getTime() + debate.roundDuration)

    await prisma.debate.update({
      where: { id: debateId },
      data: {
        currentRound: nextRound,
        roundDeadline: nextRoundDeadline,
        updatedAt: now,
      },
    })

    return {
      advanced: true,
      newRound: nextRound,
      newDeadline: nextRoundDeadline,
      message: `Debate advanced to round ${nextRound}`,
    }
  }
}

/**
 * Check a specific debate and advance if needed
 */
export async function checkDebateRound(debateId: string) {
  const debate = await prisma.debate.findUnique({
    where: { id: debateId },
    include: {
      statements: {
        select: {
          round: true,
          authorId: true,
        },
      },
    },
  })

  if (!debate) {
    throw new Error(`Debate ${debateId} not found`)
  }

  if (debate.status !== 'ACTIVE') {
    return { 
      status: debate.status,
      currentRound: debate.currentRound,
      message: `Debate is ${debate.status.toLowerCase()}, no action needed`,
    }
  }

  const now = new Date()
  
  if (!debate.roundDeadline) {
    return {
      status: debate.status,
      currentRound: debate.currentRound,
      message: 'No round deadline set',
    }
  }

  if (debate.roundDeadline > now) {
    const timeRemaining = debate.roundDeadline.getTime() - now.getTime()
    const minutesRemaining = Math.floor(timeRemaining / 60000)
    
    return {
      status: debate.status,
      currentRound: debate.currentRound,
      deadline: debate.roundDeadline,
      timeRemaining: minutesRemaining,
      message: `${minutesRemaining} minutes remaining in round ${debate.currentRound}`,
    }
  }

  // Round has expired, advance it
  return await advanceDebateRound(debateId)
}
