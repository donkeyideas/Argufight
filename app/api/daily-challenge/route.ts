import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { DAILY_CHALLENGE_POOL } from '@/lib/daily-challenge/challenges'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Get today's date at UTC midnight
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    // Check if today's challenge already exists
    let challenge = await prisma.dailyChallenge.findUnique({
      where: { activeDate: today },
    })

    // If no challenge for today, auto-seed from the curated list
    if (!challenge) {
      // Count how many challenges have been used
      const usedCount = await prisma.dailyChallenge.count()
      // Pick the next topic in the pool (cycle if exhausted)
      const poolIndex = usedCount % DAILY_CHALLENGE_POOL.length
      const topicData = DAILY_CHALLENGE_POOL[poolIndex]

      challenge = await prisma.dailyChallenge.create({
        data: {
          topic: topicData.topic,
          description: topicData.description,
          category: topicData.category as any,
          forLabel: topicData.forLabel,
          againstLabel: topicData.againstLabel,
          activeDate: today,
        },
      })
    }

    // Get participation count (debates created today with this exact topic)
    const participationCount = await prisma.debate.count({
      where: {
        topic: challenge.topic,
        createdAt: { gte: today },
      },
    })

    return NextResponse.json({
      challenge: {
        id: challenge.id,
        topic: challenge.topic,
        description: challenge.description,
        category: challenge.category,
        forLabel: challenge.forLabel,
        againstLabel: challenge.againstLabel,
        activeDate: challenge.activeDate,
      },
      participationCount,
    })
  } catch (error: any) {
    console.error('[Daily Challenge] Error:', error.message)
    return NextResponse.json({ error: 'Failed to get daily challenge' }, { status: 500 })
  }
}
