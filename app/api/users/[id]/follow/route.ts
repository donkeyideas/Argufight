import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

// POST /api/users/[id]/follow - Toggle follow on a user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: targetUserId } = await params

    // Can't follow yourself
    if (userId === targetUserId) {
      return NextResponse.json(
        { error: 'You cannot follow yourself' },
        { status: 400 }
      )
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if already following
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: userId,
          followingId: targetUserId,
        },
      },
    })

    if (existingFollow) {
      // Unfollow
      await prisma.follow.delete({
        where: { id: existingFollow.id },
      })

      return NextResponse.json({
        success: true,
        following: false,
        message: 'User unfollowed',
      })
    } else {
      // Follow
      await prisma.follow.create({
        data: {
          followerId: userId,
          followingId: targetUserId,
        },
      })

      return NextResponse.json({
        success: true,
        following: true,
        message: 'User followed',
      })
    }
  } catch (error) {
    console.error('Follow error:', error)
    return NextResponse.json(
      { error: 'Failed to toggle follow' },
      { status: 500 }
    )
  }
}

// GET /api/users/[id]/follow - Check if user is following target user and get counts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession()
    const currentUserId = getUserIdFromSession(session)

    const { id: targetUserId } = await params

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get follow status (if user is logged in)
    let isFollowing = false
    if (currentUserId && currentUserId !== targetUserId) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: targetUserId,
          },
        },
      })
      isFollowing = !!follow
    }

    // Get follower and following counts
    const [followerCount, followingCount] = await Promise.all([
      prisma.follow.count({
        where: { followingId: targetUserId },
      }),
      prisma.follow.count({
        where: { followerId: targetUserId },
      }),
    ])

    return NextResponse.json({
      isFollowing,
      followerCount,
      followingCount,
    })
  } catch (error) {
    console.error('Get follow error:', error)
    return NextResponse.json(
      { error: 'Failed to get follow status' },
      { status: 500 }
    )
  }
}










