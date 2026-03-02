import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/debates/categories - Get category statistics
export async function GET(request: NextRequest) {
  try {
    // Fetch categories from database
    const dbCategories = await prisma.category.findMany({
      where: {
        isActive: true,
      },
      select: {
        name: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    const categories = dbCategories.map(cat => cat.name);

    // If no categories in database, use fallback
    if (categories.length === 0) {
      categories.push('SPORTS', 'POLITICS', 'TECH', 'ENTERTAINMENT', 'SCIENCE', 'OTHER');
    }

    const categoryStats = await Promise.all(
      categories.map(async (category) => {
        const [total, active, completed, waiting] = await Promise.all([
          prisma.debate.count({ where: { category: category as any } }),
          prisma.debate.count({ where: { category: category as any, status: 'ACTIVE' } }),
          prisma.debate.count({ where: { category: category as any, status: 'COMPLETED' } }),
          prisma.debate.count({ where: { category: category as any, status: 'WAITING' } }),
        ]);

        // Get total engagement
        const debates = await prisma.debate.findMany({
          where: { category: category as any },
          select: { id: true },
        });

        const debateIds = debates.map((d) => d.id);
        const [likes, comments] = await Promise.all([
          prisma.debateLike.count({
            where: { debateId: { in: debateIds } },
          }),
          prisma.debateComment.count({
            where: { debateId: { in: debateIds }, deleted: false },
          }),
        ]);

        return {
          category,
          total,
          active,
          completed,
          waiting,
          engagement: {
            likes,
            comments,
            total: likes + comments,
          },
        };
      })
    );

    // Sort by total debates
    categoryStats.sort((a, b) => b.total - a.total);

    return NextResponse.json(categoryStats);
  } catch (error) {
    console.error('Failed to fetch category stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch category stats' },
      { status: 500 }
    );
  }
}


