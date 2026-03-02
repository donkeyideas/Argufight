import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';

// GET /api/debates/compare?debateId1=xxx&debateId2=xxx - Compare two debates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const debateId1 = searchParams.get('debateId1');
    const debateId2 = searchParams.get('debateId2');

    if (!debateId1 || !debateId2) {
      return NextResponse.json(
        { error: 'Both debate IDs are required' },
        { status: 400 }
      );
    }

    if (debateId1 === debateId2) {
      return NextResponse.json(
        { error: 'Cannot compare a debate with itself' },
        { status: 400 }
      );
    }

    // Get both debates
    const [debate1, debate2] = await Promise.all([
      prisma.debate.findUnique({
        where: { id: debateId1 },
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
      }),
      prisma.debate.findUnique({
        where: { id: debateId2 },
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
      }),
    ]);

    if (!debate1 || !debate2) {
      return NextResponse.json(
        { error: 'One or both debates not found' },
        { status: 404 }
      );
    }

    // Get statistics for both debates
    const [stats1, stats2] = await Promise.all([
      Promise.all([
        prisma.statement.count({ where: { debateId: debateId1 } }),
        prisma.debateLike.count({ where: { debateId: debateId1 } }),
        prisma.debateComment.count({ where: { debateId: debateId1 } }),
        prisma.debateSave.count({ where: { debateId: debateId1 } }),
        0, // debateVote model doesn't exist
      ]),
      Promise.all([
        prisma.statement.count({ where: { debateId: debateId2 } }),
        prisma.debateLike.count({ where: { debateId: debateId2 } }),
        prisma.debateComment.count({ where: { debateId: debateId2 } }),
        prisma.debateSave.count({ where: { debateId: debateId2 } }),
        0, // debateVote model doesn't exist
      ]),
    ]);

    const formatDebate = (debate: any, stats: number[]) => ({
      id: debate.id,
      topic: debate.topic,
      category: debate.category,
      status: debate.status,
      createdAt: debate.createdAt.toISOString(),
      challenger: {
        username: debate.challenger.username,
        eloRating: debate.challenger.eloRating,
        winRate:
          debate.challenger.totalDebates > 0
            ? (debate.challenger.debatesWon / debate.challenger.totalDebates) * 100
            : 0,
      },
      opponent: debate.opponent
        ? {
            username: debate.opponent.username,
            eloRating: debate.opponent.eloRating,
            winRate:
              debate.opponent.totalDebates > 0
                ? (debate.opponent.debatesWon / debate.opponent.totalDebates) * 100
                : 0,
          }
        : null,
      statistics: {
        statements: stats[0],
        likes: stats[1],
        comments: stats[2],
        saves: stats[3],
        votes: 0, // Vote model doesn't exist
        engagementScore: stats[1] * 2 + stats[2] * 3 + stats[3] * 1,
      },
    });

    return NextResponse.json({
      debate1: formatDebate(debate1, stats1),
      debate2: formatDebate(debate2, stats2),
      comparison: {
        moreEngaged:
          formatDebate(debate1, stats1).statistics.engagementScore >
          formatDebate(debate2, stats2).statistics.engagementScore
            ? debateId1
            : debateId2,
        moreRecent:
          new Date(debate1.createdAt) > new Date(debate2.createdAt)
            ? debateId1
            : debateId2,
        higherEloChallenger:
          debate1.challenger.eloRating > debate2.challenger.eloRating
            ? debateId1
            : debateId2,
      },
    });
  } catch (error: any) {
    console.error('Failed to compare debates:', error);
    return NextResponse.json(
      { error: 'Failed to compare debates', details: error.message },
      { status: 500 }
    );
  }
}
