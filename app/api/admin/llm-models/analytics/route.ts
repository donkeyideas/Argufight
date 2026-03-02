import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'


// GET /api/admin/llm-models/analytics - Get appeal analytics for LLM training
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin
    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all appealed debates
    const appealedDebates = await prisma.debate.findMany({
      where: {
        appealStatus: {
          in: ['PENDING', 'PROCESSING', 'RESOLVED'],
        },
        appealReason: {
          not: null,
        },
      },
      include: {
        challenger: {
          select: {
            id: true,
            username: true,
          },
        },
        opponent: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        appealedAt: 'desc',
      },
    })

    // Calculate statistics
    const totalAppeals = appealedDebates.length
    const resolvedAppeals = appealedDebates.filter(
      (d) => d.appealStatus === 'RESOLVED'
    )
    
    // Determine success: appeal is successful if verdict flipped
    const successfulAppeals = resolvedAppeals.filter((d) => {
      if (!d.originalWinnerId || !d.winnerId) return false
      return d.originalWinnerId !== d.winnerId
    }).length

    const failedAppeals = resolvedAppeals.length - successfulAppeals
    const successRate =
      resolvedAppeals.length > 0
        ? Math.round((successfulAppeals / resolvedAppeals.length) * 100)
        : 0

    // Calculate average appeal reason length
    const appealReasons = appealedDebates
      .map((d) => d.appealReason)
      .filter((r): r is string => r !== null)
    const averageAppealLength =
      appealReasons.length > 0
        ? Math.round(
            appealReasons.reduce((sum, r) => sum + r.length, 0) /
              appealReasons.length
          )
        : 0

    // Extract top keywords from appeal reasons
    const keywordCounts: Record<string, number> = {}
    appealReasons.forEach((reason) => {
      const words = reason
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4) // Only words longer than 4 characters
      words.forEach((word) => {
        keywordCounts[word] = (keywordCounts[word] || 0) + 1
      })
    })

    const topAppealReasons = Object.entries(keywordCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([keyword, count]) => ({ keyword, count }))

    // Appeals by category
    const categoryCounts: Record<string, { count: number; successful: number }> = {}
    appealedDebates.forEach((debate) => {
      if (!categoryCounts[debate.category]) {
        categoryCounts[debate.category] = { count: 0, successful: 0 }
      }
      categoryCounts[debate.category].count++
      if (
        debate.appealStatus === 'RESOLVED' &&
        debate.originalWinnerId &&
        debate.winnerId &&
        debate.originalWinnerId !== debate.winnerId
      ) {
        categoryCounts[debate.category].successful++
      }
    })

    const appealsByCategory = Object.entries(categoryCounts).map(
      ([category, data]) => ({
        category,
        count: data.count,
        successRate:
          data.count > 0
            ? Math.round((data.successful / data.count) * 100)
            : 0,
      })
    )

    // Recent appeals for training data preview
    const recentAppeals = appealedDebates.slice(0, 20).map((debate) => {
      const appealedStatements = debate.appealedStatements
        ? JSON.parse(debate.appealedStatements)
        : []

      const originalWinner =
        debate.originalWinnerId === debate.challengerId
          ? debate.challenger.username
          : debate.opponent?.username || 'Unknown'

      const newWinner =
        debate.winnerId === debate.challengerId
          ? debate.challenger.username
          : debate.opponent?.username || null

      const success =
        debate.appealStatus === 'RESOLVED' &&
        debate.originalWinnerId &&
        debate.winnerId &&
        debate.originalWinnerId !== debate.winnerId

      return {
        id: debate.id,
        debateTopic: debate.topic,
        category: debate.category,
        appealReason: debate.appealReason || '',
        appealedStatements: Array.isArray(appealedStatements)
          ? appealedStatements
          : [],
        originalWinner,
        newWinner,
        success: debate.appealStatus === 'RESOLVED' ? success : null,
        createdAt: debate.appealedAt?.toISOString() || debate.createdAt.toISOString(),
      }
    })

    return NextResponse.json({
      totalAppeals,
      successfulAppeals,
      failedAppeals,
      successRate,
      averageAppealLength,
      topAppealReasons,
      appealsByCategory,
      recentAppeals,
    })
  } catch (error) {
    console.error('Failed to fetch appeal analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}










