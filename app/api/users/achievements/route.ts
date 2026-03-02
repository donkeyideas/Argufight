import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';

// GET /api/users/achievements - Get user achievements
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

    // Fetch full user data from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        debatesWon: true,
        debatesLost: true,
        debatesTied: true,
        totalDebates: true,
        eloRating: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    const achievements: any[] = [];

    // Calculate achievements based on user stats
    // First Win
    if (user.debatesWon >= 1) {
      achievements.push({
        id: 'first_win',
        name: 'First Victory',
        description: 'Win your first debate',
        icon: '🏆',
        unlocked: true,
        unlockedAt: new Date().toISOString(),
      });
    }

    // Win Streak (3 wins)
    if (user.debatesWon >= 3) {
      achievements.push({
        id: 'win_streak_3',
        name: 'On a Roll',
        description: 'Win 3 debates',
        icon: '🔥',
        unlocked: true,
        unlockedAt: new Date().toISOString(),
      });
    }

    // Veteran (10 wins)
    if (user.debatesWon >= 10) {
      achievements.push({
        id: 'veteran',
        name: 'Veteran Debater',
        description: 'Win 10 debates',
        icon: '⭐',
        unlocked: true,
        unlockedAt: new Date().toISOString(),
      });
    }

    // Master (50 wins)
    if (user.debatesWon >= 50) {
      achievements.push({
        id: 'master',
        name: 'Master Debater',
        description: 'Win 50 debates',
        icon: '👑',
        unlocked: true,
        unlockedAt: new Date().toISOString(),
      });
    }

    // ELO Milestones
    if (user.eloRating >= 1500) {
      achievements.push({
        id: 'elo_1500',
        name: 'Rising Star',
        description: 'Reach 1500 ELO',
        icon: '⭐',
        unlocked: true,
        unlockedAt: new Date().toISOString(),
      });
    }

    if (user.eloRating >= 1800) {
      achievements.push({
        id: 'elo_1800',
        name: 'Elite Debater',
        description: 'Reach 1800 ELO',
        icon: '💎',
        unlocked: true,
        unlockedAt: new Date().toISOString(),
      });
    }

    if (user.eloRating >= 2000) {
      achievements.push({
        id: 'elo_2000',
        name: 'Grandmaster',
        description: 'Reach 2000 ELO',
        icon: '🌟',
        unlocked: true,
        unlockedAt: new Date().toISOString(),
      });
    }

    // Participation milestones
    if (user.totalDebates >= 5) {
      achievements.push({
        id: 'participant_5',
        name: 'Active Participant',
        description: 'Participate in 5 debates',
        icon: '📝',
        unlocked: true,
        unlockedAt: new Date().toISOString(),
      });
    }

    if (user.totalDebates >= 25) {
      achievements.push({
        id: 'participant_25',
        name: 'Dedicated Debater',
        description: 'Participate in 25 debates',
        icon: '📚',
        unlocked: true,
        unlockedAt: new Date().toISOString(),
      });
    }

    if (user.totalDebates >= 100) {
      achievements.push({
        id: 'participant_100',
        name: 'Debate Enthusiast',
        description: 'Participate in 100 debates',
        icon: '🎯',
        unlocked: true,
        unlockedAt: new Date().toISOString(),
      });
    }

    // Check for debate creation achievements
    const debatesCreated = await prisma.debate.count({
      where: { challengerId: session.user.id },
    });

    if (debatesCreated >= 1) {
      achievements.push({
        id: 'creator',
        name: 'Debate Creator',
        description: 'Create your first debate',
        icon: '✨',
        unlocked: true,
        unlockedAt: new Date().toISOString(),
      });
    }

    if (debatesCreated >= 10) {
      achievements.push({
        id: 'prolific_creator',
        name: 'Prolific Creator',
        description: 'Create 10 debates',
        icon: '🎨',
        unlocked: true,
        unlockedAt: new Date().toISOString(),
      });
    }

    // Check for perfect win rate (if applicable)
    if (user.totalDebates >= 5 && user.debatesLost === 0 && user.debatesTied === 0) {
      achievements.push({
        id: 'perfect_record',
        name: 'Perfect Record',
        description: 'Win 5+ debates without a loss',
        icon: '💯',
        unlocked: true,
        unlockedAt: new Date().toISOString(),
      });
    }

    // Sort by unlocked status and date
    achievements.sort((a, b) => {
      if (a.unlocked && !b.unlocked) return -1;
      if (!a.unlocked && b.unlocked) return 1;
      return new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime();
    });

    return NextResponse.json({
      achievements,
      totalAchievements: achievements.length,
      unlockedCount: achievements.filter((a) => a.unlocked).length,
    });
  } catch (error) {
    console.error('Failed to fetch achievements:', error);
    return NextResponse.json(
      { error: 'Failed to fetch achievements' },
      { status: 500 }
    );
  }
}


