import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/debates/search - Advanced search for debates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const minElo = searchParams.get('minElo');
    const maxElo = searchParams.get('maxElo');
    const sortBy = searchParams.get('sortBy') || 'relevance'; // relevance, recent, trending, engagement
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50); // Max 50 per page
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Text search
    if (query.trim()) {
      where.OR = [
        { topic: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ];
    }

    // Category filter
    if (category && category !== 'ALL') {
      where.category = category;
    }

    // Status filter
    if (status && status !== 'ALL') {
      where.status = status;
    }

    // ELO range filter (for participants)
    if (minElo || maxElo) {
      // This is a simplified version - in production you'd want to join with User table
      // For now, we'll filter debates based on participant ELO if available
    }

    // Get debates with engagement counts
    const debates = await prisma.debate.findMany({
      where,
      include: {
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
      take: limit * 2, // Get more to calculate scores for sorting
      skip: skip,
    });

    // Get total count for pagination (before filtering/sorting)
    const total = await prisma.debate.count({ where });

    // Calculate scores for sorting
    const debatesWithScores = debates.map((debate) => {
      const engagementScore =
        debate._count.likes * 2 +
        debate._count.comments * 3 +
        debate._count.statements * 1 +
        debate._count.saves * 1;

      // Relevance score (for text search)
      let relevanceScore = 0;
      if (query.trim()) {
        const queryLower = query.toLowerCase();
        const topicLower = debate.topic.toLowerCase();
        const descLower = (debate.description || '').toLowerCase();

        if (topicLower.includes(queryLower)) {
          relevanceScore += 10;
        }
        if (topicLower.startsWith(queryLower)) {
          relevanceScore += 5;
        }
        if (descLower.includes(queryLower)) {
          relevanceScore += 3;
        }
      } else {
        relevanceScore = 1; // Default if no query
      }

      // Trending score
      const hoursSinceCreation =
        (Date.now() - debate.createdAt.getTime()) / (1000 * 60 * 60);
      const trendingScore = engagementScore / Math.max(1, hoursSinceCreation);

      return {
        ...debate,
        relevanceScore,
        engagementScore,
        trendingScore,
      };
    });

    // Sort based on sortBy parameter
    let sortedDebates = [...debatesWithScores];
    switch (sortBy) {
      case 'relevance':
        sortedDebates.sort((a, b) => b.relevanceScore - a.relevanceScore);
        break;
      case 'recent':
        sortedDebates.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );
        break;
      case 'trending':
        sortedDebates.sort((a, b) => b.trendingScore - a.trendingScore);
        break;
      case 'engagement':
        sortedDebates.sort((a, b) => b.engagementScore - a.engagementScore);
        break;
      default:
        sortedDebates.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    // Take only the requested limit
    const paginatedDebates = sortedDebates.slice(0, limit);

    // Format response
    const formattedDebates = paginatedDebates.map((debate: any) => ({
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
      featured: debate.featured,
      createdAt: debate.createdAt.toISOString(),
      startedAt: debate.startedAt?.toISOString(),
      endedAt: debate.endedAt?.toISOString(),
      roundDeadline: debate.roundDeadline?.toISOString(),
      winnerId: debate.winnerId,
      engagement: {
        likes: debate._count.likes,
        comments: debate._count.comments,
        statements: debate._count.statements,
        saves: debate._count.saves,
      },
      relevanceScore: debate.relevanceScore,
    }));

    return NextResponse.json({
      debates: formattedDebates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to search debates:', error);
    return NextResponse.json(
      { error: 'Failed to search debates' },
      { status: 500 }
    );
  }
}



