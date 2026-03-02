import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'


// GET /api/admin/users - Get all users
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin
    const userId = getUserIdFromSession(session)
    if (!userId) {
      console.log('[admin/users] No userId from session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[admin/users] Checking admin status for userId:', userId)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, username: true, email: true },
    })

    console.log('[admin/users] User found:', { 
      userId, 
      username: user?.username, 
      email: user?.email, 
      isAdmin: user?.isAdmin 
    })

    if (!user) {
      console.log('[admin/users] User not found in database for userId:', userId)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.isAdmin) {
      console.log('[admin/users] User is not an admin, returning 403')
      console.log('[admin/users] User details:', { username: user.username, email: user.email, isAdmin: user.isAdmin })
      return NextResponse.json({ 
        error: 'Forbidden', 
        details: `User ${user.username} (${user.email}) is not an admin. isAdmin: ${user.isAdmin}` 
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100) // Max 100 per page
    const skip = (page - 1) * limit
    const search = searchParams.get('search')?.trim()

    const where: any = {}
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Get total count for pagination
    const total = await prisma.user.count({ where })

    const users = await prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        eloRating: true,
        totalDebates: true,
        debatesWon: true,
        debatesLost: true,
        debatesTied: true,
        isAdmin: true,
        isBanned: true,
        bannedUntil: true,
        employeeRole: true,
        accessLevel: true,
        isAI: true,
        aiPersonality: true,
        aiResponseDelay: true,
        aiPaused: true,
        googleId: true,
        createdAt: true,
        coins: true,
        isCreator: true,
        creatorStatus: true,
        creatorSince: true,
        subscription: {
          select: {
            tier: true,
            status: true,
            billingCycle: true,
          },
        },
      },
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
    console.error('Failed to fetch users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

