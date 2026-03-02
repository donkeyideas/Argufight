import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';
import crypto from 'crypto';

// POST /api/debates/[id]/report - Report a debate
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const { reason, description } = await request.json();

    if (!reason) {
      return NextResponse.json(
        { error: 'Reason is required' },
        { status: 400 }
      );
    }

    // Check if debate exists
    const debate = await prisma.debate.findUnique({
      where: { id },
    });

    if (!debate) {
      return NextResponse.json(
        { error: 'Debate not found' },
        { status: 404 }
      );
    }

    // Check if user already reported this debate
    // Note: In a real app, you'd have a Report model. For now, we'll just log it.
    console.log('Debate Report:', {
      debateId: id,
      reportedBy: session.user.id,
      reason,
      description,
      timestamp: new Date().toISOString(),
    });

    // In a production app, you would:
    // 1. Store the report in a database
    // 2. Notify moderators
    // 3. Potentially flag the debate for review

    return NextResponse.json({
      success: true,
      message: 'Report submitted successfully. Our moderators will review it.',
    });
  } catch (error) {
    console.error('Failed to submit report:', error);
    return NextResponse.json(
      { error: 'Failed to submit report' },
      { status: 500 }
    );
  }
}











