/**
 * King of the Hill Tournament - AI Verdict Generation
 * Generates verdicts for GROUP debates with multiple participants
 * Uses 3 judges, scores each participant individually (0-100 per judge, 0-300 total)
 */

import { prisma } from '@/lib/db/prisma'
import { generateVerdict, type DebateContext } from '@/lib/ai/deepseek'
import { createDeepSeekClient } from '@/lib/ai/deepseek'
import { logApiUsage } from '@/lib/ai/api-tracking'

export interface KingOfTheHillVerdictResult {
  participantScores: Array<{
    userId: string
    username: string
    score: number // 0-100 from this judge
  }>
  eliminationReasoning: string // Explanation for bottom 25%
  reasoning: string // Full reasoning from judge
}

/**
 * Generate verdict for one judge in a King of the Hill round
 * Scores all participants individually
 */
async function generateKingOfTheHillVerdict(
  judgeSystemPrompt: string,
  topic: string,
  participants: Array<{
    userId: string
    username: string
    submission: string | null
  }>,
  roundNumber: number
): Promise<KingOfTheHillVerdictResult> {
  const client = await createDeepSeekClient()
  const startTime = Date.now()

  // Build participant list with submissions
  const participantList = participants
    .map((p, index) => {
      const submission = p.submission || '[No submission]'
      return `${index + 1}. ${p.username}:\n${submission}\n`
    })
    .join('\n---\n\n')

  // Calculate how many to eliminate (bottom 25%)
  const eliminateCount = Math.max(1, Math.ceil(participants.length * 0.25))

  // Build prompt for King of the Hill format
  const prompt = `You are judging a King of the Hill tournament round.

TOPIC: ${topic}
ROUND: ${roundNumber}

PARTICIPANTS AND THEIR SUBMISSIONS:
${participantList}

YOUR TASK:
1. Score each participant individually on a scale of 0-100 based on:
   - Quality of argument
   - Logic and reasoning
   - Evidence and support
   - Persuasiveness
   - Clarity and structure

2. Identify the bottom 25% (${eliminateCount} participant(s)) who should be eliminated.

3. Provide elimination reasoning explaining why the bottom performers scored lower.

RESPOND IN THE FOLLOWING JSON FORMAT:
{
  "scores": [
    {"username": "username1", "score": 85},
    {"username": "username2", "score": 72},
    {"username": "username3", "score": 80}
  ],
  "eliminationReasoning": "Explanation of why the bottom 25% were eliminated, focusing on argument quality, logic, evidence, and persuasiveness.",
  "reasoning": "Your overall analysis of all participants' arguments and why you scored them as you did."
}

IMPORTANT: 
- Score each participant from 0-100
- Ensure all usernames match exactly (case-sensitive)
- Identify exactly ${eliminateCount} participant(s) for elimination
- Respond ONLY with valid JSON. Do not include any text outside the JSON object.`

  try {
    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: judgeSystemPrompt,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    })

    const responseTime = Date.now() - startTime
    const usage = completion.usage

    // Log API usage
    await logApiUsage({
      provider: 'deepseek',
      endpoint: 'chat/completions',
      model: 'deepseek-chat',
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
      success: true,
      responseTime,
    })

    const responseText = completion.choices[0].message.content || '{}'

    // Clean response (remove markdown code blocks if present)
    let cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    // Try to extract JSON object if there's extra text
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      cleanedResponse = jsonMatch[0]
    }

    // Fix common JSON issues: duplicate keys, trailing commas
    cleanedResponse = cleanedResponse
      .replace(/,\s*}/g, '}') // Remove trailing commas
      .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
      .replace(/"username":\s*"username":/g, '"username":') // Fix duplicate username key

    try {
      const verdict = JSON.parse(cleanedResponse)

      // Validate and map scores - handle both correct format and malformed format
      const participantScores = participants.map((p) => {
        // Try to find score entry - handle both correct and malformed formats
        let scoreEntry = verdict.scores?.find(
          (s: any) => s.username === p.username
        )
        
        // If not found, try to find by index (in case of malformed JSON)
        if (!scoreEntry && verdict.scores && Array.isArray(verdict.scores)) {
          const index = participants.findIndex(part => part.username === p.username)
          if (index >= 0 && index < verdict.scores.length) {
            scoreEntry = verdict.scores[index]
          }
        }
        
        // Extract score - handle malformed entries with duplicate keys
        let score = 0
        if (scoreEntry) {
          if (typeof scoreEntry.score === 'number') {
            score = scoreEntry.score
          } else if (scoreEntry.username && typeof scoreEntry[scoreEntry.username] === 'number') {
            // Handle weird malformed entries
            score = scoreEntry[scoreEntry.username]
          }
        }

        // Ensure score is between 0-100
        const clampedScore = Math.max(0, Math.min(100, Math.round(score)))

        return {
          userId: p.userId,
          username: p.username,
          score: clampedScore,
        }
      })

      return {
        participantScores,
        eliminationReasoning: verdict.eliminationReasoning || 'No reasoning provided',
        reasoning: verdict.reasoning || verdict.eliminationReasoning || 'No reasoning provided',
      }
    } catch (parseError) {
      console.error('[King of the Hill Verdict] Failed to parse AI response:', parseError)
      console.error('[King of the Hill Verdict] Response text:', cleanedResponse)

      // Fallback: Return default scores
      return {
        participantScores: participants.map((p) => ({
          userId: p.userId,
          username: p.username,
          score: 50, // Default score
        })),
        eliminationReasoning: 'Failed to parse AI response',
        reasoning: 'AI response parsing failed',
      }
    }
  } catch (error: any) {
    console.error('[King of the Hill Verdict] Error generating verdict:', error)

    // Log API usage failure
    await logApiUsage({
      provider: 'deepseek',
      endpoint: 'chat/completions',
      model: 'deepseek-chat',
      success: false,
      responseTime: Date.now() - startTime,
    })

    throw error
  }
}

