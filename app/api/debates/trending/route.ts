import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/debates/trending - Get trending debates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const timeframe = searchParams.get('timeframe') || '24h'; // 24h, 7d, 30d

    const now = new Date();
    let timeThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default 24h

    if (timeframe === '7d') {
      timeThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeframe === '30d') {
      timeThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get debates with engagement metrics
    const debates = await prisma.debate.findMany({
      where: {
        createdAt: {
          gte: timeThreshold,
        },
      },
      select: {
        id: true,
        topic: true,
        description: true,
        category: true,
        challengerId: true,
        opponentId: true,
        challengerPosition: true,
        opponentPosition: true,
        totalRounds: true,
        currentRound: true,
        status: true,
        spectatorCount: true,
        featured: true,
        createdAt: true,
        startedAt: true,
        endedAt: true,
        roundDeadline: true,
        winnerId: true,
        challenger: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            eloRating: true,
          },
        },
        opponent: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            eloRating: true,
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
            statements: true,
            saves: true,
          },
        },
      },
      take: limit * 2, // Get more to calculate trending score
    });

    // Calculate trending score
    const debatesWithScore = debates.map((debate) => {
      const likesWeight = 2;
      const commentsWeight = 3;
      const statementsWeight = 1;
      const savesWeight = 1;
      const recencyWeight = 1;

      // Engagement score
      const engagementScore =
        debate._count.likes * likesWeight +
        debate._count.comments * commentsWeight +
        debate._count.statements * statementsWeight +
        debate._count.saves * savesWeight;

      // Recency score (more recent = higher score)
      const hoursSinceCreation =
        (now.getTime() - debate.createdAt.getTime()) / (1000 * 60 * 60);
      const recencyScore = Math.max(0, 100 - hoursSinceCreation) * recencyWeight;

      // Trending score
      const trendingScore = engagementScore + recencyScore;

      return {
        ...debate,
        trendingScore,
        engagementScore,
      };
    });

    // Sort by trending score and take top N
    debatesWithScore.sort((a, b) => b.trendingScore - a.trendingScore);
    const topDebates = debatesWithScore.slice(0, limit);

    // Fetch viewCount separately for each debate (Prisma client may not have it)
    const debatesWithViewCount = await Promise.all(
      topDebates.map(async (debate: any) => {
        let viewCount = 0;
        try {
          const result = await prisma.$queryRaw<Array<{ view_count: number }>>`
            SELECT view_count FROM debates WHERE id = ${debate.id}
          `;
          viewCount = result[0]?.view_count || 0;
        } catch (error) {
          // If query fails, default to 0
          viewCount = 0;
        }
        return { ...debate, viewCount };
      })
    );

    // Format response
    const formattedDebates = debatesWithViewCount.map((debate: any) => ({
      id: debate.id,
      topic: debate.topic,
      description: debate.description,
      category: debate.category,
      challengerId: debate.challengerId,
      opponentId: debate.opponentId,
      challenger: debate.challenger,
      opponent: debate.opponent,
      challengerPosition: debate.challengerPosition,
      opponentPosition: debate.opponentPosition,
      totalRounds: debate.totalRounds,
      currentRound: debate.currentRound,
      status: debate.status,
      spectatorCount: debate.spectatorCount,
      viewCount: debate.viewCount,
      featured: debate.featured,
      createdAt: debate.createdAt.toISOString(),
      startedAt: debate.startedAt?.toISOString(),
      endedAt: debate.endedAt?.toISOString(),
      roundDeadline: debate.roundDeadline?.toISOString(),
      winnerId: debate.winnerId,
      trendingScore: debate.trendingScore,
      engagement: {
        likes: debate._count.likes,
        comments: debate._count.comments,
        statements: debate._count.statements,
        saves: debate._count.saves,
      },
    }));

    return NextResponse.json(formattedDebates);
  } catch (error) {
    console.error('Failed to fetch trending debates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trending debates' },
      { status: 500 }
    );
  }
}
