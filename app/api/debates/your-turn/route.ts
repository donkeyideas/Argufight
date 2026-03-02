import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

// GET /api/debates/your-turn - Check if user has a pending turn in any active debate
export async function GET() {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ hasTurn: false })
    }

    // Find active debates where user is a participant
    const activeDebates = await prisma.debate.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { challengerId: userId },
          { opponentId: userId },
        ],
      },
      select: {
        id: true,
        topic: true,
        currentRound: true,
        roundDeadline: true,
      },
      orderBy: { roundDeadline: 'asc' },
    })

    if (activeDebates.length === 0) {
      return NextResponse.json({ hasTurn: false })
    }

    // Check which debates the user hasn't submitted for the current round
    for (const debate of activeDebates) {
      const existingStatement = await prisma.statement.findFirst({
        where: {
          debateId: debate.id,
          authorId: userId,
          round: debate.currentRound,
        },
      })

      if (!existingStatement) {
        return NextResponse.json({
          hasTurn: true,
          debateId: debate.id,
          debateTitle: debate.topic,
          round: debate.currentRound,
          deadline: debate.roundDeadline,
        })
      }
    }

    return NextResponse.json({ hasTurn: false })
  } catch (error) {
    console.error('Failed to check your-turn:', error)
    return NextResponse.json({ hasTurn: false })
  }
}
