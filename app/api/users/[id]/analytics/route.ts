import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// GET /api/users/[id]/analytics - Get user analytics and battle history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get user with analytics
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        totalWordCount: true,
        totalStatements: true,
        averageWordCount: true,
        averageRounds: true,
        totalDebates: true,
        debatesWon: true,
        debatesLost: true,
        debatesTied: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get battle history (unique opponents)
    const debatesAsChallenger = await prisma.debate.findMany({
      where: {
        challengerId: userId,
        opponentId: { not: null },
        status: { in: ['COMPLETED', 'VERDICT_READY', 'APPEALED'] },
      },
      select: {
        opponentId: true,
        opponent: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            eloRating: true,
          },
        },
        category: true,
        winnerId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const debatesAsOpponent = await prisma.debate.findMany({
      where: {
        opponentId: userId,
        status: { in: ['COMPLETED', 'VERDICT_READY', 'APPEALED'] },
      },
      select: {
        challengerId: true,
        challenger: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            eloRating: true,
          },
        },
        category: true,
        winnerId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Combine and deduplicate opponents
    const opponentMap = new Map<string, {
      id: string
      username: string
      avatarUrl: string | null
      eloRating: number
      debatesCount: number
      wins: number
      losses: number
      lastDebateDate: Date
    }>()

    // Process challenger debates
    debatesAsChallenger.forEach(debate => {
      if (!debate.opponent) return
      const opponentId = debate.opponent.id
      const existing = opponentMap.get(opponentId)
      
      if (existing) {
        existing.debatesCount++
        if (debate.winnerId === userId) existing.wins++
        else if (debate.winnerId === opponentId) existing.losses++
        if (debate.createdAt > existing.lastDebateDate) {
          existing.lastDebateDate = debate.createdAt
        }
      } else {
        opponentMap.set(opponentId, {
          id: opponentId,
          username: debate.opponent.username,
          avatarUrl: debate.opponent.avatarUrl,
          eloRating: debate.opponent.eloRating,
          debatesCount: 1,
          wins: debate.winnerId === userId ? 1 : 0,
          losses: debate.winnerId === opponentId ? 1 : 0,
          lastDebateDate: debate.createdAt,
        })
      }
    })

    // Process opponent debates
    debatesAsOpponent.forEach(debate => {
      if (!debate.challenger) return
      const challengerId = debate.challenger.id
      const existing = opponentMap.get(challengerId)
      
      if (existing) {
        existing.debatesCount++
        if (debate.winnerId === userId) existing.wins++
        else if (debate.winnerId === challengerId) existing.losses++
        if (debate.createdAt > existing.lastDebateDate) {
          existing.lastDebateDate = debate.createdAt
        }
      } else {
        opponentMap.set(challengerId, {
          id: challengerId,
          username: debate.challenger.username,
          avatarUrl: debate.challenger.avatarUrl,
          eloRating: debate.challenger.eloRating,
          debatesCount: 1,
          wins: debate.winnerId === userId ? 1 : 0,
          losses: debate.winnerId === challengerId ? 1 : 0,
          lastDebateDate: debate.createdAt,
        })
      }
    })

    // Convert to array and sort by last debate date
    const battleHistory = Array.from(opponentMap.values())
      .sort((a, b) => b.lastDebateDate.getTime() - a.lastDebateDate.getTime())
      .slice(0, 20) // Top 20 most recent opponents

    // Get category breakdown
    const categoryStats = await prisma.debate.groupBy({
      by: ['category'],
      where: {
        OR: [
          { challengerId: userId },
          { opponentId: userId },
        ],
        status: { in: ['COMPLETED', 'VERDICT_READY', 'APPEALED'] },
      },
      _count: {
        id: true,
      },
    })

    const categoryBreakdown = categoryStats.map(stat => ({
      category: stat.category,
      count: stat._count.id,
    }))

    return NextResponse.json({
      analytics: {
        totalWordCount: user.totalWordCount || 0,
        totalStatements: user.totalStatements || 0,
        averageWordCount: user.averageWordCount || 0,
        averageRounds: user.averageRounds || 0,
        totalDebates: user.totalDebates || 0,
        debatesWon: user.debatesWon || 0,
        debatesLost: user.debatesLost || 0,
        debatesTied: user.debatesTied || 0,
      },
      battleHistory,
      categoryBreakdown,
    })
  } catch (error) {
    console.error('Failed to fetch user analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user analytics' },
      { status: 500 }
    )
  }
}










