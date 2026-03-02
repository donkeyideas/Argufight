import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';

// GET /api/activity - Get user activity feed
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

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50); // Max 50 per page
    const cursor = searchParams.get('cursor'); // Cursor for pagination
    const type = searchParams.get('type'); // 'all', 'debates', 'comments', 'likes'

    const userId = session.user.id;

    // Get user's followed users (limit to 1000 to prevent performance issues)
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
      take: 1000, // Limit following list size
    });
    const followingIds = following.map((f) => f.followingId);

    // Include current user's activity
    const allUserIds = [userId, ...followingIds];

    const activities: any[] = [];

    // Get recent debates created by followed users or user
    if (!type || type === 'all' || type === 'debates') {
      const debateWhere: any = {
        challengerId: { in: allUserIds },
      };
      if (cursor) {
        // Cursor-based pagination: fetch debates created before the cursor date
        const cursorDate = new Date(cursor);
        debateWhere.createdAt = { lt: cursorDate };
      }

      const recentDebates = await prisma.debate.findMany({
        where: debateWhere,
        include: {
          challenger: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1, // Fetch one extra to check if there's more
      });

      recentDebates.forEach((debate) => {
        activities.push({
          id: `debate-${debate.id}`,
          type: 'DEBATE_CREATED',
          userId: debate.challengerId,
          user: debate.challenger,
          debateId: debate.id,
          debate: {
            id: debate.id,
            topic: debate.topic,
            category: debate.category,
          },
          timestamp: debate.createdAt,
        });
      });
    }

    // Get recent comments by followed users or user
    if (!type || type === 'all' || type === 'comments') {
      const commentWhere: any = {
        userId: { in: allUserIds },
        deleted: false,
      };
      if (cursor) {
        const cursorDate = new Date(cursor);
        commentWhere.createdAt = { lt: cursorDate };
      }

      const recentComments = await prisma.debateComment.findMany({
        where: commentWhere,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
          debate: {
            select: {
              id: true,
              topic: true,
              category: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      recentComments.forEach((comment) => {
        activities.push({
          id: `comment-${comment.id}`,
          type: 'COMMENT_ADDED',
          userId: comment.userId,
          user: comment.user,
          debateId: comment.debateId,
          debate: comment.debate,
          content: comment.content.substring(0, 100),
          timestamp: comment.createdAt,
        });
      });
    }

    // Get recent likes by followed users or user
    if (!type || type === 'all' || type === 'likes') {
      const likeWhere: any = {
        userId: { in: allUserIds },
      };
      if (cursor) {
        const cursorDate = new Date(cursor);
        likeWhere.createdAt = { lt: cursorDate };
      }

      const recentLikes = await prisma.debateLike.findMany({
        where: likeWhere,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
          debate: {
            select: {
              id: true,
              topic: true,
              category: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      recentLikes.forEach((like) => {
        activities.push({
          id: `like-${like.id}`,
          type: 'DEBATE_LIKED',
          userId: like.userId,
          user: like.user,
          debateId: like.debateId,
          debate: like.debate,
          timestamp: like.createdAt,
        });
      });
    }

    // Get recent debate completions
    if (!type || type === 'all' || type === 'debates') {
      const completedWhere: any = {
        OR: [
          { challengerId: { in: allUserIds } },
          { opponentId: { in: allUserIds } },
        ],
        status: 'COMPLETED',
      };
      if (cursor) {
        const cursorDate = new Date(cursor);
        completedWhere.endedAt = { lt: cursorDate };
      }

      const completedDebates = await prisma.debate.findMany({
        where: completedWhere,
        include: {
          challenger: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
          opponent: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { endedAt: 'desc' },
        take: limit + 1,
      });

      completedDebates.forEach((debate) => {
        activities.push({
          id: `completed-${debate.id}`,
          type: 'DEBATE_COMPLETED',
          userId: debate.winnerId || debate.challengerId,
          user: debate.winnerId === debate.challengerId
            ? debate.challenger
            : debate.opponent,
          debateId: debate.id,
          debate: {
            id: debate.id,
            topic: debate.topic,
            category: debate.category,
          },
          winnerId: debate.winnerId,
          timestamp: debate.endedAt || debate.updatedAt,
        });
      });
    }

    // Sort all activities by timestamp
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Check if there are more activities (cursor-based pagination)
    const hasMore = activities.length > limit;
    const limitedActivities = hasMore ? activities.slice(0, limit) : activities;
    const nextCursor = hasMore && limitedActivities.length > 0
      ? limitedActivities[limitedActivities.length - 1].timestamp.toISOString()
      : null;

    // Format response
    const formatted = limitedActivities.map((activity) => ({
      id: activity.id,
      type: activity.type,
      userId: activity.userId,
      user: activity.user,
      debateId: activity.debateId,
      debate: activity.debate,
      content: activity.content,
      winnerId: activity.winnerId,
      timestamp: activity.timestamp.toISOString(),
    }));

    return NextResponse.json({
      activities: formatted,
      pagination: {
        hasMore,
        nextCursor,
        limit,
      },
    });
  } catch (error) {
    console.error('Failed to fetch activity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity' },
      { status: 500 }
    );
  }
}



