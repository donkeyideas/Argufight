import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

// GET /api/users/username/[username]/profile - Get a user's public profile by username
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      )
    }

    // Check if viewing own profile
    const session = await verifySession()
    const currentUserId = session ? getUserIdFromSession(session) : null

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        bio: true,
        eloRating: true,
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
        isBanned: true,
        email: true, // Will be filtered out if not own profile
        subscription: {
          select: {
            tier: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Don't show banned users
    if (user.isBanned) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Calculate win rate
    const winRate = user.totalDebates > 0
      ? Math.round((user.debatesWon / user.totalDebates) * 100)
      : 0

    // Remove email if not own profile
    const isOwnProfile = currentUserId === user.id
    const { email, ...userWithoutEmail } = user

    return NextResponse.json({
      user: {
        ...userWithoutEmail,
        ...(isOwnProfile ? { email } : {}), // Only include email for own profile
        winRate,
        subscription: user.subscription ? {
          tier: user.subscription.tier,
        } : { tier: 'FREE' },
      },
    })
  } catch (error) {
    console.error('Failed to fetch user profile by username:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    )
  }
}

