import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

// POST /api/auth/switch-account - Switch to a different account
// This allows switching between different user accounts (like Twitter)
export async function POST(request: NextRequest) {
  try {
    // Verify current session (user must be logged in to switch accounts)
    const session = await verifySession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { sessionToken, userId: targetUserId } = body

    let targetSession = null
    let targetUser = null

    if (sessionToken) {
      // Verify the session token exists and is valid
      targetSession = await prisma.session.findUnique({
        where: { token: sessionToken },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              avatarUrl: true,
              isAdmin: true,
            },
          },
        },
      })

      if (!targetSession) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        )
      }

      if (targetSession.expiresAt < new Date()) {
        return NextResponse.json(
          { error: 'Session has expired. Please log in again.' },
          { status: 400 }
        )
      }

      targetUser = targetSession.user
    } else if (targetUserId) {
      // If no session token, create a new session for the target user
      // This allows switching to accounts that were previously logged in but session expired
      targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          email: true,
          username: true,
          avatarUrl: true,
          isAdmin: true,
        },
      })

      if (!targetUser) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      // Create a new session for this user
      const { createSession } = await import('@/lib/auth/session')
      await createSession(targetUser.id)
      
      // Fetch the newly created session
      const sessions = await prisma.session.findMany({
        where: {
          userId: targetUser.id,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              avatarUrl: true,
              isAdmin: true,
            },
          },
        },
      })

      if (sessions.length > 0) {
        targetSession = sessions[0]
      }
    } else {
      return NextResponse.json(
        { error: 'Session token or user ID is required' },
        { status: 400 }
      )
    }

    if (!targetSession || !targetUser) {
      return NextResponse.json(
        { error: 'Invalid session or user' },
        { status: 400 }
      )
    }

    // Create new JWT with the target session token
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET || 'your-secret-key-change-in-production')
    const sessionJWT = await new SignJWT({ sessionToken: targetSession.token })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(targetSession.expiresAt)
      .sign(secret)

    // Set the new session cookie
    // CRITICAL: Use secure cookies in production, and ensure proper expiration
    const cookieStore = await cookies()
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
    
    cookieStore.set('session', sessionJWT, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      expires: targetSession.expiresAt,
      path: '/',
      // Don't set domain - let browser use current domain
    })

    console.log('[switch-account] Session switched successfully:', {
      fromUserId: getUserIdFromSession(session),
      toUserId: targetUser.id,
      toUsername: targetUser.username,
      toEmail: targetUser.email,
    })

    return NextResponse.json({
      success: true,
      user: targetSession.user,
    })
  } catch (error: any) {
    console.error('Failed to switch account:', error)
    return NextResponse.json(
      { error: 'Failed to switch account' },
      { status: 500 }
    )
  }
}

