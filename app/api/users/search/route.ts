import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

// GET /api/users/search - Search for users with pagination
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50) // Max 50 per page
    const skip = (page - 1) * limit

    if (!query || query.length < 2) {
      return NextResponse.json({
        users: [],
        pagination: {
          page: 1,
          limit,
          total: 0,
          totalPages: 0,
        },
      })
    }

    // Database-level search with pagination
    const where: any = {
      isBanned: false,
      id: {
        not: session.userId,
      },
      username: {
        contains: query,
        mode: 'insensitive', // Case-insensitive search (works with PostgreSQL)
      },
    }

    // Get total count for pagination
    const total = await prisma.user.count({ where })

    // Fetch paginated results
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        eloRating: true,
      },
      orderBy: {
        eloRating: 'desc',
      },
      skip,
      take: limit,
    })

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('User search error:', error)
    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    )
  }
}

