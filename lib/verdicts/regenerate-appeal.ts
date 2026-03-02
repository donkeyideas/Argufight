import { prisma } from '@/lib/db/prisma'
import { generateVerdict, type DebateContext, createDeepSeekClient } from '@/lib/ai/deepseek'
import { JUDGE_PERSONALITIES } from '@/lib/ai/judges'
import { logApiUsage } from '@/lib/ai/api-tracking'
import { sendPushNotificationForNotification } from '@/lib/notifications/push-notifications'

/**
 * Generate an approval reason when an appeal changes the verdict
 */
async function generateAppealApprovalReason(
  debate: any,
  newVerdicts: any[],
  appealReason: string
): Promise<string> {
  const client = await createDeepSeekClient()
  const startTime = Date.now()

  const verdictsSummary = newVerdicts
    .map((v, i) => `Judge ${i + 1}: ${v.reasoning}`)
    .join('\n\n')

  const originalWinner = debate.originalWinnerId === debate.challengerId
    ? debate.challenger.username
    : debate.opponent?.username || 'the original winner'

  const newWinner = debate.winnerId === debate.challengerId
    ? debate.challenger.username
    : debate.opponent?.username || 'the same participant'

  const prompt = `You are an AI assistant explaining why an appeal successfully changed a debate verdict.

DEBATE CONTEXT:
- Topic: ${debate.topic}
- Original Winner: ${originalWinner}
- New Verdict Winner: ${newWinner}
- User's Appeal Reason: "${appealReason}"

NEW JUDGES' VERDICTS AND REASONING:
${verdictsSummary}

TASK:
Generate a clear, respectful explanation (2-3 sentences) for why the appeal successfully changed the outcome. The explanation should:
1. Acknowledge that different judges reviewed the appeal
2. Explain that the new judges reached a different conclusion
3. Reference key points from the new judges' reasoning that supported the appeal
4. Be respectful and constructive

Respond with ONLY the explanation text. Do not include any JSON formatting or additional commentary.`

  try {
    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that explains appeal outcomes clearly and respectfully.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
      max_tokens: 300,
    })

    const responseTime = Date.now() - startTime
    const usage = completion.usage

    await logApiUsage({
      provider: 'deepseek',
      endpoint: 'chat/completions',
      model: 'deepseek-chat',
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
      debateId: debate.id,
      success: true,
      responseTime,
    })

    const reasoning = completion.choices[0].message.content?.trim() || 
      'After review by different judges, the original verdict has been overturned. The new judges determined that your appeal arguments were valid, and the outcome has been changed accordingly.'

    return reasoning
  } catch (error: any) {
    const responseTime = Date.now() - startTime
    
    await logApiUsage({
      provider: 'deepseek',
      endpoint: 'chat/completions',
      model: 'deepseek-chat',
      debateId: debate.id,
      success: false,
      errorMessage: error.message || 'Unknown error',
      responseTime,
    })
    
    return 'After review by different judges, the original verdict has been overturned. The new judges determined that your appeal arguments were valid, and the outcome has been changed accordingly.'
  }
}

/**
 * Generate a rejection reason when an appeal doesn't change the verdict
 */
async function generateAppealRejectionReason(
  debate: any,
  newVerdicts: any[],
  appealReason: string
): Promise<string> {
  const client = await createDeepSeekClient()
  const startTime = Date.now()

  const verdictsSummary = newVerdicts
    .map((v, i) => `Judge ${i + 1}: ${v.reasoning}`)
    .join('\n\n')

  const originalWinner = debate.originalWinnerId === debate.challengerId
    ? debate.challenger.username
    : debate.opponent?.username || 'the original winner'

  const newWinner = debate.winnerId === debate.challengerId
    ? debate.challenger.username
    : debate.opponent?.username || 'the same participant'

  const prompt = `You are an AI assistant explaining why an appeal did not change a debate verdict.

DEBATE CONTEXT:
- Topic: ${debate.topic}
- Original Winner: ${originalWinner}
- New Verdict Winner: ${newWinner}
- User's Appeal Reason: "${appealReason}"

NEW JUDGES' VERDICTS AND REASONING:
${verdictsSummary}

TASK:
Generate a clear, respectful explanation (2-3 sentences) for why the appeal did not change the outcome. The explanation should:
1. Acknowledge that different judges reviewed the appeal
2. Explain that the new judges reached the same conclusion
3. Reference key points from the new judges' reasoning
4. Be respectful and constructive

Respond with ONLY the explanation text. Do not include any JSON formatting or additional commentary.`

  try {
    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that explains appeal outcomes clearly and respectfully.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
      max_tokens: 300,
    })

    const responseTime = Date.now() - startTime
    const usage = completion.usage

    await logApiUsage({
      provider: 'deepseek',
      endpoint: 'chat/completions',
      model: 'deepseek-chat',
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
      debateId: debate.id,
      success: true,
      responseTime,
    })

    const reasoning = completion.choices[0].message.content?.trim() || 
      'After review by different judges, the original verdict was upheld. The new judges reached the same conclusion based on the arguments presented.'

    return reasoning
  } catch (error: any) {
    const responseTime = Date.now() - startTime
    
    await logApiUsage({
      provider: 'deepseek',
      endpoint: 'chat/completions',
      model: 'deepseek-chat',
      debateId: debate.id,
      success: false,
      errorMessage: error.message || 'Unknown error',
      responseTime,
    })
    
    return 'After review by different judges, the original verdict was upheld. The new judges reached the same conclusion based on the arguments presented.'
  }
}

