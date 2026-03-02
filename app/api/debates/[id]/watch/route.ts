import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';
import crypto from 'crypto';

// POST /api/debates/[id]/watch - Toggle watch on a debate
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

    // Check if user is already watching (using saves as watchlist for now)
    // In a full implementation, you'd have a separate DebateWatch model
    const existingSave = await prisma.debateSave.findUnique({
      where: {
        debateId_userId: {
          debateId: id,
          userId: session.user.id,
        },
      },
    });

    if (existingSave) {
      // Unwatch
      await prisma.debateSave.delete({
        where: { id: existingSave.id },
      });

      return NextResponse.json({
        watching: false,
        message: 'Removed from watchlist',
      });
    } else {
      // Watch
      await prisma.debateSave.create({
        data: {
          id: crypto.randomUUID(),
          debateId: id,
          userId: session.user.id,
        },
      });

      return NextResponse.json({
        watching: true,
        message: 'Added to watchlist',
      });
    }
  } catch (error: any) {
    console.error('Failed to toggle watch:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Already watching this debate' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to toggle watch' },
      { status: 500 }
    );
  }
}

// GET /api/debates/[id]/watch - Check if user is watching
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ watching: false });
    }

    const session = await getSession(token);
    if (!session?.user) {
      return NextResponse.json({ watching: false });
    }

    const existingSave = await prisma.debateSave.findUnique({
      where: {
        debateId_userId: {
          debateId: id,
          userId: session.user.id,
        },
      },
    });

    return NextResponse.json({
      watching: !!existingSave,
    });
  } catch (error) {
    console.error('Failed to get watch status:', error);
    return NextResponse.json({ watching: false });
  }
}











