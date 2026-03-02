import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/session';
import { getUserIdFromSession } from '@/lib/auth/session-utils';
import { prisma } from '@/lib/db/prisma';

// POST /api/users/avatar - Update user avatar
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

    const { avatarUrl } = await request.json();

    if (!avatarUrl || typeof avatarUrl !== 'string') {
      return NextResponse.json(
        { error: 'Avatar URL is required' },
        { status: 400 }
      );
    }

    // Update user avatar
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
      },
    });

    // Transform to snake_case for mobile compatibility
    const mobileUser = {
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      avatar_url: updatedUser.avatarUrl || undefined,
    };

    return NextResponse.json({
      success: true,
      user: mobileUser,
      avatarUrl: updatedUser.avatarUrl, // Also include camelCase for backward compatibility
    });
  } catch (error: any) {
    console.error('Failed to update avatar:', error);
    return NextResponse.json(
      { error: 'Failed to update avatar', details: error.message },
      { status: 500 }
    );
  }
}


