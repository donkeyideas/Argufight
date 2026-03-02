import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/debates/stats - Get platform-wide debate statistics
export async function GET(request: NextRequest) {
  try {
    const [
      totalDebates,
      activeDebates,
      completedDebates,
      waitingDebates,
      totalUsers,
      totalStatements,
      totalLikes,
      totalComments,
      categoryBreakdown,
      statusBreakdown,
      recentActivity,
    ] = await Promise.all([
      // Total debates
      prisma.debate.count(),

      // Active debates
      prisma.debate.count({ where: { status: 'ACTIVE' } }),

      // Completed debates
      prisma.debate.count({ where: { status: 'COMPLETED' } }),

      // Waiting debates
      prisma.debate.count({ where: { status: 'WAITING' } }),

      // Total users
      prisma.user.count(),

      // Total statements
      prisma.statement.count(),

      // Total likes
      prisma.debateLike.count(),

      // Total comments
      prisma.debateComment.count({ where: { deleted: false } }),

      // Category breakdown
      prisma.debate.groupBy({
        by: ['category'],
        _count: {
          category: true,
        },
      }),

      // Status breakdown
      prisma.debate.groupBy({
        by: ['status'],
        _count: {
          status: true,
        },
      }),

      // Recent activity (last 24 hours)
      prisma.debate.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Calculate averages
    const avgStatementsPerDebate =
      totalDebates > 0 ? (totalStatements / totalDebates).toFixed(1) : '0';
    const avgLikesPerDebate =
      totalDebates > 0 ? (totalLikes / totalDebates).toFixed(1) : '0';
    const avgCommentsPerDebate =
      totalDebates > 0 ? (totalComments / totalDebates).toFixed(1) : '0';

    // Format category breakdown
    const categoryStats = categoryBreakdown.map((item) => ({
      category: item.category,
      count: item._count.category,
      percentage:
        totalDebates > 0
          ? ((item._count.category / totalDebates) * 100).toFixed(1)
          : '0',
    }));

    // Format status breakdown
    const statusStats = statusBreakdown.map((item) => ({
      status: item.status,
      count: item._count.status,
      percentage:
        totalDebates > 0
          ? ((item._count.status / totalDebates) * 100).toFixed(1)
          : '0',
    }));

    return NextResponse.json({
      overview: {
        totalDebates,
        activeDebates,
        completedDebates,
        waitingDebates,
        totalUsers,
        recentActivity,
      },
      engagement: {
        totalStatements,
        totalLikes,
        totalComments,
        avgStatementsPerDebate,
        avgLikesPerDebate,
        avgCommentsPerDebate,
      },
      breakdowns: {
        categories: categoryStats,
        statuses: statusStats,
      },
    });
  } catch (error) {
    console.error('Failed to fetch debate stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch debate stats' },
      { status: 500 }
    );
  }
}
