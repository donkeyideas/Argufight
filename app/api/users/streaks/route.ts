import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';

// GET /api/users/streaks - Get user's debate streaks
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

    // Get all debates where user participated
    const debates = await prisma.debate.findMany({
      where: {
        OR: [
          { challengerId: userId },
          { opponentId: userId },
        ],
        status: { in: ['ACTIVE', 'COMPLETED', 'VERDICT_READY'] },
      },
      select: {
        createdAt: true,
        startedAt: true,
        endedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate current streak (consecutive days with at least one debate)
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get unique dates when user had debates
    const debateDates = new Set<string>();
    debates.forEach((debate) => {
      const date = new Date(debate.createdAt);
      date.setHours(0, 0, 0, 0);
      debateDates.add(date.toISOString().split('T')[0]);
    });

    const sortedDates = Array.from(debateDates)
      .map((d) => new Date(d))
      .sort((a, b) => b.getTime() - a.getTime());

    // Calculate current streak
    let checkDate = new Date(today);
    for (let i = 0; i < sortedDates.length; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const hasDebate = sortedDates.some(
        (d) => d.toISOString().split('T')[0] === dateStr
      );

      if (hasDebate) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Calculate longest streak
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const daysDiff = Math.floor(
          (sortedDates[i - 1].getTime() - sortedDates[i].getTime()) /
            (1000 * 60 * 60 * 24)
        );
        if (daysDiff === 1) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    // Get total debates this week and month
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const debatesThisWeek = debates.filter(
      (d) => new Date(d.createdAt) >= weekAgo
    ).length;
    const debatesThisMonth = debates.filter(
      (d) => new Date(d.createdAt) >= monthAgo
    ).length;

    return NextResponse.json({
      currentStreak,
      longestStreak,
      debatesThisWeek,
      debatesThisMonth,
      totalDebates: debates.length,
    });
  } catch (error) {
    console.error('Failed to fetch streaks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch streaks' },
      { status: 500 }
    );
  }
}











