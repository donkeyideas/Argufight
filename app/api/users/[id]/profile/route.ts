import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// GET /api/users/[id]/profile - Get a user's public profile
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
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
        subscription: {
          select: {
            tier: true,
          },
        },
        // Don't expose email or admin status
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

    return NextResponse.json({
      user: {
        ...user,
        winRate,
        subscription: user.subscription ? {
          tier: user.subscription.tier,
        } : { tier: 'FREE' },
      },
    })
  } catch (error) {
    console.error('Failed to fetch user profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    )
  }
}

