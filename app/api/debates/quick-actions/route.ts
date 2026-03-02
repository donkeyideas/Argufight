import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';

// GET /api/debates/quick-actions - Get quick action stats for user
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // If no token, return empty data instead of error (for unauthenticated users)
    if (!token) {
      return NextResponse.json({
        activeDebates: 0,
        waitingDebates: 0,
        savedDebates: 0,
        unreadNotifications: 0,
        upcomingDeadlines: 0,
      });
    }

    const session = await getSession(token);
    if (!session || !session.user) {
      // Invalid token, return empty data
      return NextResponse.json({
        activeDebates: 0,
        waitingDebates: 0,
        savedDebates: 0,
        unreadNotifications: 0,
        upcomingDeadlines: 0,
      });
    }

    const userId = session.user.id;

    // Get counts for quick actions with error handling
    let activeDebates = 0;
    let waitingDebates = 0;
    let savedDebates = 0;
    let unreadNotifications = 0;
    let upcomingDeadlines = 0;

    try {
      const results = await Promise.allSettled([
        // Active debates where user is participant
        prisma.debate.count({
          where: {
            status: 'ACTIVE',
            OR: [
              { challengerId: userId },
              { opponentId: userId },
            ],
          },
        }),
        // Waiting debates (user's challenges waiting for opponent)
        prisma.debate.count({
          where: {
            status: 'WAITING',
            challengerId: userId,
          },
        }),
        // Saved debates
        prisma.debateSave.count({
          where: {
            userId,
          },
        }).catch(() => 0),
        // Unread notifications
        prisma.notification.count({
          where: {
            userId,
            read: false,
          },
        }).catch(() => 0),
        // Upcoming deadlines (next 24 hours)
        prisma.debate.count({
          where: {
            status: 'ACTIVE',
            OR: [
              { challengerId: userId },
              { opponentId: userId },
            ],
            roundDeadline: {
              not: null,
              gte: new Date(),
              lte: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          },
        }),
      ]);

      activeDebates = results[0].status === 'fulfilled' ? results[0].value : 0;
      waitingDebates = results[1].status === 'fulfilled' ? results[1].value : 0;
      savedDebates = results[2].status === 'fulfilled' ? results[2].value : 0;
      unreadNotifications = results[3].status === 'fulfilled' ? results[3].value : 0;
      upcomingDeadlines = results[4].status === 'fulfilled' ? results[4].value : 0;
    } catch (error: any) {
      console.error('Error fetching quick actions:', error);
      // Continue with default values (0)
    }

    return NextResponse.json({
      activeDebates,
      waitingDebates,
      savedDebates,
      unreadNotifications,
      upcomingDeadlines,
    });
  } catch (error) {
    console.error('Failed to fetch quick actions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quick actions' },
      { status: 500 }
    );
  }
}


