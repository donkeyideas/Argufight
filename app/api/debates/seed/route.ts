import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';
import crypto from 'crypto';

// POST /api/debates/seed - Create sample debates (for testing)
export async function POST(request: NextRequest) {
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

    // Get a few users to create debates with
    const users = await prisma.user.findMany({
      take: 3,
      select: { id: true },
    });

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'No users found. Create users first.' },
        { status: 400 }
      );
    }

    const sampleDebates = [
      {
        topic: 'Is artificial intelligence a threat to humanity?',
        description: 'Debate the implications of AI development on society.',
        category: 'TECH',
        challengerPosition: 'FOR',
      },
      {
        topic: 'Should social media platforms be regulated?',
        description: 'Discuss the role of government in social media oversight.',
        category: 'POLITICS',
        challengerPosition: 'AGAINST',
      },
      {
        topic: 'Is remote work better than office work?',
        description: 'Compare the benefits and drawbacks of each work style.',
        category: 'TECH',
        challengerPosition: 'FOR',
      },
    ];

    const createdDebates = [];

    for (const debateData of sampleDebates) {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      
      const debate = await prisma.debate.create({
        data: {
          id: crypto.randomUUID(),
          topic: debateData.topic,
          description: debateData.description,
          category: debateData.category as any,
          challengerId: randomUser?.id || '',
          challengerPosition: debateData.challengerPosition as any,
          opponentPosition: (debateData.challengerPosition === 'FOR' ? 'AGAINST' : 'FOR') as any,
          totalRounds: 5,
          speedMode: false,
          status: 'WAITING',
          featured: Math.random() > 0.5, // Randomly feature some
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        include: {
          challenger: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              eloRating: true,
            },
          },
        },
      });

      createdDebates.push(debate);
    }

    return NextResponse.json({
      message: `Created ${createdDebates.length} sample debates`,
      debates: createdDebates,
    });
  } catch (error) {
    console.error('Failed to seed debates:', error);
    return NextResponse.json(
      { error: 'Failed to seed debates' },
      { status: 500 }
    );
  }
}


