import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

// GET /api/profile - Get current user's profile
export async function GET() {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      console.log('[API /profile] No userId found, returning 401')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[API /profile] Fetching profile for userId:', userId)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        bio: true,
        eloRating: true,
        coins: true,
        debatesWon: true,
        debatesLost: true,
        debatesTied: true,
        totalDebates: true,
        totalScore: true,
        totalMaxScore: true,
        totalWordCount: true,
        totalStatements: true,
        averageWordCount: true,
        averageRounds: true,
        createdAt: true,
      },
    })

    if (!user) {
      console.log('[API /profile] User not found for userId:', userId)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    console.log('[API /profile] Returning profile:', {
      id: user.id,
      email: user.email,
      username: user.username,
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Failed to fetch profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}

// PUT /api/profile - Update profile
export async function PUT(request: NextRequest) {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { username, bio } = body

    // Validate username if provided
    if (username !== undefined) {
      const { isValidUsername, isBlockedUsername } = await import('@/lib/utils/validation')
      
      // Check if username is blocked/reserved
      if (isBlockedUsername(username)) {
        return NextResponse.json(
          { error: 'This username is reserved and cannot be used' },
          { status: 400 }
        )
      }
      
      if (!isValidUsername(username)) {
        return NextResponse.json(
          { error: 'Username must be 3-20 characters and contain only letters, numbers, underscores, and hyphens' },
          { status: 400 }
        )
      }

      // Check if username is already taken by another user
      const existingUser = await prisma.user.findFirst({
        where: {
          username: username.trim(),
          NOT: { id: userId },
        },
      })

      if (existingUser) {
        return NextResponse.json(
          { error: 'Username is already taken' },
          { status: 409 }
        )
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(username !== undefined && { username: username.trim() }),
        ...(bio !== undefined && { bio: bio?.trim() || null }),
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        bio: true,
        eloRating: true,
        coins: true,
        debatesWon: true,
        debatesLost: true,
        debatesTied: true,
        totalDebates: true,
        totalScore: true,
        totalMaxScore: true,
        totalWordCount: true,
        totalStatements: true,
        averageWordCount: true,
        averageRounds: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    console.error('Failed to update profile:', error)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}

