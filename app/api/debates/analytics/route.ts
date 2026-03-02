import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';

// GET /api/debates/analytics - Get debate analytics for current user
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

    // Get user's debate statistics
    const userDebates = await prisma.debate.findMany({
      where: {
        OR: [
          { challengerId: userId },
          { opponentId: userId },
        ],
      },
      include: {
        _count: {
          select: {
            likes: true,
            comments: true,
            statements: true,
          },
        },
      },
    });

    // Calculate analytics
    const totalDebates = userDebates.length;
    const activeDebates = userDebates.filter((d) => d.status === 'ACTIVE').length;
    const completedDebates = userDebates.filter((d) => d.status === 'COMPLETED').length;
    const wonDebates = userDebates.filter((d) => d.winnerId === userId).length;

    // Category breakdown
    const categoryBreakdown: Record<string, number> = {};
    userDebates.forEach((debate) => {
      categoryBreakdown[debate.category] = (categoryBreakdown[debate.category] || 0) + 1;
    });

    // Engagement metrics
    const totalLikes = userDebates.reduce((sum, d) => sum + d._count.likes, 0);
    const totalComments = userDebates.reduce((sum, d) => sum + d._count.comments, 0);
    const totalStatements = userDebates.reduce((sum, d) => sum + d._count.statements, 0);

    // Average debate duration
    const completedWithDuration = userDebates.filter(
      (d) => d.status === 'COMPLETED' && d.startedAt && d.endedAt
    );
    let averageDuration = 0;
    if (completedWithDuration.length > 0) {
      const durations = completedWithDuration.map((d) => {
        if (d.startedAt && d.endedAt) {
          return d.endedAt.getTime() - d.startedAt.getTime();
        }
        return 0;
      });
      averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    }

    // Win rate by category
    const winRateByCategory: Record<string, { won: number; total: number }> = {};
    userDebates.forEach((debate) => {
      if (!winRateByCategory[debate.category]) {
        winRateByCategory[debate.category] = { won: 0, total: 0 };
      }
      winRateByCategory[debate.category].total++;
      if (debate.winnerId === userId) {
        winRateByCategory[debate.category].won++;
      }
    });

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentDebates = userDebates.filter(
      (d) => d.createdAt >= thirtyDaysAgo
    ).length;

    return NextResponse.json({
      overview: {
        totalDebates,
        activeDebates,
        completedDebates,
        wonDebates,
        winRate: totalDebates > 0 ? ((wonDebates / totalDebates) * 100).toFixed(1) : '0.0',
        recentActivity: recentDebates,
      },
      engagement: {
        totalLikes,
        totalComments,
        totalStatements,
        averageLikesPerDebate: totalDebates > 0 ? (totalLikes / totalDebates).toFixed(1) : '0',
        averageCommentsPerDebate: totalDebates > 0 ? (totalComments / totalDebates).toFixed(1) : '0',
      },
      categoryBreakdown,
      winRateByCategory: Object.entries(winRateByCategory).map(([category, stats]) => ({
        category,
        won: stats.won,
        total: stats.total,
        winRate: stats.total > 0 ? ((stats.won / stats.total) * 100).toFixed(1) : '0.0',
      })),
      performance: {
        averageDurationMs: averageDuration,
        averageDurationDays: averageDuration > 0 ? (averageDuration / (1000 * 60 * 60 * 24)).toFixed(1) : '0',
      },
    });
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}











