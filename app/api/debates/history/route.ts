import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';

// GET /api/debates/history - Get user's debate history
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
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50); // Max 50 per page
    const skip = (page - 1) * limit;

    const where: any = {
      OR: [
        { challengerId: userId },
        { opponentId: userId },
      ],
    };

    if (status && status !== 'ALL') {
      where.status = status;
    }

    // Get total count for pagination
    const total = await prisma.debate.count({ where });

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
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    });

    const formatted = debates.map((debate: any) => ({
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
      challengerEloChange: debate.challengerEloChange,
      opponentEloChange: debate.opponentEloChange,
      // Add user's role in the debate
      userRole: debate.challengerId === userId ? 'challenger' : 'opponent',
      userWon: debate.winnerId === userId,
    }));

    return NextResponse.json({
      debates: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch debate history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch debate history' },
      { status: 500 }
    );
  }
}



