import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';

// GET /api/debates/recommended - Get personalized debate recommendations
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const session = await getSession(token);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const limit = 10;

    // Get user's debate history to understand preferences
    const userDebates = await prisma.debate.findMany({
      where: {
        OR: [
          { challengerId: userId },
          { opponentId: userId },
        ],
        status: { in: ['COMPLETED', 'VERDICT_READY'] },
      },
      select: {
        category: true,
      },
      take: 20,
    });

    // Calculate category preferences
    const categoryCounts: Record<string, number> = {};
    userDebates.forEach((debate) => {
      categoryCounts[debate.category] = (categoryCounts[debate.category] || 0) + 1;
    });

    // Get user's liked debates to understand interests
    const likedDebates = await prisma.debateLike.findMany({
      where: { userId },
      include: {
        debate: {
          select: { category: true },
        },
      },
      take: 20,
    });

    likedDebates.forEach((like) => {
      const category = like.debate.category;
      categoryCounts[category] = (categoryCounts[category] || 0) + 0.5;
    });

    // Get top preferred categories
    const preferredCategories = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([category]) => category);

    // Get debates user hasn't participated in
    const userParticipatedDebateIds = await prisma.debate.findMany({
      where: {
        OR: [
          { challengerId: userId },
          { opponentId: userId },
        ],
      },
      select: { id: true },
    });

    const participatedIds = userParticipatedDebateIds.map((d) => d.id);

    // Build recommendation query
    const where: any = {
      id: { notIn: participatedIds },
      status: { in: ['WAITING', 'ACTIVE'] },
    };

    // If user has preferences, prioritize those categories
    if (preferredCategories.length > 0) {
      where.category = { in: preferredCategories };
    }

    // Get recommended debates
    let recommendedDebates = await prisma.debate.findMany({
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
          },
        },
      },
      orderBy: [
        { featured: 'desc' },
        { spectatorCount: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit * 2,
    });

    // If not enough in preferred categories, fill with others
    if (recommendedDebates.length < limit) {
      const additionalWhere: any = {
        id: { notIn: [...participatedIds, ...recommendedDebates.map((d) => d.id)] },
        status: { in: ['WAITING', 'ACTIVE'] },
      };

      if (preferredCategories.length > 0) {
        additionalWhere.category = { notIn: preferredCategories };
      }

      const additionalDebates = await prisma.debate.findMany({
        where: additionalWhere,
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
            },
          },
        },
        orderBy: [
          { featured: 'desc' },
          { spectatorCount: 'desc' },
          { createdAt: 'desc' },
        ],
        take: limit - recommendedDebates.length,
      });

      recommendedDebates = [...recommendedDebates, ...additionalDebates];
    }

    // Format and return
    const formatted = recommendedDebates.slice(0, limit).map((debate: any) => ({
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
      createdAt: debate.createdAt?.toISOString() || new Date().toISOString(),
      startedAt: debate.startedAt?.toISOString(),
      endedAt: debate.endedAt?.toISOString(),
      roundDeadline: debate.roundDeadline?.toISOString(),
      winnerId: debate.winnerId,
      verdictReached: debate.verdictReached,
      engagement: {
        likes: debate._count.likes,
        comments: debate._count.comments,
      },
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Failed to fetch recommended debates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommended debates' },
      { status: 500 }
    );
  }
}











