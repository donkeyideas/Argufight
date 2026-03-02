import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

/**
 * GET /api/trending-topics
 * Returns trending topics based on debate count
 */
export async function GET() {
  try {
    // Get topics grouped by topic name and category, with debate counts
    // Only count active or completed debates (not cancelled)
    const topics = await prisma.debate.groupBy({
      by: ['topic', 'category'],
      where: {
        status: {
          not: 'CANCELLED',
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10, // Get top 10 trending topics
    })

    // Transform to match the component's expected format
    const trendingTopics = topics.map((topic, index) => ({
      id: `${topic.category}-${index}`,
      title: topic.topic,
      category: topic.category,
      icon: '',
      debateCount: topic._count.id,
    }))

    return NextResponse.json(trendingTopics)
  } catch (error) {
    console.error('Error fetching trending topics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trending topics' },
      { status: 500 }
    )
  }
}










