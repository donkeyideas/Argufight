import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';

// GET /api/challenges/daily - Get daily challenge
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get today's challenge (simple rotation based on day of year)
    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    const challenges = [
      {
        id: 'debate_today',
        title: 'Debate Today',
        description: 'Participate in at least one debate today',
        type: 'PARTICIPATE',
        target: 1,
        reward: 'Streak bonus',
      },
      {
        id: 'win_debate',
        title: 'Win a Debate',
        description: 'Win at least one debate today',
        type: 'WIN',
        target: 1,
        reward: 'ELO boost',
      },
      {
        id: 'comment_engage',
        title: 'Engage with Comments',
        description: 'Comment on 3 different debates',
        type: 'COMMENT',
        target: 3,
        reward: 'Engagement badge',
      },
      {
        id: 'create_debate',
        title: 'Create a Debate',
        description: 'Start a new debate challenge',
        type: 'CREATE',
        target: 1,
        reward: 'Creator badge',
      },
    ];

    const challenge = challenges[dayOfYear % challenges.length];

    // Check user's progress
    let progress = 0;
    let completed = false;

    switch (challenge.type) {
      case 'PARTICIPATE':
        const debatesToday = await prisma.debate.count({
          where: {
            OR: [
              { challengerId: userId },
              { opponentId: userId },
            ],
            createdAt: {
              gte: today,
            },
          },
        });
        progress = debatesToday;
        completed = progress >= challenge.target;
        break;

      case 'WIN':
        const winsToday = await prisma.debate.count({
          where: {
            winnerId: userId,
            endedAt: {
              gte: today,
            },
          },
        });
        progress = winsToday;
        completed = progress >= challenge.target;
        break;

      case 'COMMENT':
        const commentsToday = await prisma.debateComment.count({
          where: {
            userId,
            createdAt: {
              gte: today,
            },
            deleted: false,
          },
        });
        progress = commentsToday;
        completed = progress >= challenge.target;
        break;

      case 'CREATE':
        const createdToday = await prisma.debate.count({
          where: {
            challengerId: userId,
            createdAt: {
              gte: today,
            },
          },
        });
        progress = createdToday;
        completed = progress >= challenge.target;
        break;
    }

    return NextResponse.json({
      ...challenge,
      progress,
      completed,
      progressPercentage: Math.min(100, (progress / challenge.target) * 100),
    });
  } catch (error) {
    console.error('Failed to fetch daily challenge:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily challenge' },
      { status: 500 }
    );
  }
}











