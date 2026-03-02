import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';

// GET /api/debates/insights?debateId=xxx - Get insights for a debate
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const debateId = searchParams.get('debateId');

    if (!debateId) {
      return NextResponse.json(
        { error: 'Debate ID is required' },
        { status: 400 }
      );
    }

    // Get debate
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      include: {
        challenger: {
          select: {
            id: true,
            username: true,
            eloRating: true,
            debatesWon: true,
            debatesLost: true,
            totalDebates: true,
          },
        },
        opponent: {
          select: {
            id: true,
            username: true,
            eloRating: true,
            debatesWon: true,
            debatesLost: true,
            totalDebates: true,
          },
        },
      },
    });

    if (!debate) {
      return NextResponse.json(
        { error: 'Debate not found' },
        { status: 404 }
      );
    }

    // Get statistics with error handling
    let statementCount = 0;
    let likeCount = 0;
    let commentCount = 0;
    let saveCount = 0;
    let shareCount = 0;
    let voteCount = 0;
    let viewCount = 0;

    try {
      const results = await Promise.allSettled([
        prisma.statement.count({ where: { debateId } }),
        prisma.debateLike.count({ where: { debateId } }),
        prisma.debateComment.count({ where: { debateId } }),
        prisma.debateSave.count({ where: { debateId } }),
        prisma.debateShare.count({ where: { debateId } }),
        // debateVote model doesn't exist
        Promise.resolve(0), // prisma.debateVote.count({ where: { debateId } }),
        prisma.debate.findUnique({
          where: { id: debateId },
          select: { spectatorCount: true },
        }),
      ]);

      statementCount = results[0].status === 'fulfilled' ? results[0].value : 0;
      likeCount = results[1].status === 'fulfilled' ? results[1].value : 0;
      commentCount = results[2].status === 'fulfilled' ? results[2].value : 0;
      saveCount = results[3].status === 'fulfilled' ? results[3].value : 0;
      shareCount = results[4].status === 'fulfilled' ? results[4].value : 0;
      voteCount = results[5].status === 'fulfilled' ? results[5].value : 0;
      viewCount = results[6].status === 'fulfilled' ? (results[6].value as any)?.spectatorCount || 0 : 0;
    } catch (error: any) {
      console.error('Error fetching statistics:', error);
      // Continue with default values (0)
    }

    // Calculate engagement score
    const engagementScore =
      likeCount * 2 +
      commentCount * 3 +
      saveCount * 1 +
      shareCount * 5 +
      voteCount * 2 +
      viewCount * 0.1;

    // Get participant stats
    const challengerStats = {
      eloRating: debate.challenger.eloRating,
      winRate:
        debate.challenger.totalDebates > 0
          ? (debate.challenger.debatesWon / debate.challenger.totalDebates) * 100
          : 0,
      totalDebates: debate.challenger.totalDebates,
    };

    const opponentStats = debate.opponent
      ? {
          eloRating: debate.opponent.eloRating,
          winRate:
            debate.opponent.totalDebates > 0
              ? (debate.opponent.debatesWon / debate.opponent.totalDebates) * 100
              : 0,
          totalDebates: debate.opponent.totalDebates,
        }
      : null;

    // Get recent activity (last 24 hours) with error handling
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    let recentActivity = {
      statements: 0,
      comments: 0,
      likes: 0,
    };

    try {
      const activityResults = await Promise.allSettled([
        prisma.statement.count({
          where: {
            debateId,
            createdAt: { gte: oneDayAgo },
          },
        }),
        prisma.debateComment.count({
          where: {
            debateId,
            createdAt: { gte: oneDayAgo },
          },
        }),
        prisma.debateLike.count({
          where: {
            debateId,
            createdAt: { gte: oneDayAgo },
          },
        }),
      ]);

      recentActivity = {
        statements: activityResults[0].status === 'fulfilled' ? activityResults[0].value : 0,
        comments: activityResults[1].status === 'fulfilled' ? activityResults[1].value : 0,
        likes: activityResults[2].status === 'fulfilled' ? activityResults[2].value : 0,
      };
    } catch (error: any) {
      console.error('Error fetching recent activity:', error);
      // Continue with default values (0)
    }

    return NextResponse.json({
      debate: {
        id: debate.id,
        topic: debate.topic,
        status: debate.status,
        category: debate.category,
        createdAt: debate.createdAt.toISOString(),
      },
      statistics: {
        statements: statementCount,
        likes: likeCount,
        comments: commentCount,
        saves: saveCount,
        shares: shareCount,
        votes: voteCount,
        views: viewCount,
        engagementScore: Math.round(engagementScore),
      },
      participants: {
        challenger: {
          username: debate.challenger.username,
          stats: challengerStats,
        },
        opponent: debate.opponent
          ? {
              username: debate.opponent.username,
              stats: opponentStats,
            }
          : null,
      },
      recentActivity,
      insights: {
        isPopular: engagementScore > 50,
        isActive: recentActivity.statements > 0 || recentActivity.comments > 0,
        engagementLevel:
          engagementScore > 100
            ? 'high'
            : engagementScore > 30
            ? 'medium'
            : 'low',
      },
    });
  } catch (error: any) {
    console.error('Failed to get debate insights:', error);
    return NextResponse.json(
      { error: 'Failed to get debate insights', details: error.message },
      { status: 500 }
    );
  }
}


