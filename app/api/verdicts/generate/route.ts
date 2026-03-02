import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { generateVerdict, type DebateContext } from '@/lib/ai/deepseek'
import { sendPushNotificationForNotification } from '@/lib/notifications/push-notifications'
import { rateLimitMiddleware } from '@/lib/rate-limit'

// POST /api/verdicts/generate - Generate AI verdicts for a completed debate
export async function POST(request: NextRequest) {
  try {
    // Rate limit: AI verdict generation is expensive
    const rateLimit = await rateLimitMiddleware(request, 'ai')
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const { debateId } = await request.json()

    if (!debateId) {
      return NextResponse.json(
        { error: 'Debate ID is required' },
        { status: 400 }
      )
    }

    // Get debate with all data
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      include: {
        challenger: {
          select: {
            id: true,
            username: true,
            eloRating: true,
          }
        },
        opponent: {
          select: {
            id: true,
            username: true,
            eloRating: true,
          }
        },
        statements: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
              }
            }
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    })

    if (!debate) {
      return NextResponse.json(
        { error: 'Debate not found' },
        { status: 404 }
      )
    }

    // Accept both COMPLETED and VERDICT_READY statuses
    // COMPLETED = debate finished, verdicts not yet generated
    // VERDICT_READY = verdicts already generated
    if (debate.status !== 'COMPLETED' && debate.status !== 'VERDICT_READY') {
      return NextResponse.json(
        { error: `Debate is not completed (current status: ${debate.status})` },
        { status: 400 }
      )
    }
    
    // If already VERDICT_READY, check if verdicts exist
    if (debate.status === 'VERDICT_READY') {
      const existingVerdicts = await prisma.verdict.count({
        where: { debateId },
      })
      if (existingVerdicts > 0) {
        return NextResponse.json(
          { error: 'Verdicts already generated for this debate' },
          { status: 400 }
        )
      }
    }

    if (!debate.opponent) {
      return NextResponse.json(
        { error: 'Debate must have an opponent' },
        { status: 400 }
      )
    }

    // Check if verdicts already exist (only if status is COMPLETED)
    if (debate.status === 'COMPLETED') {
      const existingVerdicts = await prisma.verdict.count({
        where: { debateId },
      })

      if (existingVerdicts > 0) {
        return NextResponse.json(
          { error: 'Verdicts already generated for this debate' },
          { status: 400 }
        )
      }
    }

    // Get 3 random judges
    const allJudges = await prisma.judge.findMany()
    
    if (allJudges.length === 0) {
      console.error('No active judges found in database')
      return NextResponse.json(
        { error: 'No judges available. Please seed the database with judges using: npm run seed:all' },
        { status: 500 }
      )
    }
    
    console.log(`Found ${allJudges.length} active judges, selecting 3 for debate ${debateId}`)

    const selectedJudges = allJudges
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(3, allJudges.length))

    // Determine if debate is complete
    const isComplete = debate.status === 'VERDICT_READY' || (debate.currentRound >= debate.totalRounds && debate.status === 'COMPLETED')
    
    // Build debate context
    const debateContext: DebateContext = {
      topic: debate.topic,
      challengerPosition: debate.challengerPosition,
      opponentPosition: debate.opponentPosition,
      challengerName: debate.challenger.username,
      opponentName: debate.opponent.username,
      currentRound: debate.currentRound,
      totalRounds: debate.totalRounds,
      isComplete,
      statements: debate.statements.map((s) => ({
        round: s.round,
        author: s.author.username,
        position: s.author.id === debate.challengerId
          ? debate.challengerPosition
          : debate.opponentPosition,
        content: s.content,
      })),
    }

    // Check if DeepSeek API key is configured
    try {
      const { getDeepSeekKey } = await import('@/lib/ai/deepseek')
      await getDeepSeekKey() // This will throw if not configured
    } catch (error: any) {
      console.error('DeepSeek API key not configured:', error.message)
      return NextResponse.json(
        { 
          error: 'AI service not configured', 
          details: 'Please set DEEPSEEK_API_KEY in admin settings or environment variables' 
        },
        { status: 500 }
      )
    }

    console.log(`Generating verdicts for debate ${debateId} with ${selectedJudges.length} judges`)

    // Generate verdicts from each judge
    const verdicts = await Promise.all(
      selectedJudges.map(async (judge) => {
        try {
          console.log(`[Verdict Generation] Starting verdict for judge: ${judge.name} (${judge.id})`)
          const verdict = await generateVerdict(judge.systemPrompt, debateContext, {
            debateId,
            userId: debate.challengerId, // Track as challenger's usage
          })

          // Trust the LLM's winner determination - it should align with scores
          // Map LLM's winner field to database format
          let winnerId: string | null = null
          let decision: 'CHALLENGER_WINS' | 'OPPONENT_WINS' | 'TIE'

          if (verdict.winner === 'CHALLENGER') {
            winnerId = debate.challengerId
            decision = 'CHALLENGER_WINS'
          } else if (verdict.winner === 'OPPONENT') {
            winnerId = debate.opponentId
            decision = 'OPPONENT_WINS'
          } else {
            winnerId = null
            decision = 'TIE'
          }

          // Validation: Verify winner matches scores (for quality assurance)
          const c = verdict.challengerScore
          const o = verdict.opponentScore
          const expectedWinner = c > o ? 'CHALLENGER' : o > c ? 'OPPONENT' : 'TIE'

          if (verdict.winner !== expectedWinner) {
            console.warn(`[Verdict Generation] ⚠️ ${judge.name}: Winner/score mismatch! Winner="${verdict.winner}" but scores suggest "${expectedWinner}" (challenger: ${c}, opponent: ${o}). Using LLM's winner but this indicates prompt needs improvement.`)
          }

          console.log(`[Verdict Generation] ✅ ${judge.name}: winner=${verdict.winner}, challenger=${c}, opponent=${o}`)

          return {
            judgeId: judge.id,
            winnerId,
            decision,
            reasoning: verdict.reasoning,
            challengerScore: verdict.challengerScore,
            opponentScore: verdict.opponentScore,
          }
        } catch (error: any) {
          console.error(`[Verdict Generation] ❌ Failed to generate verdict for judge ${judge.name}:`, {
            judgeId: judge.id,
            error: error.message,
            stack: error.stack,
            debateId
          })
          // Return a default verdict if AI generation fails
          return {
            judgeId: judge.id,
            winnerId: null,
            decision: 'TIE' as const,
            reasoning: `Unable to generate verdict due to technical error: ${error.message}`,
            challengerScore: 50,
            opponentScore: 50,
          }
        }
      })
    )

    // Save verdicts to database
    await Promise.all(
      verdicts.map((verdict) =>
        prisma.verdict.create({
          data: {
            debateId,
            ...verdict,
          },
        })
      )
    )

    // Update judge stats
    await Promise.all(
      selectedJudges.map((judge) =>
        prisma.judge.update({
          where: { id: judge.id },
          data: {
            debatesJudged: {
              increment: 1,
            },
          },
        })
      )
    )

    // Calculate total scores from verdicts
    const challengerTotalScore = verdicts.reduce((sum, v) => sum + (v.challengerScore ?? 0), 0)
    const opponentTotalScore = verdicts.reduce((sum, v) => sum + (v.opponentScore ?? 0), 0)

    // Get tie threshold from admin settings (default: 5)
    const tieThresholdSetting = await prisma.adminSetting.findUnique({
      where: { key: 'VERDICT_TIE_THRESHOLD' },
    })
    const tieThreshold = tieThresholdSetting
      ? parseInt(tieThresholdSetting.value, 10)
      : 5 // Default: consider it a tie if total scores are within 5 points

    // Determine overall winner based on total score (not majority vote)
    // The person with the higher total score wins
    let finalWinnerId: string | null = null
    const scoreDifference = Math.abs(challengerTotalScore - opponentTotalScore)

    if (scoreDifference < tieThreshold) {
      // Scores are too close, it's a tie
      finalWinnerId = null
    } else if (challengerTotalScore > opponentTotalScore) {
      finalWinnerId = debate.challengerId
    } else if (opponentTotalScore > challengerTotalScore) {
      finalWinnerId = debate.opponentId
    }
    // If scores are equal or too close, winnerId remains null (tie)

    // Calculate ELO changes (simplified ELO system)
    const challengerEloChange = calculateEloChange(
      debate.challenger.eloRating ?? 1200,
      debate.opponent.eloRating ?? 1200,
      finalWinnerId === debate.challengerId ? 1 : finalWinnerId === debate.opponentId ? 0 : 0.5
    )
    const opponentEloChange = -challengerEloChange

    // Update debate with final winner and ELO changes
    const updatedDebate = await prisma.debate.update({
      where: { id: debateId },
      data: {
        status: 'VERDICT_READY',
        winnerId: finalWinnerId,
        verdictReached: true,
        verdictDate: new Date(),
        challengerEloChange,
        opponentEloChange,
      },
    })

    // Update user stats
    if (finalWinnerId === debate.challengerId) {
      await prisma.user.update({
        where: { id: debate.challengerId },
        data: {
          debatesWon: { increment: 1 },
          totalDebates: { increment: 1 },
          eloRating: { increment: challengerEloChange },
        },
      })
      if (debate.opponentId) {
        await prisma.user.update({
          where: { id: debate.opponentId },
          data: {
            debatesLost: { increment: 1 },
            totalDebates: { increment: 1 },
            eloRating: { increment: opponentEloChange },
          },
        })
      }
    } else if (finalWinnerId === debate.opponentId) {
      if (debate.opponentId) {
        await prisma.user.update({
          where: { id: debate.opponentId },
          data: {
            debatesWon: { increment: 1 },
            totalDebates: { increment: 1 },
            eloRating: { increment: opponentEloChange },
          },
        })
      }
      await prisma.user.update({
        where: { id: debate.challengerId },
        data: {
          debatesLost: { increment: 1 },
          totalDebates: { increment: 1 },
          eloRating: { increment: challengerEloChange },
        },
      })
    } else {
      // Tie
      await prisma.user.update({
        where: { id: debate.challengerId },
        data: {
          debatesTied: { increment: 1 },
          totalDebates: { increment: 1 },
          eloRating: { increment: challengerEloChange },
        },
      })
      if (debate.opponentId) {
        await prisma.user.update({
          where: { id: debate.opponentId },
          data: {
            debatesTied: { increment: 1 },
            totalDebates: { increment: 1 },
            eloRating: { increment: opponentEloChange },
          },
        })
      }
    }

    // Create notifications for participants
    const notifications = [
      prisma.notification.create({
        data: {
          userId: debate.challengerId,
          type: finalWinnerId === debate.challengerId ? 'DEBATE_WON' : finalWinnerId === debate.opponentId ? 'DEBATE_LOST' : 'DEBATE_TIED',
          title: finalWinnerId === debate.challengerId ? 'You Won!' : finalWinnerId === debate.opponentId ? 'You Lost' : 'Debate Tied',
          message: `The verdict for "${debate.topic}" is ready!`,
          debateId,
        },
      }),
    ]
    
    if (debate.opponentId) {
      notifications.push(
        prisma.notification.create({
          data: {
            userId: debate.opponentId,
            type: finalWinnerId === debate.opponentId ? 'DEBATE_WON' : finalWinnerId === debate.challengerId ? 'DEBATE_LOST' : 'DEBATE_TIED',
            title: finalWinnerId === debate.opponentId ? 'You Won!' : finalWinnerId === debate.challengerId ? 'You Lost' : 'Debate Tied',
            message: `The verdict for "${debate.topic}" is ready!`,
            debateId,
          },
        })
      )
    }
    
    await Promise.all(notifications)

    // Send push notifications for verdict (non-blocking)
    const challengerType = finalWinnerId === debate.challengerId ? 'DEBATE_WON'
      : finalWinnerId === debate.opponentId ? 'DEBATE_LOST' : 'DEBATE_TIED'
    const challengerTitle = finalWinnerId === debate.challengerId ? 'You Won!'
      : finalWinnerId === debate.opponentId ? 'You Lost' : 'Debate Tied'
    sendPushNotificationForNotification(
      debate.challengerId, challengerType, challengerTitle,
      `The verdict for "${debate.topic}" is ready!`, debateId
    ).catch(() => {})

    if (debate.opponentId) {
      const opponentType = finalWinnerId === debate.opponentId ? 'DEBATE_WON'
        : finalWinnerId === debate.challengerId ? 'DEBATE_LOST' : 'DEBATE_TIED'
      const opponentTitle = finalWinnerId === debate.opponentId ? 'You Won!'
        : finalWinnerId === debate.challengerId ? 'You Lost' : 'Debate Tied'
      sendPushNotificationForNotification(
        debate.opponentId, opponentType, opponentTitle,
        `The verdict for "${debate.topic}" is ready!`, debateId
      ).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      debate: updatedDebate,
      verdicts: verdicts.length,
    })
  } catch (error) {
    console.error('Failed to generate verdicts:', error)
    return NextResponse.json(
      { error: 'Failed to generate verdicts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Simplified ELO calculation
function calculateEloChange(
  playerElo: number,
  opponentElo: number,
  result: number // 1 = win, 0 = loss, 0.5 = tie
): number {
  const K = 32 // ELO K-factor
  const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400))
  const change = Math.round(K * (result - expectedScore))
  return change
}

