import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifySession } from '@/lib/auth/session';
import { getUserIdFromSession } from '@/lib/auth/session-utils';

// GET /api/debates/recommendations/advanced - Advanced recommendations based on user history
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession();
    const userId = getUserIdFromSession(session);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user ELO rating
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { eloRating: true },
    });
    const userElo = user?.eloRating || 1200;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get user's debate history
    const userDebates = await prisma.debate.findMany({
      where: {
        OR: [
          { challengerId: userId },
          { opponentId: userId },
        ],
      },
      select: {
        id: true,
        category: true,
        topic: true,
        challengerId: true,
        opponentId: true,
      },
    });

    // Analyze user preferences
    const categoryCounts: Record<string, number> = {};
    const interactedUsers = new Set<string>();

    userDebates.forEach((debate) => {
      categoryCounts[debate.category] = (categoryCounts[debate.category] || 0) + 1;
      if (debate.challengerId !== userId) {
        interactedUsers.add(debate.challengerId);
      }
      if (debate.opponentId && debate.opponentId !== userId) {
        interactedUsers.add(debate.opponentId);
      }
    });

    // Get user's liked debates
    const likedDebates = await prisma.debateLike.findMany({
      where: { userId },
      include: {
        debate: {
          select: {
            category: true,
            challengerId: true,
            opponentId: true,
          },
        },
      },
    });

    likedDebates.forEach((like) => {
      categoryCounts[like.debate.category] = (categoryCounts[like.debate.category] || 0) + 0.5;
    });

    // Find most preferred category
    const preferredCategory = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'OTHER';

    // Get user's saved debates
    const savedDebates = await prisma.debateSave.findMany({
      where: { userId },
      select: { debateId: true },
    });
    const savedDebateIds = new Set(savedDebates.map((s) => s.debateId));

    // Get debates user has already participated in
    const participatedDebateIds = new Set(
      userDebates.map((d) => d.id || '')
    );

    // Build recommendation query
    const where: any = {
      id: {
        notIn: Array.from(participatedDebateIds),
      },
      status: { in: ['WAITING', 'ACTIVE'] },
    };

    // Prefer debates in user's preferred category
    const categoryWeight = preferredCategory;

    // Get candidate debates
    const candidateDebates = await prisma.debate.findMany({
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
          },
        },
      },
      take: limit * 3, // Get more to score and filter
    });

    // Score debates
    const scoredDebates = candidateDebates.map((debate) => {
      let score = 0;

      // Category match
      if (debate.category === preferredCategory) {
        score += 10;
      }

      // Engagement score
      const engagement = debate._count.likes + debate._count.comments * 2;
      score += Math.min(engagement, 20);

      // ELO similarity (prefer debates with similar ELO opponents)
      if (debate.challenger) {
        const eloDiff = Math.abs(debate.challenger.eloRating - userElo);
        if (eloDiff < 100) score += 5;
        else if (eloDiff < 200) score += 3;
      }

      // Avoid debates user has saved (they might have already seen them)
      if (savedDebateIds.has(debate.id)) {
        score -= 2;
      }

      // Prefer debates with opponents (active debates)
      if (debate.opponentId) {
        score += 3;
      }

      return {
        ...debate,
        recommendationScore: score,
      };
    });

    // Sort by score and take top N
    scoredDebates.sort((a, b) => b.recommendationScore - a.recommendationScore);
    const topDebates = scoredDebates.slice(0, limit);

    // Format response
    const formatted = topDebates.map((debate: any) => ({
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
      recommendationScore: debate.recommendationScore,
      reason: debate.category === preferredCategory
        ? `Matches your interest in ${preferredCategory}`
        : 'Trending debate you might enjoy',
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Failed to fetch advanced recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
}


