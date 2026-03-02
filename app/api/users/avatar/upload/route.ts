import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

// POST /api/users/avatar/upload - Upload and update user avatar
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

    let dataUrl: string;

    try {
      const formData = await request.formData() as any;
      const file = formData.get('image') as File | Blob | null;

      if (!file) {
        return NextResponse.json(
          { error: 'No image file provided' },
          { status: 400 }
        );
      }

      // Convert file to base64 for storage (in production, upload to S3/Cloudinary)
      const bytes = await (file as File).arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = buffer.toString('base64');
      const mimeType = (file as File).type || 'image/jpeg';
      dataUrl = `data:${mimeType};base64,${base64}`;
    } catch (error: any) {
      // If formData parsing fails, try reading as raw body
      console.error('FormData parsing error:', error);
      return NextResponse.json(
        { error: 'Failed to parse image file', details: error.message },
        { status: 400 }
      );
    }

    // Update user avatar with data URL
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { avatarUrl: dataUrl },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json({
      success: true,
      avatarUrl: dataUrl,
      user: updatedUser,
    });
  } catch (error: any) {
    console.error('Failed to upload avatar:', error);
    return NextResponse.json(
      { error: 'Failed to upload avatar', details: error.message },
      { status: 500 }
    );
  }
}

