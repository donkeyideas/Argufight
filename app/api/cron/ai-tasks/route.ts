import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { generateAIResponse } from '@/lib/ai/ai-user-responses'
import { calculateWordCount, updateUserAnalyticsOnStatement } from '@/lib/utils/analytics'
import { checkInactiveBelts } from '@/lib/belts/core'
import { verifyCronAuth } from '@/lib/auth/cron-auth'

// Combined AI tasks endpoint - handles both auto-accept and response generation
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const results = {
      autoAccept: { accepted: 0, errors: [] as string[] },
      responses: { generated: 0, errors: [] as string[] },
      beltTasks: { inactiveBeltsChecked: 0, expiredChallengesCleaned: 0, errors: [] as string[] },
    }

    // Single query for all AI users (used by both auto-accept and response generation)
    const aiUsers = await prisma.user.findMany({
      where: {
        isAI: true,
        aiPaused: false,
      },
      select: {
        id: true,
        username: true,
        aiPersonality: true,
        aiResponseDelay: true,
      },
    })

    // ===== AUTO-ACCEPT CHALLENGES (round-robin, load-balanced) =====
    try {
      const aiUserIds = aiUsers.map(u => u.id)
      const [allOpenChallenges, activeDebateCounts, totalDebateCounts] = await Promise.all([
        prisma.debate.findMany({
          where: {
            status: 'WAITING',
            challengeType: 'OPEN',
            opponentId: null,
            challenger: { isAI: false },
          },
          include: {
            challenger: { select: { id: true, username: true } },
          },
          orderBy: { createdAt: 'asc' },
        }),
        // Count active debates per AI user for load balancing
        prisma.debate.groupBy({
          by: ['opponentId'],
          where: {
            status: 'ACTIVE',
            opponentId: { in: aiUserIds },
          },
          _count: true,
        }),
        // Count ALL debates per AI user for fair tiebreaking
        prisma.debate.groupBy({
          by: ['opponentId'],
          where: {
            opponentId: { in: aiUserIds },
          },
          _count: true,
        }),
      ])

      // Build load map: AI user id -> active debate count
      const loadMap = new Map<string, number>()
      for (const entry of activeDebateCounts) {
        if (entry.opponentId) loadMap.set(entry.opponentId, entry._count)
      }

      // Build total debates map for tiebreaking
      const totalMap = new Map<string, number>()
      for (const entry of totalDebateCounts) {
        if (entry.opponentId) totalMap.set(entry.opponentId, entry._count)
      }

      // Sort: 1) fewest active debates, 2) fewest total debates (tiebreaker)
      const sortedAiUsers = [...aiUsers].sort((a, b) => {
        const activeDiff = (loadMap.get(a.id) || 0) - (loadMap.get(b.id) || 0)
        if (activeDiff !== 0) return activeDiff
        return (totalMap.get(a.id) || 0) - (totalMap.get(b.id) || 0)
      })

      // Build per-user eligible challenge lists (respecting each user's delay)
      const perUserEligible = new Map<string, Set<string>>()
      for (const aiUser of sortedAiUsers) {
        const delayMs = Math.min(aiUser.aiResponseDelay || 45000, 300000)
        const cutoffTime = new Date(Date.now() - delayMs)
        const ids = new Set(
          allOpenChallenges
            .filter(c => c.challengerId !== aiUser.id && c.createdAt <= cutoffTime)
            .map(c => c.id)
        )
        perUserEligible.set(aiUser.id, ids)
      }

      // Round-robin distribute challenges across AI users
      const assignments = new Map<string, string[]>()
      const claimed = new Set<string>()
      const maxPerUser = 5

      for (const aiUser of sortedAiUsers) {
        assignments.set(aiUser.id, [])
      }

      let assigned = true
      while (assigned) {
        assigned = false
        for (const aiUser of sortedAiUsers) {
          const userAssignments = assignments.get(aiUser.id)!
          if (userAssignments.length >= maxPerUser) continue

          const eligible = perUserEligible.get(aiUser.id)!
          for (const challenge of allOpenChallenges) {
            if (!claimed.has(challenge.id) && eligible.has(challenge.id)) {
              userAssignments.push(challenge.id)
              claimed.add(challenge.id)
              assigned = true
              break
            }
          }
        }
      }

      // Execute the assignments
      const challengeMap = new Map(allOpenChallenges.map(c => [c.id, c]))

      for (const aiUser of sortedAiUsers) {
        const challengeIds = assignments.get(aiUser.id)!
        for (const challengeId of challengeIds) {
          const challenge = challengeMap.get(challengeId)!
          try {
            await prisma.$transaction([
              prisma.debate.update({
                where: { id: challenge.id },
                data: {
                  opponentId: aiUser.id,
                  status: 'ACTIVE',
                  startedAt: new Date(),
                  roundDeadline: new Date(Date.now() + challenge.roundDuration),
                },
              }),
              prisma.userSubscription.upsert({
                where: { userId: aiUser.id },
                update: {},
                create: {
                  userId: aiUser.id,
                  tier: 'FREE',
                  status: 'ACTIVE',
                  billingCycle: null,
                },
              }),
              prisma.notification.create({
                data: {
                  userId: challenge.challenger.id,
                  type: 'DEBATE_ACCEPTED',
                  title: 'Challenge Accepted',
                  message: `${aiUser.username} has accepted your challenge: ${challenge.topic}`,
                  debateId: challenge.id,
                },
              }),
            ])

            results.autoAccept.accepted++
          } catch (error: any) {
            results.autoAccept.errors.push(`Challenge ${challenge.id}: ${error.message}`)
          }
        }
      }
    } catch (error: any) {
      results.autoAccept.errors.push(`Auto-accept error: ${error.message}`)
    }

    // ===== GENERATE AI RESPONSES =====
    try {
      const aiUserIds = aiUsers.map(u => u.id)

      // Batch query: get all active debates for all AI users at once
      const allActiveDebates = await prisma.debate.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { challengerId: { in: aiUserIds } },
            { opponentId: { in: aiUserIds } },
          ],
        },
        include: {
          challenger: {
            select: { id: true, username: true, eloRating: true },
          },
          opponent: {
            select: { id: true, username: true, eloRating: true },
          },
          statements: {
            orderBy: [
              { round: 'asc' },
              { createdAt: 'asc' },
            ],
          },
        },
      })

      for (const aiUser of aiUsers) {
        // Filter debates for this AI user in-memory
        const userDebates = allActiveDebates.filter(
          d => d.challengerId === aiUser.id || d.opponentId === aiUser.id
        )

        for (const debate of userDebates) {
          try {
            if (!debate.opponentId) continue

            // Determine whose turn it is
            const lastStatement = debate.statements[debate.statements.length - 1]
            const isChallengerTurn = !lastStatement || lastStatement.authorId === debate.opponentId
            const isAITurn = (isChallengerTurn && debate.challengerId === aiUser.id) ||
                            (!isChallengerTurn && debate.opponentId === aiUser.id)

            if (!isAITurn) continue

            const now = new Date()
            const delayMs = aiUser.aiResponseDelay || 45000
            const isChallenger = debate.challengerId === aiUser.id

            // Use already-loaded statements instead of separate DB queries
            const challengerStatement = debate.statements.find(
              s => s.authorId === debate.challengerId && s.round === debate.currentRound
            )
            const opponentStatement = debate.statements.find(
              s => s.authorId === debate.opponentId && s.round === debate.currentRound
            )

            // Check delay
            if (isChallenger && opponentStatement) {
              const statementAge = now.getTime() - new Date(opponentStatement.createdAt).getTime()
              if (statementAge < delayMs) continue
            } else if (!isChallenger && challengerStatement) {
              const statementAge = now.getTime() - new Date(challengerStatement.createdAt).getTime()
              if (statementAge < delayMs) continue
            }

            // Generate AI response
            const aiResponse = await generateAIResponse(
              debate.id,
              aiUser.id,
              debate.currentRound
            )

            // Submit the statement
            await prisma.statement.create({
              data: {
                debateId: debate.id,
                authorId: aiUser.id,
                content: aiResponse.trim(),
                round: debate.currentRound,
              },
            })

            // Update analytics
            const wordCount = calculateWordCount(aiResponse)
            await updateUserAnalyticsOnStatement(aiUser.id, wordCount)

            // Send push notification to opponent (non-blocking)
            const humanOpponentId = debate.challengerId === aiUser.id ? debate.opponentId : debate.challengerId
            const { sendYourTurnPushNotification } = await import('@/lib/notifications/push-notifications')
            sendYourTurnPushNotification(humanOpponentId, debate.id, debate.topic).catch((error) => {
              console.error('[AI Tasks] Failed to send push notification:', error)
            })

            // Check if both users have now submitted for this round
            // We know the AI just submitted, so check if the other participant already had
            const otherAlreadySubmitted = isChallenger ? opponentStatement : challengerStatement
            if (otherAlreadySubmitted) {
              if (debate.currentRound >= debate.totalRounds) {
                await prisma.debate.update({
                  where: { id: debate.id },
                  data: {
                    status: 'COMPLETED',
                    endedAt: new Date(),
                  },
                })

                // Trigger verdict generation
                import('@/lib/verdicts/generate-initial').then(async (generateModule) => {
                  try {
                    await generateModule.generateInitialVerdicts(debate.id)
                  } catch (error: any) {
                    console.error('Error generating verdicts:', error)
                  }
                }).catch(() => {})
              } else {
                await prisma.debate.update({
                  where: { id: debate.id },
                  data: {
                    currentRound: debate.currentRound + 1,
                    roundDeadline: new Date(Date.now() + debate.roundDuration),
                  },
                })
              }
            }

            results.responses.generated++
          } catch (error: any) {
            results.responses.errors.push(`Debate ${debate.id}: ${error.message}`)
          }
        }
      }
    } catch (error: any) {
      results.responses.errors.push(`Response generation error: ${error.message}`)
    }

    // ===== BELT SYSTEM TASKS =====
    try {
      const inactiveResult = await checkInactiveBelts()
      results.beltTasks.inactiveBeltsChecked = inactiveResult.beltsMarkedInactive || 0

      const now = new Date()
      const expiredChallenges = await prisma.beltChallenge.updateMany({
        where: {
          status: 'PENDING',
          expiresAt: { lt: now },
        },
        data: {
          status: 'EXPIRED',
        },
      })
      results.beltTasks.expiredChallengesCleaned = expiredChallenges.count
    } catch (error: any) {
      results.beltTasks.errors.push(`Belt tasks error: ${error.message}`)
      console.error('Belt tasks error:', error)
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration,
      results,
    })
  } catch (error: any) {
    console.error('AI tasks cron error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process AI tasks' },
      { status: 500 }
    )
  }
}
