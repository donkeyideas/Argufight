import { prisma } from '@/lib/db/prisma'
import { generateVerdict, type DebateContext } from '@/lib/ai/deepseek'
import { updateUserAnalyticsOnDebateComplete } from '@/lib/utils/analytics'
import { sendPushNotificationForNotification } from '@/lib/notifications/push-notifications'

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

/**
 * Generate initial verdicts for a completed debate
 * This function can be called directly without HTTP fetch
 */
export async function generateInitialVerdicts(debateId: string) {
  try {
    // Get debate with all data
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      include: {
        challenger: {
          select: {
            id: true,
            username: true,
            eloRating: true,
            isAI: true,
          }
        },
        opponent: {
          select: {
            id: true,
            username: true,
            eloRating: true,
            isAI: true,
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
      throw new Error('Debate not found')
    }

    // Accept both COMPLETED and VERDICT_READY statuses
    if (debate.status !== 'COMPLETED' && debate.status !== 'VERDICT_READY') {
      throw new Error(`Debate is not completed (current status: ${debate.status})`)
    }
    
    // If already VERDICT_READY, check if verdicts exist
    if (debate.status === 'VERDICT_READY') {
      const existingVerdicts = await prisma.verdict.count({
        where: { debateId },
      })
      if (existingVerdicts > 0) {
        throw new Error('Verdicts already generated for this debate')
      }
    }

    if (!debate.opponent) {
      throw new Error('Debate must have an opponent')
    }

    // Check if verdicts already exist (only if status is COMPLETED)
    if (debate.status === 'COMPLETED') {
      const existingVerdicts = await prisma.verdict.count({
        where: { debateId },
      })

      if (existingVerdicts > 0) {
        throw new Error('Verdicts already generated for this debate')
      }
    }

    // Get 3 random judges
    const allJudges = await prisma.judge.findMany()
    
    if (allJudges.length === 0) {
      throw new Error('No judges available. Please seed the database with judges using: npm run seed:all')
    }
    
    console.log(`[Generate Verdicts] Found ${allJudges.length} active judges, selecting 3 for debate ${debateId}`)

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
      throw new Error('AI service not configured. Please set DEEPSEEK_API_KEY in admin settings or environment variables')
    }

    console.log(`[Generate Verdicts] Generating verdicts for debate ${debateId} with ${selectedJudges.length} judges`)

    // Generate verdicts from each judge in parallel
    const verdicts = await Promise.all(
      selectedJudges.map(async (judge) => {
        try {
          console.log(`[Generate Verdicts] Starting verdict for judge: ${judge.name} (${judge.id})`)
          const verdict = await generateVerdict(judge.systemPrompt, debateContext, {
            debateId,
            userId: debate.challengerId, // Track as challenger's usage
          })
          console.log(`[Generate Verdicts] ✅ Successfully generated verdict from ${judge.name}:`, {
            winner: verdict.winner,
            challengerScore: verdict.challengerScore,
            opponentScore: verdict.opponentScore
          })

          // CRITICAL FIX: Derive winner from scores to ensure consistency
          // The AI might give inconsistent winner decisions vs scores, especially for expired debates
          // We derive the decision from scores (the primary data) to ensure they always match
          const scoreDifference = Math.abs(verdict.challengerScore - verdict.opponentScore)
          const tieThreshold = 1 // Consider it a tie if scores are within 1 point
          
          let derivedWinner: 'CHALLENGER' | 'OPPONENT' | 'TIE'
          if (scoreDifference < tieThreshold) {
            derivedWinner = 'TIE'
          } else if (verdict.challengerScore > verdict.opponentScore) {
            derivedWinner = 'CHALLENGER'
          } else {
            derivedWinner = 'OPPONENT'
          }

          // Log if AI's winner doesn't match derived winner (for debugging)
          if (verdict.winner !== derivedWinner) {
            console.warn(`[Generate Verdicts] ⚠️ AI winner mismatch for ${judge.name}:`, {
              aiWinner: verdict.winner,
              derivedWinner,
              challengerScore: verdict.challengerScore,
              opponentScore: verdict.opponentScore,
              debateId
            })
          }

          // Map derived winner to user ID
          let winnerId: string | null = null
          if (derivedWinner === 'CHALLENGER') {
            winnerId = debate.challengerId
          } else if (derivedWinner === 'OPPONENT') {
            winnerId = debate.opponentId
          }

          // Determine decision enum from derived winner
          let decision: 'CHALLENGER_WINS' | 'OPPONENT_WINS' | 'TIE'
          if (derivedWinner === 'CHALLENGER') {
            decision = 'CHALLENGER_WINS'
          } else if (derivedWinner === 'OPPONENT') {
            decision = 'OPPONENT_WINS'
          } else {
            decision = 'TIE'
          }

          return {
            judgeId: judge.id,
            winnerId,
            decision,
            reasoning: verdict.reasoning,
            challengerScore: verdict.challengerScore,
            opponentScore: verdict.opponentScore,
          }
        } catch (error: any) {
          console.error(`[Generate Verdicts] ❌ Failed to generate verdict for judge ${judge.name}:`, {
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

    // Determine overall winner based on total score (not majority vote)
    // The person with the higher total score wins
    let finalWinnerId: string | null = null
    const scoreDifference = Math.abs(challengerTotalScore - opponentTotalScore)
    const tieThreshold = 5 // Consider it a tie if scores are within 5 points

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

    // Total scores already calculated above for winner determination
    const maxScoreForDebate = verdicts.length * 100 // Each judge can give up to 100 points

    // Calculate rounds for analytics
    const roundsCompleted = debate.currentRound || debate.totalRounds || 0

    // Update user stats
    if (finalWinnerId === debate.challengerId) {
      await prisma.user.update({
        where: { id: debate.challengerId },
        data: {
          debatesWon: { increment: 1 },
          totalDebates: { increment: 1 },
          eloRating: { increment: challengerEloChange },
          totalScore: { increment: challengerTotalScore },
          totalMaxScore: { increment: maxScoreForDebate },
        },
      })
      // Update average rounds
      const challengerUser = await prisma.user.findUnique({
        where: { id: debate.challengerId },
        select: { totalDebates: true, averageRounds: true },
      })
      if (challengerUser) {
        const oldCount = challengerUser.totalDebates - 1
        const oldAverage = challengerUser.averageRounds || 0
        const newAverage = oldCount > 0
          ? (oldAverage * oldCount + roundsCompleted) / challengerUser.totalDebates
          : roundsCompleted
        await prisma.user.update({
          where: { id: debate.challengerId },
          data: { averageRounds: newAverage },
        })
      }

      if (debate.opponentId) {
        await prisma.user.update({
          where: { id: debate.opponentId },
          data: {
            debatesLost: { increment: 1 },
            totalDebates: { increment: 1 },
            eloRating: { increment: opponentEloChange },
            totalScore: { increment: opponentTotalScore },
            totalMaxScore: { increment: maxScoreForDebate },
          },
        })
        // Update average rounds
        const opponentUser = await prisma.user.findUnique({
          where: { id: debate.opponentId },
          select: { totalDebates: true, averageRounds: true },
        })
        if (opponentUser) {
          const oldCount = opponentUser.totalDebates - 1
          const oldAverage = opponentUser.averageRounds || 0
          const newAverage = oldCount > 0
            ? (oldAverage * oldCount + roundsCompleted) / opponentUser.totalDebates
            : roundsCompleted
          await prisma.user.update({
            where: { id: debate.opponentId },
            data: { averageRounds: newAverage },
          })
        }
      }
    } else if (finalWinnerId === debate.opponentId) {
      if (debate.opponentId) {
        await prisma.user.update({
          where: { id: debate.opponentId },
          data: {
            debatesWon: { increment: 1 },
            totalDebates: { increment: 1 },
            eloRating: { increment: opponentEloChange },
            totalScore: { increment: opponentTotalScore },
            totalMaxScore: { increment: maxScoreForDebate },
          },
        })
        // Update average rounds
        const opponentUser = await prisma.user.findUnique({
          where: { id: debate.opponentId },
          select: { totalDebates: true, averageRounds: true },
        })
        if (opponentUser) {
          const oldCount = opponentUser.totalDebates - 1
          const oldAverage = opponentUser.averageRounds || 0
          const newAverage = oldCount > 0
            ? (oldAverage * oldCount + roundsCompleted) / opponentUser.totalDebates
            : roundsCompleted
          await prisma.user.update({
            where: { id: debate.opponentId },
            data: { averageRounds: newAverage },
          })
        }
      }
      await prisma.user.update({
        where: { id: debate.challengerId },
        data: {
          debatesLost: { increment: 1 },
          totalDebates: { increment: 1 },
          eloRating: { increment: challengerEloChange },
          totalScore: { increment: challengerTotalScore },
          totalMaxScore: { increment: maxScoreForDebate },
        },
      })
      // Update average rounds
      const challengerUser = await prisma.user.findUnique({
        where: { id: debate.challengerId },
        select: { totalDebates: true, averageRounds: true },
      })
      if (challengerUser) {
        const oldCount = challengerUser.totalDebates - 1
        const oldAverage = challengerUser.averageRounds || 0
        const newAverage = oldCount > 0
          ? (oldAverage * oldCount + roundsCompleted) / challengerUser.totalDebates
          : roundsCompleted
        await prisma.user.update({
          where: { id: debate.challengerId },
          data: { averageRounds: newAverage },
        })
      }
    } else {
      // Tie
      await prisma.user.update({
        where: { id: debate.challengerId },
        data: {
          debatesTied: { increment: 1 },
          totalDebates: { increment: 1 },
          eloRating: { increment: challengerEloChange },
          totalScore: { increment: challengerTotalScore },
          totalMaxScore: { increment: maxScoreForDebate },
        },
      })
      // Update average rounds
      const challengerUser = await prisma.user.findUnique({
        where: { id: debate.challengerId },
        select: { totalDebates: true, averageRounds: true },
      })
      if (challengerUser) {
        const oldCount = challengerUser.totalDebates - 1
        const oldAverage = challengerUser.averageRounds || 0
        const newAverage = oldCount > 0
          ? (oldAverage * oldCount + roundsCompleted) / challengerUser.totalDebates
          : roundsCompleted
        await prisma.user.update({
          where: { id: debate.challengerId },
          data: { averageRounds: newAverage },
        })
      }

      if (debate.opponentId) {
        await prisma.user.update({
          where: { id: debate.opponentId },
          data: {
            debatesTied: { increment: 1 },
            totalDebates: { increment: 1 },
            eloRating: { increment: opponentEloChange },
            totalScore: { increment: opponentTotalScore },
            totalMaxScore: { increment: maxScoreForDebate },
          },
        })
        // Update average rounds
        const opponentUser = await prisma.user.findUnique({
          where: { id: debate.opponentId },
          select: { totalDebates: true, averageRounds: true },
        })
        if (opponentUser) {
          const oldCount = opponentUser.totalDebates - 1
          const oldAverage = opponentUser.averageRounds || 0
          const newAverage = oldCount > 0
            ? (oldAverage * oldCount + roundsCompleted) / opponentUser.totalDebates
            : roundsCompleted
          await prisma.user.update({
            where: { id: debate.opponentId },
            data: { averageRounds: newAverage },
          })
        }
      }
    }

    // Award onboarding coin reward for first-debate completion
    if ((debate as any).isOnboardingDebate) {
      // Find the human participant (not the AI)
      const humanId = debate.challenger && !debate.challenger.isAI
        ? debate.challengerId
        : debate.opponentId && debate.opponent && !debate.opponent.isAI
          ? debate.opponentId
          : null
      if (humanId) {
        try {
          const humanUser = await prisma.user.findUnique({
            where: { id: humanId },
            select: { coins: true },
          })
          if (humanUser) {
            await prisma.$transaction([
              prisma.user.update({
                where: { id: humanId },
                data: { coins: { increment: 50 } },
              }),
              prisma.coinTransaction.create({
                data: {
                  userId: humanId,
                  type: 'ONBOARDING_REWARD',
                  status: 'COMPLETED',
                  amount: 50,
                  balanceAfter: humanUser.coins + 50,
                  description: 'Welcome bonus for completing your first debate!',
                },
              }),
            ])
          }
        } catch (err) {
          console.error('[Verdict] Onboarding reward failed:', err)
        }
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
    const challengerPushType = finalWinnerId === debate.challengerId ? 'DEBATE_WON'
      : finalWinnerId === debate.opponentId ? 'DEBATE_LOST' : 'DEBATE_TIED'
    const challengerPushTitle = finalWinnerId === debate.challengerId ? 'You Won!'
      : finalWinnerId === debate.opponentId ? 'You Lost' : 'Debate Tied'
    sendPushNotificationForNotification(
      debate.challengerId, challengerPushType, challengerPushTitle,
      `The verdict for "${debate.topic}" is ready!`, debateId
    ).catch(() => {})

    if (debate.opponentId) {
      const opponentPushType = finalWinnerId === debate.opponentId ? 'DEBATE_WON'
        : finalWinnerId === debate.challengerId ? 'DEBATE_LOST' : 'DEBATE_TIED'
      const opponentPushTitle = finalWinnerId === debate.opponentId ? 'You Won!'
        : finalWinnerId === debate.challengerId ? 'You Lost' : 'Debate Tied'
      sendPushNotificationForNotification(
        debate.opponentId, opponentPushType, opponentPushTitle,
        `The verdict for "${debate.topic}" is ready!`, debateId
      ).catch(() => {})
    }

    // Update user analytics for average rounds (non-blocking)
    updateUserAnalyticsOnDebateComplete(debate.challengerId, debate.totalRounds).catch(err => {
      console.error('Failed to update challenger analytics:', err)
    })
    if (debate.opponentId) {
      updateUserAnalyticsOnDebateComplete(debate.opponentId, debate.totalRounds).catch(err => {
        console.error('Failed to update opponent analytics:', err)
      })
    }

    // Check if this is a tournament debate and update tournament match
    // This is non-blocking - we don't want tournament updates to break verdict generation
    import('@/lib/tournaments/match-completion')
      .then(async (module) => {
        try {
          await module.updateTournamentMatchOnDebateComplete(debateId)
          console.log(`[Generate Verdicts] Tournament match updated for debate ${debateId}`)
        } catch (error: any) {
          console.error(`[Generate Verdicts] Error updating tournament match:`, error)
          // Don't throw - tournament updates shouldn't break verdict generation
        }
      })
      .catch((importError: any) => {
        // If import fails, it's not a tournament debate - that's fine
        console.log(`[Generate Verdicts] Not a tournament debate or import failed:`, importError.message)
      })

    // Process belt transfer if belt is at stake
    // This is non-blocking - we don't want belt transfers to break verdict generation
    if (finalWinnerId && debate.hasBeltAtStake) {
      import('@/lib/belts/core')
        .then(async (module) => {
          try {
            await module.processBeltTransferAfterDebate(debateId, finalWinnerId)
            console.log(`[Generate Verdicts] Belt transfer processed for debate ${debateId}`)
          } catch (error: any) {
            console.error(`[Generate Verdicts] Error processing belt transfer:`, error)
            // Don't throw - belt transfers shouldn't break verdict generation
          }
        })
        .catch((importError: any) => {
          // If import fails, belt system might not be enabled - that's fine
          console.log(`[Generate Verdicts] Belt system not available or import failed:`, importError.message)
        })
    }

    return {
      success: true,
      debate: updatedDebate,
      verdicts: verdicts.length,
    }
  } catch (error: any) {
    console.error('[Generate Verdicts] Error:', error)
    throw error
  }
}

