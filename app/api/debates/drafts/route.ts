import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifySession } from '@/lib/auth/session';
import { getUserIdFromSession } from '@/lib/auth/session-utils';
import crypto from 'crypto';

// GET /api/debates/drafts - Get user's debate drafts
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession();
    const userId = getUserIdFromSession(session);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    try {
      const drafts = await (prisma as any).debateDraft?.findMany({
        where: {
          userId: userId,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 20,
      });

      return NextResponse.json(drafts);
    } catch (dbError: any) {
      // If table doesn't exist, return empty array instead of error
      if (
        dbError.message?.includes('no such table') ||
        dbError.message?.includes('does not exist') ||
        dbError.code === 'P2021' ||
        dbError.code === 'P2001'
      ) {
        console.log('DebateDraft table does not exist yet, returning empty array');
        return NextResponse.json([]);
      }
      throw dbError;
    }
  } catch (error: any) {
    console.error('Failed to fetch drafts:', error);
    console.error('Error details:', error.message, error.stack);
    // Return empty array on any error to prevent app crashes
    return NextResponse.json([]);
  }
}

// POST /api/debates/drafts - Create or update a draft
export async function POST(request: NextRequest) {
  try {
    const session = await verifySession();
    const userId = getUserIdFromSession(session);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id, topic, description, category, challengerPosition, totalRounds } =
      await request.json();

    try {
      if (id) {
        // Check if draft exists and belongs to user
        const existingDraft = await (prisma as any).debateDraft?.findFirst({
          where: {
            id,
            userId: userId,
          },
        });

        if (!existingDraft) {
          return NextResponse.json(
            { error: 'Draft not found or access denied' },
            { status: 404 }
          );
        }

        // Update existing draft
        const draft = await (prisma as any).debateDraft?.update({
          where: {
            id,
          },
          data: {
            topic: topic || '',
            description: description || null,
            category: category || 'OTHER',
            challengerPosition: challengerPosition || 'FOR',
            totalRounds: totalRounds || 5,
            updatedAt: new Date(),
          },
        });

        return NextResponse.json(draft);
      }

      // Create new draft
      const draft = await (prisma as any).debateDraft?.create({
        data: {
          id: crypto.randomUUID(),
          userId: userId,
          topic: topic || '',
          description: description || null,
          category: category || 'OTHER',
          challengerPosition: challengerPosition || 'FOR',
          totalRounds: totalRounds || 5,
        },
      });

      return NextResponse.json(draft);
    } catch (dbError: any) {
      // If table doesn't exist, return error but don't crash
      if (
        dbError.message?.includes('no such table') ||
        dbError.message?.includes('does not exist') ||
        dbError.code === 'P2021' ||
        dbError.code === 'P2001'
      ) {
        console.log('DebateDraft table does not exist yet');
        return NextResponse.json(
          { error: 'Drafts feature not available yet' },
          { status: 503 }
        );
      }
      throw dbError;
    }
  } catch (error: any) {
    console.error('Failed to save draft:', error);
    console.error('Error details:', error.message, error.stack);
    return NextResponse.json(
      { error: 'Failed to save draft', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/debates/drafts?id=xxx - Delete a draft
export async function DELETE(request: NextRequest) {
  try {
    const session = await verifySession();
    const userId = getUserIdFromSession(session);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Draft ID is required' },
        { status: 400 }
      );
    }

    // Check if draft exists and belongs to user
    const existingDraft = await (prisma as any).debateDraft?.findFirst({
      where: {
        id,
        userId: userId,
      },
    });

    if (!existingDraft) {
      return NextResponse.json(
        { error: 'Draft not found or access denied' },
        { status: 404 }
      );
    }

    await (prisma as any).debateDraft?.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete draft:', error);
    console.error('Error details:', error.message, error.stack);
    return NextResponse.json(
      { error: 'Failed to delete draft', details: error.message },
      { status: 500 }
    );
  }
}

