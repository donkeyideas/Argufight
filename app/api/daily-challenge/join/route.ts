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
    const { position } = body

    if (!position || !['FOR', 'AGAINST'].includes(position)) {
      return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
    }

    // Get today's challenge
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const challenge = await prisma.dailyChallenge.findUnique({
      where: { activeDate: today },
    })

    if (!challenge) {
      return NextResponse.json({ error: 'No daily challenge available today' }, { status: 404 })
    }

    // Generate slug
    let slug = generateUniqueSlug(challenge.topic)
    let slugExists = await prisma.debate.findUnique({ where: { slug } })
    let counter = 1
    while (slugExists) {
      slug = generateUniqueSlug(challenge.topic, Math.random().toString(36).substring(2, 8))
      slugExists = await prisma.debate.findUnique({ where: { slug } })
      counter++
      if (counter > 50) {
        slug = generateUniqueSlug(challenge.topic, crypto.randomBytes(4).toString('hex'))
        break
      }
    }

    const opponentPosition = position === 'FOR' ? 'AGAINST' : 'FOR'

    // Create an OPEN debate — AI auto-accept will pick it up
    const debate = await prisma.debate.create({
      data: {
        topic: challenge.topic,
        description: challenge.description,
        slug,
        category: challenge.category as any,
        challengerId: userId,
        challengerPosition: position as any,
        opponentPosition: opponentPosition as any,
        totalRounds: 5,
        roundDuration: 86400000, // 24 hours
        speedMode: false,
        challengeType: 'OPEN',
        status: 'WAITING',
        visibility: 'PUBLIC',
      },
    })

    // Trigger AI auto-accept in background
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000')
      fetch(`${baseUrl}/api/cron/ai-auto-accept`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      }).catch(() => {})
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      debateId: debate.id,
      slug: debate.slug,
    })
  } catch (error: any) {
    console.error('[Daily Challenge Join] Error:', error.message)
    return NextResponse.json({ error: 'Failed to join daily challenge' }, { status: 500 })
  }
}
