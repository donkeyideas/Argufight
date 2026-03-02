import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';
import crypto from 'crypto';

// GET /api/debates/tags - Get all tags or tags for a debate
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const debateId = searchParams.get('debateId');

    if (debateId) {
      // Get tags for a specific debate
      try {
        // Try using Prisma model first
        if (prisma.debateTag) {
          const debateTags = await prisma.debateTag.findMany({
            where: { debateId },
            include: {
              tag: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
            },
          });

          return NextResponse.json(
            debateTags.map((dt) => ({
              id: dt.tag.id,
              name: dt.tag.name,
              color: dt.tag.color,
            }))
          );
        }
      } catch (error: any) {
        // If Prisma model doesn't work, fall back to raw SQL
        if (
          error.message?.includes('does not exist') || 
          error.message?.includes('no such table') ||
          error.message?.includes('Cannot read properties of undefined')
        ) {
          // Fall through to raw SQL query
        } else {
          throw error;
        }
      }

      // Fallback: Use raw SQL if Prisma model is not available
      try {
        const tags = await prisma.$queryRaw<Array<{ id: string; name: string; color: string }>>`
          SELECT t.id, t.name, t.color
          FROM tags t
          INNER JOIN debate_tags dt ON t.id = dt.tag_id
          WHERE dt.debate_id = ${debateId}
        `;
        return NextResponse.json(tags);
      } catch (error: any) {
        console.log('Tags query failed, returning empty array:', error.message);
        return NextResponse.json([]);
      }
    }

    // Get all popular tags (or return empty array if table doesn't exist)
    try {
      // Try using Prisma model first
      if (prisma.tag) {
        const popularTags = await prisma.tag.findMany({
          take: 50,
          orderBy: {
            usageCount: 'desc',
          },
          select: {
            id: true,
            name: true,
            color: true,
            usageCount: true,
          },
        });

        return NextResponse.json(popularTags || []);
      }
    } catch (error: any) {
      // If Prisma model doesn't work, fall back to raw SQL
      if (
        error.message?.includes('does not exist') || 
        error.message?.includes('no such table') ||
        error.message?.includes('Cannot read properties of undefined')
      ) {
        // Fall through to raw SQL query
      } else {
        throw error;
      }
    }

    // Fallback: Use raw SQL if Prisma model is not available
    try {
      const tags = await prisma.$queryRaw<Array<{ id: string; name: string; color: string; usage_count: number }>>`
        SELECT id, name, color, usage_count
        FROM tags
        ORDER BY usage_count DESC
        LIMIT 50
      `;
      return NextResponse.json(tags.map(t => ({
        id: t.id,
        name: t.name,
        color: t.color,
        usageCount: t.usage_count,
      })));
    } catch (error: any) {
      console.log('Tags query failed, returning empty array:', error.message);
      return NextResponse.json([]);
    }
  } catch (error: any) {
    console.error('Failed to fetch tags:', error);
    console.error('Error details:', error.message, error.stack);
    // Return empty array on any error to prevent app crashes
    if (error.message?.includes('does not exist') || error.message?.includes('no such table')) {
      console.log('Tags table does not exist yet, returning empty array');
      return NextResponse.json([]);
    }
    // For any other error, still return empty array to prevent crashes
    return NextResponse.json([]);
  }
}

// POST /api/debates/tags - Add tags to a debate
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

    const { debateId, tagNames } = await request.json();

    if (!debateId || !Array.isArray(tagNames)) {
      return NextResponse.json(
        { error: 'Debate ID and tag names array are required' },
        { status: 400 }
      );
    }

    // Verify user owns the debate
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      select: { challengerId: true },
    });

    if (!debate) {
      return NextResponse.json(
        { error: 'Debate not found' },
        { status: 404 }
      );
    }

    if (debate.challengerId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the debate creator can add tags' },
        { status: 403 }
      );
    }

    // Remove existing tags
    await prisma.debateTag.deleteMany({
      where: { debateId },
    });

    // Create or find tags and associate them
    const createdTags = [];
    for (const tagName of tagNames.slice(0, 5)) {
      // Limit to 5 tags
      if (!tagName || tagName.trim() === '') continue;

      const normalizedName = tagName.trim().toLowerCase();

      // Find or create tag
      let tag = await prisma.tag.findUnique({
        where: { name: normalizedName },
      });

      if (!tag) {
        // Generate a color for the tag
        const colors = [
          '#00aaff',
          '#00ff00',
          '#ffaa00',
          '#ff00ff',
          '#00ffff',
          '#ffff00',
        ];
        const color = colors[Math.floor(Math.random() * colors.length)];

        tag = await prisma.tag.create({
          data: {
            id: crypto.randomUUID(),
            name: normalizedName,
            color,
            usageCount: 1,
          },
        });
      } else {
        // Increment usage count
        await prisma.tag.update({
          where: { id: tag.id },
          data: {
            usageCount: { increment: 1 },
          },
        });
      }

      // Associate tag with debate
      await prisma.debateTag.create({
        data: {
          id: crypto.randomUUID(),
          debateId,
          tagId: tag.id,
        },
      });

      createdTags.push({
        id: tag.id,
        name: tag.name,
        color: tag.color,
      });
    }

    return NextResponse.json({
      success: true,
      tags: createdTags,
    });
  } catch (error) {
    console.error('Failed to add tags:', error);
    return NextResponse.json(
      { error: 'Failed to add tags' },
      { status: 500 }
    );
  }
}

