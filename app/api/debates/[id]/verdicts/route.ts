import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/debates/[id]/verdicts - Get all verdicts for a debate
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const verdicts = await prisma.verdict.findMany({
      where: { debateId: id },
      include: {
        judge: {
          select: {
            id: true,
            name: true,
            emoji: true,
            personality: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const formattedVerdicts = verdicts.map((verdict: any) => ({
      id: verdict.id,
      debateId: verdict.debateId,
      judgeId: verdict.judgeId,
      judge: verdict.judge,
      winnerId: verdict.winnerId,
      decision: verdict.decision,
      reasoning: verdict.reasoning,
      challengerScore: verdict.challengerScore,
      opponentScore: verdict.opponentScore,
      createdAt: verdict.createdAt.toISOString(),
    }));

    return NextResponse.json(formattedVerdicts);
  } catch (error) {
    console.error('Failed to fetch verdicts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch verdicts' },
      { status: 500 }
    );
  }
}











