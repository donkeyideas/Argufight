import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'


// GET /api/admin/categories/[id]/analytics - Get analytics for a category
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    const { id } = await params

    const category = await prisma.category.findUnique({
      where: { id },
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Get all debates in this category
    // Use raw SQL to handle any category name (including custom ones like MUSIC)
    let debates
    try {
      // Try Prisma first
      debates = await prisma.debate.findMany({
        where: {
          category: category.name as any,
        },
        include: {
          challenger: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
          opponent: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      })
    } catch (error: any) {
      // If Prisma fails (e.g., category not in enum), use raw SQL
      console.log('Prisma query failed, using raw SQL:', error.message)
      const debatesRaw = await prisma.$queryRawUnsafe<Array<{
        id: string
        topic: string
        status: string
        challenger_id: string
        opponent_id: string | null
        winner_id: string | null
        appeal_count: number
        original_winner_id: string | null
        created_at: Date
      }>>(`
        SELECT 
          d.id,
          d.topic,
          d.status,
          d.challenger_id,
          d.opponent_id,
          d.winner_id,
          d.appeal_count,
          d.original_winner_id,
          d.created_at
        FROM debates d
        WHERE d.category = ?
      `, category.name)
      
      // Fetch challenger and opponent data separately
      const debateIds = debatesRaw.map((d: any) => d.id)
      const challengerIds = [...new Set(debatesRaw.map((d: any) => d.challenger_id))]
      const opponentIds = [...new Set(debatesRaw.filter((d: any) => d.opponent_id).map((d: any) => d.opponent_id!))]
      
      const [challengers, opponents] = await Promise.all([
        prisma.user.findMany({
          where: { id: { in: challengerIds } },
          select: { id: true, username: true, avatarUrl: true },
        }),
        opponentIds.length > 0 ? prisma.user.findMany({
          where: { id: { in: opponentIds } },
          select: { id: true, username: true, avatarUrl: true },
        }) : Promise.resolve([]),
      ])
      
      const challengerMap = new Map(challengers.map(u => [u.id, u]))
      const opponentMap = new Map(opponents.map(u => [u.id, u]))
      
      debates = debatesRaw.map((d: any) => ({
        id: d.id,
        topic: d.topic,
        status: d.status,
        challengerId: d.challenger_id,
        opponentId: d.opponent_id,
        winnerId: d.winner_id,
        appealCount: d.appeal_count,
        originalWinnerId: d.original_winner_id,
        createdAt: d.created_at,
        challenger: challengerMap.get(d.challenger_id)!,
        opponent: d.opponent_id ? opponentMap.get(d.opponent_id) || null : null,
      })) as any
    }

    // Calculate stats
    const totalDebates = debates.length
    const activeDebates = debates.filter((d: any) => d.status === 'ACTIVE').length
    const completedDebates = debates.filter((d: any) => 
      d.status === 'VERDICT_READY' || d.status === 'APPEALED' || d.status === 'COMPLETED'
    ).length

    // Get appeals for debates in this category
    const appealedDebates = debates.filter((d: any) => d.appealCount > 0)
    const totalAppeals = appealedDebates.length
    const successfulAppeals = appealedDebates.filter((d: any) => {
      // Appeal is successful if originalWinnerId exists and is different from current winnerId
      return d.originalWinnerId && d.originalWinnerId !== d.winnerId
    }).length
    const successRate = totalAppeals > 0 ? (successfulAppeals / totalAppeals) * 100 : 0

    // Calculate average ELO (from participants)
    const allParticipants = [
      ...debates.map((d: any) => d.challenger),
      ...debates.map((d: any) => d.opponent).filter((p: any) => p !== null),
    ]
    const uniqueParticipants = Array.from(
      new Map(allParticipants.map((p: any) => [p.id, p])).values()
    )
    // Note: ELO is stored on User model, we'd need to fetch it separately
    const averageElo = 0 // Placeholder - would need to fetch from User model

    // Get recent debates (last 10)
    const recentDebates = debates
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map((d: any) => ({
        id: d.id,
        topic: d.topic,
        status: d.status,
        challenger: {
          id: d.challenger.id,
          username: d.challenger.username,
          avatarUrl: d.challenger.avatarUrl,
        },
        opponent: d.opponent ? {
          id: d.opponent.id,
          username: d.opponent.username,
          avatarUrl: d.opponent.avatarUrl,
        } : null,
        winnerId: d.winnerId,
        createdAt: d.createdAt.toISOString(),
      }))

    const stats = {
      totalDebates,
      activeDebates,
      completedDebates,
      totalAppeals,
      successfulAppeals,
      successRate: Math.round(successRate * 100) / 100,
      averageElo,
    }

    return NextResponse.json({
      analytics: {
        category,
        stats,
        recentDebates,
      },
    })
  } catch (error: any) {
    console.error('Failed to fetch category analytics:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch category analytics',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

