import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';

// GET /api/users/followers?userId=xxx - Get user's followers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    let followers = [];
    try {
      const follows = await prisma.follow.findMany({
        where: { followingId: userId },
        include: {
          follower: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              eloRating: true,
              debatesWon: true,
              debatesLost: true,
              totalDebates: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 100,
      });

      followers = follows.map((follow) => ({
        id: follow.follower.id,
        username: follow.follower.username,
        avatarUrl: follow.follower.avatarUrl,
        eloRating: follow.follower.eloRating,
        debatesWon: follow.follower.debatesWon,
        debatesLost: follow.follower.debatesLost,
        totalDebates: follow.follower.totalDebates,
        followedAt: follow.createdAt.toISOString(),
      }));
    } catch (error: any) {
      // If Follow table doesn't exist, return empty array
      if (error.message?.includes('does not exist') || error.message?.includes('no such table')) {
        console.log('Follow table does not exist yet');
        return NextResponse.json([]);
      }
      throw error;
    }

    return NextResponse.json(followers);
  } catch (error: any) {
    console.error('Failed to fetch followers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch followers' },
      { status: 500 }
    );
  }
}