/**
 * Generate verdicts for a King of the Hill round
 * Uses exactly 3 judges, scores all participants, eliminates bottom 25%
 */
export async function generateKingOfTheHillRoundVerdicts(
  debateId: string,
  tournamentId: string,
  roundNumber: number
): Promise<void> {
  try {
    console.log(
      `[King of the Hill Verdicts] Generating verdicts for debate ${debateId}, tournament ${tournamentId}, round ${roundNumber}`
    )

    // Get debate with all participants and their submissions
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
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
          orderBy: [
            { round: 'asc' },
            { createdAt: 'asc' },
          ],
        },
      },
    })

    if (!debate) {
      throw new Error('Debate not found')
    }

    if (debate.challengeType !== 'GROUP') {
      throw new Error('King of the Hill verdicts can only be generated for GROUP debates')
    }

    // Get all participants and their submissions
    const participants = debate.participants
      .filter((dp) => dp.status === 'ACTIVE')
      .map((dp) => {
        // Get submission for this participant (round 1, single submission)
        const submission = debate.statements.find(
          (s) => s.authorId === dp.userId && s.round === 1
        )

        return {
          userId: dp.userId,
          username: dp.user.username,
          participantId: dp.id,
          submission: submission?.content || null,
        }
      })

    if (participants.length < 2) {
      throw new Error(`Not enough participants for verdict generation. Got ${participants.length}, need at least 2`)
    }

    // Get exactly 3 random judges
    const allJudges = await prisma.judge.findMany()

    if (allJudges.length === 0) {
      throw new Error('No judges available. Please seed the database with judges.')
    }

    if (allJudges.length < 3) {
      console.warn(
        `[King of the Hill Verdicts] Only ${allJudges.length} judges available, using all available judges`
      )
    }

    const selectedJudges = allJudges
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(3, allJudges.length))

    console.log(
      `[King of the Hill Verdicts] Selected ${selectedJudges.length} judges: ${selectedJudges.map((j) => j.name).join(', ')}`
    )

    // Generate verdicts from each judge in parallel
    const verdictResults = await Promise.all(
      selectedJudges.map(async (judge) => {
        try {
          console.log(
            `[King of the Hill Verdicts] Generating verdict from judge: ${judge.name} (${judge.id})`
          )
          const verdict = await generateKingOfTheHillVerdict(
            judge.systemPrompt,
            debate.topic,
            participants,
            roundNumber
          )
          console.log(
            `[King of the Hill Verdicts] ✅ Verdict from ${judge.name} generated successfully`
          )
          return {
            judgeId: judge.id,
            judgeName: judge.name,
            verdict,
          }
        } catch (error: any) {
          console.error(
            `[King of the Hill Verdicts] ❌ Error generating verdict from ${judge.name}:`,
            error
          )
          throw error
        }
      })
    )

    // Calculate total scores for each participant (sum of 3 judges = 0-300)
    const participantTotalScores = participants.map((p) => {
      const scores = verdictResults.map((vr) => {
        const participantScore = vr.verdict.participantScores.find(
          (ps) => ps.userId === p.userId
        )
        return participantScore?.score || 0
      })

      const totalScore = scores.reduce((sum, score) => sum + score, 0)

      return {
        userId: p.userId,
        username: p.username,
        participantId: p.participantId,
        scores, // Individual judge scores [0-100, 0-100, 0-100]
        totalScore, // Sum of all judges [0-300]
      }
    })

    // Rank participants by total score (highest first)
    const rankedParticipants = participantTotalScores.sort(
      (a, b) => b.totalScore - a.totalScore
    )

    // Calculate how many to eliminate (bottom 25%)
    const eliminateCount = Math.max(1, Math.ceil(participants.length * 0.25))
    const eliminatedParticipants = rankedParticipants.slice(-eliminateCount)
    const survivingParticipants = rankedParticipants.slice(0, -eliminateCount)

    console.log(
      `[King of the Hill Verdicts] Round ${roundNumber} results:`,
      `Eliminating ${eliminatedParticipants.length} participant(s),`,
      `${survivingParticipants.length} surviving`
    )

    // Combine elimination reasoning from all judges
    const combinedEliminationReasoning = verdictResults
      .map((vr) => `${vr.judgeName}: ${vr.verdict.eliminationReasoning}`)
      .join('\n\n')

    // Create Verdict records (one per judge)
    // Store scores in reasoning field in format: username: score/100
    for (const vr of verdictResults) {
      const reasoningText = vr.verdict.participantScores
        .map((ps) => `${ps.username}: ${ps.score}/100`)
        .join('\n')

      const fullReasoning = `${reasoningText}\n\n---\n\nElimination Reasoning: ${vr.verdict.eliminationReasoning}\n\nFull Analysis: ${vr.verdict.reasoning}`

      await prisma.verdict.create({
        data: {
          debateId: debate.id,
          judgeId: vr.judgeId,
          decision: 'TIE', // GROUP debates don't have a single winner, use TIE
          reasoning: fullReasoning,
          challengerScore: null, // Not applicable for GROUP debates
          opponentScore: null, // Not applicable for GROUP debates
          winnerId: null, // Not applicable for GROUP debates
        },
      })
    }

    // Update participant statuses and scores
    // Get tournament participants
    const tournamentParticipants = await prisma.tournamentParticipant.findMany({
      where: {
        tournamentId,
        userId: {
          in: participants.map((p) => p.userId),
        },
      },
    })

    // Update eliminated participants
    for (const eliminated of eliminatedParticipants) {
      const tournamentParticipant = tournamentParticipants.find(
        (tp) => tp.userId === eliminated.userId
      )

      if (tournamentParticipant) {
        // Get current cumulative score
        const currentCumulative = tournamentParticipant.cumulativeScore || 0

        await prisma.tournamentParticipant.update({
          where: { id: tournamentParticipant.id },
          data: {
            status: 'ELIMINATED',
            eliminatedAt: new Date(),
            eliminationRound: roundNumber,
            eliminationReason: combinedEliminationReasoning,
            cumulativeScore: currentCumulative + eliminated.totalScore, // Add round score
          },
        })
      }
    }

    // Update surviving participants (add to cumulative score, mark as ACTIVE)
    for (const survivor of survivingParticipants) {
      const tournamentParticipant = tournamentParticipants.find(
        (tp) => tp.userId === survivor.userId
      )

      if (tournamentParticipant) {
        // Get current cumulative score
        const currentCumulative = tournamentParticipant.cumulativeScore || 0

        await prisma.tournamentParticipant.update({
          where: { id: tournamentParticipant.id },
          data: {
            status: 'ACTIVE',
            cumulativeScore: currentCumulative + survivor.totalScore, // Add round score
          },
        })
      }
    }

    // Update debate status to VERDICT_READY
    await prisma.debate.update({
      where: { id: debateId },
      data: {
        status: 'VERDICT_READY',
      },
    })

    // Update tournament match status to COMPLETED
    const match = await prisma.tournamentMatch.findFirst({
      where: { debateId },
    })

    if (match) {
      await prisma.tournamentMatch.update({
        where: { id: match.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      })
    }

    console.log(
      `[King of the Hill Verdicts] ✅ Verdicts generated and participants updated for round ${roundNumber}`
    )
  } catch (error: any) {
    console.error('[King of the Hill Verdicts] Error:', error)
    throw error
  }
}
