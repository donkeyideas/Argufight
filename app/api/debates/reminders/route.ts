import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';
import { createDebateNotification } from '@/lib/notifications/debateNotifications';

// GET /api/debates/reminders - Get upcoming deadlines for user's debates
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
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Get active debates where user is a participant
    const debates = await prisma.debate.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { challengerId: userId },
          { opponentId: userId },
        ],
        roundDeadline: {
          not: null,
          gte: now,
          lte: oneDayFromNow,
        },
      },
      include: {
        challenger: {
          select: {
            username: true,
          },
        },
        opponent: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        roundDeadline: 'asc',
      },
    });

    // Get statements to determine whose turn it is
    const reminders = await Promise.all(
      debates.map(async (debate) => {
        const statements = await prisma.statement.findMany({
          where: {
            debateId: debate.id,
            round: debate.currentRound,
          },
        });

        const challengerSubmitted = statements.some(
          (s) => s.authorId === debate.challengerId
        );
        const opponentSubmitted = statements.some(
          (s) => s.authorId === debate.opponentId
        );

        let isUserTurn = false;
        if (debate.challengerId === userId) {
          isUserTurn = !challengerSubmitted || (opponentSubmitted && challengerSubmitted);
        } else if (debate.opponentId === userId) {
          isUserTurn = challengerSubmitted && !opponentSubmitted;
        }

        const hoursUntilDeadline = Math.floor(
          (debate.roundDeadline!.getTime() - now.getTime()) / (1000 * 60 * 60)
        );

        return {
          debateId: debate.id,
          topic: debate.topic,
          currentRound: debate.currentRound,
          totalRounds: debate.totalRounds,
          roundDeadline: debate.roundDeadline?.toISOString(),
          hoursUntilDeadline,
          isUserTurn,
          opponent: debate.challengerId === userId
            ? debate.opponent?.username
            : debate.challenger?.username,
        };
      })
    );

    return NextResponse.json({ reminders });
  } catch (error) {
    console.error('Failed to fetch reminders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reminders' },
      { status: 500 }
    );
  }
}

// POST /api/debates/reminders/send - Send reminder notifications for upcoming deadlines
export async function POST(request: NextRequest) {
  try {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // Get debates with deadlines in the next 1-2 hours
    const debates = await prisma.debate.findMany({
      where: {
        status: 'ACTIVE',
        roundDeadline: {
          not: null,
          gte: oneHourFromNow,
          lte: twoHoursFromNow,
        },
      },
    });

    const notificationsSent = [];

    for (const debate of debates) {
      // Get statements to determine whose turn it is
      const statements = await prisma.statement.findMany({
        where: {
          debateId: debate.id,
          round: debate.currentRound,
        },
      });

      const challengerSubmitted = statements.some(
        (s) => s.authorId === debate.challengerId
      );
      const opponentSubmitted = statements.some(
        (s) => s.authorId === debate.opponentId
      );

      // Notify challenger if it's their turn
      if (!challengerSubmitted || (opponentSubmitted && challengerSubmitted)) {
        await createDebateNotification(
          debate.id,
          debate.challengerId,
          'DEADLINE_REMINDER',
          'Deadline Approaching',
          `Round ${debate.currentRound} deadline is in 1 hour. Don't forget to submit your argument!`
        );
        notificationsSent.push(debate.challengerId);
      }

      // Notify opponent if it's their turn
      if (debate.opponentId && challengerSubmitted && !opponentSubmitted) {
        await createDebateNotification(
          debate.id,
          debate.opponentId,
          'DEADLINE_REMINDER',
          'Deadline Approaching',
          `Round ${debate.currentRound} deadline is in 1 hour. Don't forget to submit your argument!`
        );
        notificationsSent.push(debate.opponentId);
      }
    }

    return NextResponse.json({
      message: 'Reminders sent',
      count: notificationsSent.length,
    });
  } catch (error) {
    console.error('Failed to send reminders:', error);
    return NextResponse.json(
      { error: 'Failed to send reminders' },
      { status: 500 }
    );
  }
}











