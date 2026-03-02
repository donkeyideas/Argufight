import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/marketing/strategy - Get all marketing strategies
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const strategies = await prisma.marketingStrategy.findMany({
      orderBy: { createdAt: 'desc' },
    })

    // Parse JSON fields with error handling
    const parsedStrategies = strategies.map((s) => {
      let goals: string[] = []
      let themes: string[] = []
      let platforms: string[] = []
      
      try {
        goals = JSON.parse(s.goals || '[]')
        if (!Array.isArray(goals)) goals = []
      } catch {
        goals = []
      }
      
      try {
        themes = JSON.parse(s.themes || '[]')
        if (!Array.isArray(themes)) themes = []
      } catch {
        themes = []
      }
      
      try {
        platforms = JSON.parse(s.platforms || '[]')
        if (!Array.isArray(platforms)) platforms = []
      } catch {
        platforms = []
      }
      
      return {
        ...s,
        goals,
        themes,
        platforms,
      }
    })

    return NextResponse.json({ strategies: parsedStrategies })
  } catch (error: any) {
    console.error('Failed to fetch marketing strategies:', error)
    return NextResponse.json(
      { error: 'Failed to fetch marketing strategies' },
      { status: 500 }
    )
  }
}

// POST /api/admin/marketing/strategy - Create or update strategy
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, description, startDate, endDate, goals, themes, platforms, frequency, status } = body

    if (id) {
      // Update existing
      const strategy = await prisma.marketingStrategy.update({
        where: { id },
        data: {
          name,
          description,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          goals: goals ? JSON.stringify(Array.isArray(goals) ? goals : [goals]) : undefined,
          themes: themes ? JSON.stringify(Array.isArray(themes) ? themes : [themes]) : undefined,
          platforms: platforms ? JSON.stringify(Array.isArray(platforms) ? platforms : [platforms]) : undefined,
          frequency,
          status,
        },
      })

      return NextResponse.json({
        success: true,
        strategy: {
          ...strategy,
          goals: JSON.parse(strategy.goals || '[]'),
          themes: JSON.parse(strategy.themes || '[]'),
          platforms: JSON.parse(strategy.platforms || '[]'),
        },
      })
    } else {
      // Create new
      const strategy = await prisma.marketingStrategy.create({
        data: {
          name,
          description,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          goals: JSON.stringify(Array.isArray(goals) ? goals : goals ? [goals] : []),
          themes: JSON.stringify(Array.isArray(themes) ? themes : themes ? [themes] : []),
          platforms: JSON.stringify(Array.isArray(platforms) ? platforms : platforms ? [platforms] : []),
          frequency: frequency || '3-5 posts per week',
          status: status || 'DRAFT',
        },
      })

      return NextResponse.json({
        success: true,
        strategy: {
          ...strategy,
          goals: JSON.parse(strategy.goals || '[]'),
          themes: JSON.parse(strategy.themes || '[]'),
          platforms: JSON.parse(strategy.platforms || '[]'),
        },
      })
    }
  } catch (error: any) {
    console.error('Failed to save marketing strategy:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save marketing strategy' },
      { status: 500 }
    )
  }
}