/**
 * Regenerate verdicts for an appealed debate
 * This function can be called directly without HTTP fetch
 */
export async function regenerateAppealVerdicts(debateId: string) {
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
          },
        },
        opponent: {
          select: {
            id: true,
            username: true,
            eloRating: true,
          },
        },
        statements: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        verdicts: {
          include: {
            judge: {
              select: { id: true },
            },
          },
        },
      },
    })

    if (!debate) {
      throw new Error('Debate not found')
    }

    // Validation: Must be in APPEALED status
    if (debate.status !== 'APPEALED') {
      throw new Error(`Debate is not in appealed status: ${debate.status}`)
    }

    // Get original judge IDs to exclude them
    const originalJudgeIds = debate.verdicts.map(v => v.judge.id)

    // Get all judges except the original ones
    const availableJudges = await prisma.judge.findMany({
      where: {
        NOT: {
          id: {
            in: originalJudgeIds,
          },
        },
      },
    })

    // Select 3 random judges (prefer different ones, but use all if needed)
    let selectedJudges
    if (availableJudges.length >= 3) {
      selectedJudges = availableJudges
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
    } else {
      // If we don't have enough different judges, use all judges
      const allJudges = await prisma.judge.findMany()
      selectedJudges = allJudges
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(3, allJudges.length))
    }

    // Update appeal status to PROCESSING
    await prisma.debate.update({
      where: { id: debateId },
      data: {
        appealStatus: 'PROCESSING',
      },
    })

    // Determine if debate is complete
    // For appealed debates, they were already completed, so check round completion
    const isComplete = debate.currentRound >= debate.totalRounds

    // Build debate context
    const debateContext: DebateContext = {
      topic: debate.topic,
      challengerPosition: debate.challengerPosition,
      opponentPosition: debate.opponentPosition,
      challengerName: debate.challenger.username,
      opponentName: debate.opponent?.username || 'Unknown',
      statements: debate.statements.map(s => ({
        round: s.round,
        author: s.author.username,
        position: s.author.id === debate.challengerId ? debate.challengerPosition : debate.opponentPosition,
        content: s.content,
      })),
      currentRound: debate.currentRound,
      totalRounds: debate.totalRounds,
      isComplete,
    }

    // Generate verdicts from new judges in parallel (faster)
    console.log(`[Regenerate Appeal] Generating ${selectedJudges.length} new verdicts in parallel for debate ${debateId}`)
    
    const verdictPromises = selectedJudges.map(async (judge) => {
      try {
        console.log(`[Regenerate Appeal] Starting verdict for judge: ${judge.name} (${judge.id})`)
        const verdictResult = await generateVerdict(
          judge.systemPrompt,
          debateContext,
          { userId: debate.challengerId, debateId }
        )
        console.log(`[Regenerate Appeal] ✅ Generated verdict from ${judge.name}:`, verdictResult.winner)

        // CRITICAL FIX: Derive winner from scores to ensure consistency
        // The AI might give inconsistent winner decisions vs scores, especially for expired debates
        // We derive the decision from scores (the primary data) to ensure they always match
        const scoreDifference = Math.abs(verdictResult.challengerScore - verdictResult.opponentScore)
        const tieThreshold = 1 // Consider it a tie if scores are within 1 point
        
        let derivedWinner: 'CHALLENGER' | 'OPPONENT' | 'TIE'
        if (scoreDifference < tieThreshold) {
          derivedWinner = 'TIE'
        } else if (verdictResult.challengerScore > verdictResult.opponentScore) {
          derivedWinner = 'CHALLENGER'
        } else {
          derivedWinner = 'OPPONENT'
        }

        // Log if AI's winner doesn't match derived winner (for debugging)
        if (verdictResult.winner !== derivedWinner) {
          console.warn(`[Regenerate Appeal] ⚠️ AI winner mismatch for ${judge.name}:`, {
            aiWinner: verdictResult.winner,
            derivedWinner,
            challengerScore: verdictResult.challengerScore,
            opponentScore: verdictResult.opponentScore,
            debateId
          })
        }

        // Determine winner from derived verdict
        let winnerId: string | null = null
        if (derivedWinner === 'CHALLENGER') {
          winnerId = debate.challengerId
        } else if (derivedWinner === 'OPPONENT' && debate.opponentId) {
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

        // Save verdict
        const verdict = await prisma.verdict.create({
          data: {
            debateId,
            judgeId: judge.id,
            decision,
            reasoning: verdictResult.reasoning,
            challengerScore: verdictResult.challengerScore,
            opponentScore: verdictResult.opponentScore,
            winnerId,
          },
        })

        return verdict
      } catch (error: any) {
        console.error(`[Regenerate Appeal] ❌ Failed to generate verdict from judge ${judge.name}:`, {
          judgeId: judge.id,
          error: error.message,
          stack: error.stack
        })
        return null
      }
    })

    // Wait for all verdicts to complete (in parallel)
    const verdictResults = await Promise.all(verdictPromises)
    const newVerdicts = verdictResults.filter((v): v is NonNullable<typeof v> => v !== null)

    if (newVerdicts.length === 0) {
      // If all verdicts failed, set status to DENIED
      await prisma.debate.update({
        where: { id: debateId },
        data: {
          appealStatus: 'DENIED',
        },
      })
      throw new Error('Failed to generate new verdicts')
    }

    // Calculate scores from new verdicts
    const challengerNewScore = newVerdicts.reduce((sum, v) => sum + (v.challengerScore ?? 0), 0)
    const opponentNewScore = newVerdicts.reduce((sum, v) => sum + (v.opponentScore ?? 0), 0)

    // Determine overall winner based on total score (not majority vote)
    // The person with the higher total score wins
    let finalWinnerId: string | null = null
    const scoreDifference = Math.abs(challengerNewScore - opponentNewScore)
    const tieThreshold = 5 // Consider it a tie if scores are within 5 points

    if (scoreDifference < tieThreshold) {
      // Scores are too close, it's a tie
      finalWinnerId = null
    } else if (challengerNewScore > opponentNewScore) {
      finalWinnerId = debate.challengerId
    } else if (opponentNewScore > challengerNewScore && debate.opponentId) {
      finalWinnerId = debate.opponentId
    }
    // If scores are equal or too close, winnerId remains null (tie)
    const maxScoreForDebate = newVerdicts.length * 100

    // Calculate scores from original verdicts (to subtract)
    const challengerOriginalScore = debate.verdicts.reduce((sum, v) => sum + (v.challengerScore ?? 0), 0)
    const opponentOriginalScore = debate.verdicts.reduce((sum, v) => sum + (v.opponentScore ?? 0), 0)
    const originalMaxScore = debate.verdicts.length * 100

    // Calculate score differences
    const challengerScoreDiff = challengerNewScore - challengerOriginalScore
    const opponentScoreDiff = opponentNewScore - opponentOriginalScore
    const maxScoreDiff = maxScoreForDebate - originalMaxScore

    // Calculate ELO changes only if verdict differs from original
    const originalWinnerId = debate.originalWinnerId
    const verdictFlipped = originalWinnerId !== finalWinnerId

    // Generate rejection/approval reason (use fallback immediately, generate AI reason in background)
    let appealRejectionReason: string | null = null
    
    if (!verdictFlipped) {
      // Appeal denied - use fallback immediately
      appealRejectionReason = 'After review by different judges, the original verdict was upheld. The new judges reached the same conclusion based on the arguments presented.'
      
      // Optionally generate AI reason in background (don't wait)
      if (debate.appealReason) {
        generateAppealRejectionReason(debate, newVerdicts, debate.appealReason)
          .then(reason => {
            prisma.debate.update({
              where: { id: debateId },
              data: { appealRejectionReason: reason },
            }).catch(err => console.error('Failed to update appeal reason:', err))
          })
          .catch(error => {
            console.error('Failed to generate appeal rejection reason:', error)
          })
      }
    } else if (verdictFlipped && debate.appealReason) {
      // Appeal approved - use fallback immediately
      appealRejectionReason = 'After review by different judges, the original verdict has been overturned. The new judges determined that your appeal arguments were valid, and the outcome has been changed accordingly.'
      
      // Optionally generate AI reason in background (don't wait)
      generateAppealApprovalReason(debate, newVerdicts, debate.appealReason)
        .then(reason => {
          prisma.debate.update({
            where: { id: debateId },
            data: { appealRejectionReason: reason },
          }).catch(err => console.error('Failed to update appeal reason:', err))
        })
        .catch(error => {
          console.error('Failed to generate appeal approval reason:', error)
        })
    }

    let challengerEloChange = 0
    let opponentEloChange = 0

    if (verdictFlipped && finalWinnerId) {
      // Recalculate ELO based on new verdict
      const challengerElo = debate.challenger.eloRating
      const opponentElo = debate.opponent?.eloRating || 1200

      // Calculate ELO change
      const kFactor = 32
      const expectedChallenger = 1 / (1 + Math.pow(10, (opponentElo - challengerElo) / 400))
      const expectedOpponent = 1 - expectedChallenger

      let challengerResult = 0.5 // Tie
      let opponentResult = 0.5

      if (finalWinnerId === debate.challengerId) {
        challengerResult = 1
        opponentResult = 0
      } else if (finalWinnerId === debate.opponentId) {
        challengerResult = 0
        opponentResult = 1
      }

      challengerEloChange = Math.round(kFactor * (challengerResult - expectedChallenger))
      opponentEloChange = Math.round(kFactor * (opponentResult - expectedOpponent))

      // Get original winner to determine what stats to adjust
      const originalWinnerId = debate.originalWinnerId
      
      // Update user ELO and stats
      // First, reverse the original stats (to avoid double-counting)
      if (originalWinnerId === debate.challengerId) {
        await prisma.user.update({
          where: { id: debate.challengerId },
          data: {
            debatesWon: { decrement: 1 },
            totalScore: { decrement: challengerOriginalScore },
            totalMaxScore: { decrement: originalMaxScore },
          },
        })
        if (debate.opponentId) {
          await prisma.user.update({
            where: { id: debate.opponentId },
            data: {
              debatesLost: { decrement: 1 },
              totalScore: { decrement: opponentOriginalScore },
              totalMaxScore: { decrement: originalMaxScore },
            },
          })
        }
      } else if (originalWinnerId === debate.opponentId) {
        if (debate.opponentId) {
          await prisma.user.update({
            where: { id: debate.opponentId },
            data: {
              debatesWon: { decrement: 1 },
              totalScore: { decrement: opponentOriginalScore },
              totalMaxScore: { decrement: originalMaxScore },
            },
          })
        }
        await prisma.user.update({
          where: { id: debate.challengerId },
          data: {
            debatesLost: { decrement: 1 },
            totalScore: { decrement: challengerOriginalScore },
            totalMaxScore: { decrement: originalMaxScore },
          },
        })
      } else {
        await prisma.user.update({
          where: { id: debate.challengerId },
          data: {
            debatesTied: { decrement: 1 },
            totalScore: { decrement: challengerOriginalScore },
            totalMaxScore: { decrement: originalMaxScore },
          },
        })
        if (debate.opponentId) {
          await prisma.user.update({
            where: { id: debate.opponentId },
            data: {
              debatesTied: { decrement: 1 },
              totalScore: { decrement: opponentOriginalScore },
              totalMaxScore: { decrement: originalMaxScore },
            },
          })
        }
      }

      // Now apply the new verdict stats
      if (finalWinnerId === debate.challengerId) {
        await prisma.user.update({
          where: { id: debate.challengerId },
          data: {
            eloRating: { increment: challengerEloChange },
            debatesWon: { increment: 1 },
            totalScore: { increment: challengerNewScore },
            totalMaxScore: { increment: maxScoreForDebate },
          },
        })
        if (debate.opponentId) {
          await prisma.user.update({
            where: { id: debate.opponentId },
            data: {
              eloRating: { increment: opponentEloChange },
              debatesLost: { increment: 1 },
              totalScore: { increment: opponentNewScore },
              totalMaxScore: { increment: maxScoreForDebate },
            },
          })
        }
      } else if (finalWinnerId === debate.opponentId) {
        await prisma.user.update({
          where: { id: debate.challengerId },
          data: {
            eloRating: { increment: challengerEloChange },
            debatesLost: { increment: 1 },
            totalScore: { increment: challengerNewScore },
            totalMaxScore: { increment: maxScoreForDebate },
          },
        })
        if (debate.opponentId) {
          await prisma.user.update({
            where: { id: debate.opponentId },
            data: {
              eloRating: { increment: opponentEloChange },
              debatesWon: { increment: 1 },
              totalScore: { increment: opponentNewScore },
              totalMaxScore: { increment: maxScoreForDebate },
            },
          })
        }
      } else {
        // Tie - both users get a tie
        await prisma.user.update({
          where: { id: debate.challengerId },
          data: {
            eloRating: { increment: challengerEloChange },
            debatesTied: { increment: 1 },
            totalScore: { increment: challengerNewScore },
            totalMaxScore: { increment: maxScoreForDebate },
          },
        })
        if (debate.opponentId) {
          await prisma.user.update({
            where: { id: debate.opponentId },
            data: {
              eloRating: { increment: opponentEloChange },
              debatesTied: { increment: 1 },
              totalScore: { increment: opponentNewScore },
              totalMaxScore: { increment: maxScoreForDebate },
            },
          })
        }
      }
    }

    // Update debate with new verdict
    await prisma.debate.update({
      where: { id: debateId },
      data: {
        winnerId: finalWinnerId,
        verdictReached: true,
        verdictDate: new Date(),
        appealStatus: 'RESOLVED',
        status: 'VERDICT_READY',
        challengerEloChange: verdictFlipped ? challengerEloChange : debate.challengerEloChange,
        opponentEloChange: verdictFlipped ? opponentEloChange : debate.opponentEloChange,
        appealRejectionReason,
      },
    })

    // Create notifications for both participants
    const challengerNotificationType = finalWinnerId === debate.challengerId 
      ? 'DEBATE_WON' as const
      : finalWinnerId === debate.opponentId 
        ? 'DEBATE_LOST' as const
        : 'DEBATE_TIED' as const

    const opponentNotificationType = finalWinnerId === debate.opponentId
      ? 'DEBATE_WON' as const
      : finalWinnerId === debate.challengerId
        ? 'DEBATE_LOST' as const
        : 'DEBATE_TIED' as const

    await prisma.notification.createMany({
      data: [
        {
          userId: debate.challengerId,
          type: challengerNotificationType,
          title: 'Appeal Verdict Ready',
          message: `The appeal verdict is ready. ${finalWinnerId === debate.challengerId ? 'You won!' : finalWinnerId === debate.opponentId ? 'You lost.' : 'It\'s a tie!'}`,
          debateId,
        },
        ...(debate.opponentId ? [{
          userId: debate.opponentId,
          type: opponentNotificationType,
          title: 'Appeal Verdict Ready',
          message: `The appeal verdict is ready. ${finalWinnerId === debate.opponentId ? 'You won!' : finalWinnerId === debate.challengerId ? 'You lost.' : 'It\'s a tie!'}`,
          debateId,
        }] : []),
      ],
    })

    // Send push notifications for appeal verdict (non-blocking)
    sendPushNotificationForNotification(
      debate.challengerId, challengerNotificationType, 'Appeal Verdict Ready',
      `The appeal verdict is ready. ${finalWinnerId === debate.challengerId ? 'You won!' : finalWinnerId === debate.opponentId ? 'You lost.' : 'It\'s a tie!'}`,
      debateId
    ).catch(() => {})

    if (debate.opponentId) {
      sendPushNotificationForNotification(
        debate.opponentId, opponentNotificationType, 'Appeal Verdict Ready',
        `The appeal verdict is ready. ${finalWinnerId === debate.opponentId ? 'You won!' : finalWinnerId === debate.challengerId ? 'You lost.' : 'It\'s a tie!'}`,
        debateId
      ).catch(() => {})
    }

    return {
      success: true,
      message: 'New verdict generated successfully',
      verdictFlipped,
    }
  } catch (error: any) {
    console.error('[Regenerate Appeal] Error:', error)
    throw error
  }
}

