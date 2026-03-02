import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifySessionWithDb } from '@/lib/auth/session-verify'

/**
 * GET /api/users/list
 * Public endpoint to list all users (for debugging/admin purposes)
 * This bypasses admin checks but still requires authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Still require authentication, but don't require admin
    const session = await verifySessionWithDb()
    
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all users (no admin check)
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        eloRating: true,
        debatesWon: true,
        debatesLost: true,
        debatesTied: true,
        totalDebates: true,
        isAdmin: true,
        isBanned: true,
        isAI: true,
        aiPersonality: true,
        aiResponseDelay: true,
        aiPaused: true,
        employeeRole: true,
        accessLevel: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Failed to fetch users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
