import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { generateWithDeepSeek } from '@/lib/ai/deepseek'

export const dynamic = 'force-dynamic'

// POST /api/admin/marketing/strategy/generate - Generate AI marketing strategy
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, startDate, endDate, goals, platforms } = body

    if (!name || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Name, start date, and end date are required' },
        { status: 400 }
      )
    }

    // Get platform data for context
    const recentDebates = await prisma.debate.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        topic: true,
        category: true,
      },
    })

    const debateTopics = recentDebates.map((d) => d.topic).join(', ')

    // Generate marketing strategy using AI
    const prompt = `You are an expert marketing strategist. Create a comprehensive ${name} marketing strategy for an AI-judged debate platform called "Argu Fight".

Platform Context:
- Recent debate topics: ${debateTopics || 'Various debate topics'}
- Target audience: People interested in structured debates, argumentation, and intellectual competition
- Platform features: AI judges, ELO rating system, tournaments, public/private debates

Requirements:
- Strategy period: ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}
- Goals: ${goals || 'Increase user engagement, grow platform awareness, drive signups'}
- Platforms to focus on: ${platforms || 'Instagram, LinkedIn, Twitter'}
- Content themes should align with debate topics and platform features

Generate a detailed marketing strategy including:
1. Overall marketing goals and objectives
2. Content themes for each month
3. Recommended posting frequency per platform
4. Key messaging and value propositions
5. Content mix (educational, entertaining, community-focused)
6. Campaign ideas and special events

Format the response as JSON with this structure:
{
  "goals": ["goal1", "goal2", "goal3"],
  "themes": ["theme1", "theme2", "theme3"],
  "platforms": ["platform1", "platform2"],
  "frequency": "X posts per week",
  "description": "Detailed strategy description..."
}`

    const response = await generateWithDeepSeek(prompt, {
      temperature: 0.7,
      maxTokens: 2000,
    })

    let strategyData
    try {
      // Try to parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        strategyData = JSON.parse(jsonMatch[0])
      } else {
        // Fallback: create structure from text
        strategyData = {
          goals: goals ? goals.split(',').map((g: string) => g.trim()) : ['Increase engagement', 'Grow awareness'],
          themes: ['Debate highlights', 'Platform features', 'Community stories'],
          platforms: platforms ? platforms.split(',').map((p: string) => p.trim()) : ['Instagram', 'LinkedIn', 'Twitter'],
          frequency: '3-5 posts per week',
          description: response,
        }
      }
    } catch (error) {
      // Fallback structure
      strategyData = {
        goals: goals ? goals.split(',').map((g: string) => g.trim()) : ['Increase engagement', 'Grow awareness'],
        themes: ['Debate highlights', 'Platform features', 'Community stories'],
        platforms: platforms ? platforms.split(',').map((p: string) => p.trim()) : ['Instagram', 'LinkedIn', 'Twitter'],
        frequency: '3-5 posts per week',
        description: response,
      }
    }

    // Create strategy in database
    const strategy = await prisma.marketingStrategy.create({
      data: {
        name,
        description: strategyData.description || response,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        goals: JSON.stringify(strategyData.goals || []),
        themes: JSON.stringify(strategyData.themes || []),
        platforms: JSON.stringify(strategyData.platforms || []),
        frequency: strategyData.frequency || '3-5 posts per week',
        status: 'DRAFT',
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
  } catch (error: any) {
    console.error('Failed to generate marketing strategy:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate marketing strategy' },
      { status: 500 }
    )
  }
}

