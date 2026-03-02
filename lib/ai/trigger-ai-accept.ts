import { prisma } from '@/lib/db/prisma'

/**
 * Check for and auto-accept open challenges for AI users.
 * Called via after() when debates are listed, or by the daily cron.
 * Uses round-robin distribution so challenges spread evenly across AI users.
 * AI users with fewer active debates get priority.
 */
export async function triggerAIAutoAccept(): Promise<number> {
  try {
    const aiUsers = await prisma.user.findMany({
      where: { isAI: true, aiPaused: false },
      select: { id: true, username: true, aiResponseDelay: true },
    })

    if (aiUsers.length === 0) return 0

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
      // Count ALL debates per AI user (as opponent) for fair tiebreaking
      prisma.debate.groupBy({
        by: ['opponentId'],
        where: {
          opponentId: { in: aiUserIds },
        },
        _count: true,
      }),
    ])

    if (allOpenChallenges.length === 0) return 0

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

    // Sort AI users by: 1) fewest active debates, 2) fewest total debates (tiebreaker)
    const sortedAiUsers = [...aiUsers].sort((a, b) => {
      const activeDiff = (loadMap.get(a.id) || 0) - (loadMap.get(b.id) || 0)
      if (activeDiff !== 0) return activeDiff
      return (totalMap.get(a.id) || 0) - (totalMap.get(b.id) || 0)
    })

    // Build per-user eligible challenge lists (respecting each user's delay)
    const perUserEligible = new Map<string, Set<string>>()
    for (const aiUser of sortedAiUsers) {
      const delayMs = Math.min(aiUser.aiResponseDelay || 180000, 300000)
      const cutoffTime = new Date(Date.now() - delayMs)
      const ids = new Set(
        allOpenChallenges
          .filter(c => c.challengerId !== aiUser.id && c.createdAt <= cutoffTime)
          .map(c => c.id)
      )
      perUserEligible.set(aiUser.id, ids)
    }

    // Round-robin distribute challenges across AI users
    const assignments = new Map<string, string[]>() // aiUserId -> challengeIds
    const claimed = new Set<string>()
    const maxPerUser = 5

    for (const aiUser of sortedAiUsers) {
      assignments.set(aiUser.id, [])
    }

    // Keep distributing until no more can be assigned
    let assigned = true
    while (assigned) {
      assigned = false
      for (const aiUser of sortedAiUsers) {
        const userAssignments = assignments.get(aiUser.id)!
        if (userAssignments.length >= maxPerUser) continue

        const eligible = perUserEligible.get(aiUser.id)!
        // Find the first unclaimed challenge for this user
        for (const challenge of allOpenChallenges) {
          if (!claimed.has(challenge.id) && eligible.has(challenge.id)) {
            userAssignments.push(challenge.id)
            claimed.add(challenge.id)
            assigned = true
            break // One per user per round (round-robin)
          }
        }
      }
    }

    // Execute the assignments
    let accepted = 0
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
          accepted++

          // Trigger AI's opening argument (respects the response delay)
          try {
            const { triggerAIResponseForDebate } = await import('./trigger-ai-response')
            await triggerAIResponseForDebate(challenge.id)
          } catch {
            // Response will be triggered when someone views the debate
          }
        } catch {
          // Likely race condition — another process already accepted this challenge
        }
      }
    }

    return accepted
  } catch (error: any) {
    console.error('[AI Auto-Accept] Error:', error.message)
    return 0
  }
}
