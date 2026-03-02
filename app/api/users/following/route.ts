import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';

// GET /api/users/following?userId=xxx - Get users that a user is following
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

    let following = [];
    try {
      const follows = await prisma.follow.findMany({
        where: { followerId: userId },
        include: {
          following: {
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

      following = follows.map((follow) => ({
        id: follow.following.id,
        username: follow.following.username,
        avatarUrl: follow.following.avatarUrl,
        eloRating: follow.following.eloRating,
        debatesWon: follow.following.debatesWon,
        debatesLost: follow.following.debatesLost,
        totalDebates: follow.following.totalDebates,
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

    return NextResponse.json(following);
  } catch (error: any) {
    console.error('Failed to fetch following:', error);
    return NextResponse.json(
      { error: 'Failed to fetch following' },
      { status: 500 }
    );
  }
}











