import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { generateUniqueSlug } from '@/lib/utils/slug'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { category, topic, position } = body

    if (!category || !topic || !position) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['FOR', 'AGAINST'].includes(position)) {
      return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
    }

    // Find available AI users (non-paused), prefer WITTY personality
    const aiUsers = await prisma.user.findMany({
      where: { isAI: true, aiPaused: false },
      select: { id: true, username: true, aiPersonality: true },
    })

    if (aiUsers.length === 0) {
      // No AI users available — skip onboarding, mark complete
      await prisma.user.update({
        where: { id: userId },
        data: { hasCompletedOnboarding: true },
      })
      return NextResponse.json({
        error: 'No AI opponents available right now. You can start a debate from the dashboard!',
        skipped: true,
      }, { status: 200 })
    }

    // Round-robin load balancing: pick AI user with fewest active debates
    const aiUserIds = aiUsers.map(u => u.id)
    const [activeDebateCounts, totalDebateCounts] = await Promise.all([
      prisma.debate.groupBy({
        by: ['opponentId'],
        where: { status: 'ACTIVE', opponentId: { in: aiUserIds } },
        _count: true,
      }),
      prisma.debate.groupBy({
        by: ['opponentId'],
        where: { opponentId: { in: aiUserIds } },
        _count: true,
      }),
    ])

    const loadMap = new Map<string, number>()
    for (const entry of activeDebateCounts) {
      if (entry.opponentId) loadMap.set(entry.opponentId, entry._count)
    }
    const totalMap = new Map<string, number>()
    for (const entry of totalDebateCounts) {
      if (entry.opponentId) totalMap.set(entry.opponentId, entry._count)
    }

    // Sort: fewest active debates first, then fewest total debates, then prefer WITTY
    const sortedAiUsers = [...aiUsers].sort((a, b) => {
      const activeDiff = (loadMap.get(a.id) || 0) - (loadMap.get(b.id) || 0)
      if (activeDiff !== 0) return activeDiff
      const totalDiff = (totalMap.get(a.id) || 0) - (totalMap.get(b.id) || 0)
      if (totalDiff !== 0) return totalDiff
      // Prefer WITTY personality for onboarding
      const aWitty = a.aiPersonality === 'WITTY' ? -1 : 0
      const bWitty = b.aiPersonality === 'WITTY' ? -1 : 0
      return aWitty - bWitty
    })

    const selectedAI = sortedAiUsers[0]
    const opponentPosition = position === 'FOR' ? 'AGAINST' : 'FOR'

    // Generate slug
    let slug = generateUniqueSlug(topic)
    let slugExists = await prisma.debate.findUnique({ where: { slug } })
    let counter = 1
    while (slugExists) {
      slug = generateUniqueSlug(topic, Math.random().toString(36).substring(2, 8))
      slugExists = await prisma.debate.findUnique({ where: { slug } })
      counter++
      if (counter > 50) {
        slug = generateUniqueSlug(topic, crypto.randomBytes(4).toString('hex'))
        break
      }
    }

    // Generate share token for private debate
    const shareToken = crypto.randomBytes(24).toString('base64url')

    // Create debate as ACTIVE immediately (skip WAITING)
    const now = new Date()
    const roundDuration = 3600000 // 1 hour (speed mode)
    const debate = await prisma.debate.create({
      data: {
        topic,
        slug,
        category: category as any,
        challengerId: userId,
        opponentId: selectedAI.id,
        challengerPosition: position as any,
        opponentPosition: opponentPosition as any,
        totalRounds: 3,
        currentRound: 1,
        roundDuration,
        speedMode: true,
        isPrivate: true,
        shareToken,
        isOnboardingDebate: true,
        challengeType: 'DIRECT',
        invitedUserIds: JSON.stringify([selectedAI.id]),
        invitedBy: userId,
        status: 'ACTIVE',
        startedAt: now,
        roundDeadline: new Date(now.getTime() + roundDuration),
        visibility: 'PRIVATE',
      },
    })

    // Mark onboarding as complete
    await prisma.user.update({
      where: { id: userId },
      data: { hasCompletedOnboarding: true },
    })

    // Trigger AI response in background (non-blocking)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
      fetch(`${baseUrl}/api/cron/ai-generate-responses`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      }).catch(() => {})
    } catch {
      // Non-blocking — AI response will be triggered on page view anyway
    }

    return NextResponse.json({
      debateId: debate.id,
      slug: debate.slug,
      aiOpponent: selectedAI.username,
    })
  } catch (error: any) {
    console.error('[Onboarding Create Debate] Error:', error.message)
    return NextResponse.json({ error: 'Failed to create debate' }, { status: 500 })
  }
}
