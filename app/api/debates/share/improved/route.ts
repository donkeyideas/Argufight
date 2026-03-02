import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifySession } from '@/lib/auth/session';
import { getUserIdFromSession } from '@/lib/auth/session-utils';
import crypto from 'crypto';

// POST /api/debates/share/improved - Enhanced share with analytics
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

    const { debateId, platform, message } = await request.json();

    if (!debateId) {
      return NextResponse.json(
        { error: 'Debate ID is required' },
        { status: 400 }
      );
    }

    // Get debate details
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
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
    });

    if (!debate) {
      return NextResponse.json(
        { error: 'Debate not found' },
        { status: 404 }
      );
    }

    // Record share
    await prisma.debateShare.create({
      data: {
        id: crypto.randomUUID(),
        debateId,
        userId: userId,
        method: platform || 'unknown',
      },
    });

    // Generate share content
    const shareUrl = `https://honorable.ai/debates/${debateId}`;
    const shareText = message || `Check out this debate: "${debate.topic}" on Honorable AI!`;

    // Generate different formats based on platform
    let shareContent = {
      text: `${shareText}\n\n${shareUrl}`,
      url: shareUrl,
      title: debate.topic,
      message: shareText,
    };

    // Platform-specific formatting
    if (platform === 'twitter' || platform === 'x') {
      shareContent.text = `${shareText}\n\n${shareUrl}\n\n#Debate #HonorableAI`;
    } else if (platform === 'facebook') {
      shareContent.text = `${shareText}\n\nJoin the discussion: ${shareUrl}`;
    } else if (platform === 'whatsapp') {
      shareContent.text = `${shareText}\n\n${shareUrl}`;
    }

    return NextResponse.json({
      success: true,
      shareContent,
      debate: {
        id: debate.id,
        topic: debate.topic,
        category: debate.category,
      },
    });
  } catch (error) {
    console.error('Failed to share debate:', error);
    return NextResponse.json(
      { error: 'Failed to share debate' },
      { status: 500 }
    );
  }
}

