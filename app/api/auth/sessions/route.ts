import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

// GET /api/auth/sessions - Get all linked accounts (different users)
// This returns all accounts that have been logged into from this browser
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get linked accounts from request header (stored in localStorage on client)
    // The client sends all linked account IDs in a header
    const linkedAccountIds = request.headers.get('x-linked-accounts')
    
    let accountIds: string[] = [userId] // Always include current user
    
    if (linkedAccountIds) {
      try {
        const parsed = JSON.parse(linkedAccountIds) as string[]
        accountIds = [...new Set([userId, ...parsed])] // Remove duplicates, ensure current user is included
        console.log('[GET /api/auth/sessions] Linked accounts from header:', parsed)
        console.log('[GET /api/auth/sessions] Final accountIds (including current user):', accountIds)
      } catch (e) {
        console.error('[GET /api/auth/sessions] Failed to parse linked accounts:', e)
        // Invalid JSON, just use current user
      }
    } else {
      console.log('[GET /api/auth/sessions] No linked accounts header, using only current user:', userId)
    }

    // Get user info for all linked accounts
    const users = await prisma.user.findMany({
      where: {
        id: { in: accountIds },
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        isAdmin: true,
      },
    })

    // Get active sessions for all these users
    const sessions = await prisma.session.findMany({
      where: {
        userId: { in: accountIds },
        expiresAt: { gt: new Date() },
      },
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
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Group sessions by user and get the most recent session for each user
    // IMPORTANT: Only include sessions for users that are in the linked accounts list
    const userSessions = new Map<string, typeof sessions[0]>()
    const accountIdsSet = new Set(accountIds)
    
    for (const session of sessions) {
      // Only process sessions for users in the linked accounts
      if (!accountIdsSet.has(session.userId)) {
        console.log(`[GET /api/auth/sessions] Skipping session for user ${session.userId} - not in linked accounts`)
        continue
      }
      
      if (!userSessions.has(session.userId) || 
          session.createdAt > userSessions.get(session.userId)!.createdAt) {
        userSessions.set(session.userId, session)
      }
    }
    
    console.log(`[GET /api/auth/sessions] Found ${userSessions.size} unique users with sessions (from ${sessions.length} total sessions)`)

    // Build response with one entry per user (their most recent active session)
    const accounts = Array.from(userSessions.values()).map((s) => ({
      id: s.id,
      token: s.token,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      user: {
        id: s.user.id,
        email: s.user.email,
        username: s.user.username,
        avatarUrl: s.user.avatarUrl,
        isAdmin: s.user.isAdmin,
      },
    }))

    // If a user doesn't have an active session, still include them if they're in the linked accounts
    // BUT only if they're explicitly in the linkedAccountIds (not just because they're in the database)
    const linkedIdsSet = new Set(accountIds)
    console.log('[GET /api/auth/sessions] Creating temp entries. linkedIdsSet:', Array.from(linkedIdsSet))
    
    for (const user of users) {
      // Only create temp entry if user is in linked accounts AND doesn't have an active session
      // This prevents deleted accounts from reappearing
      const isInLinked = linkedIdsSet.has(user.id)
      const hasSession = userSessions.has(user.id)
      
      console.log(`[GET /api/auth/sessions] User ${user.username} (${user.id}): isInLinked=${isInLinked}, hasSession=${hasSession}`)
      
      if (!hasSession && isInLinked) {
        // Create a temporary entry (user will need to log in again)
        console.log(`[GET /api/auth/sessions] Creating temp entry for ${user.username}`)
        accounts.push({
          id: `temp-${user.id}`,
          token: '',
          createdAt: new Date(),
          expiresAt: new Date(),
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            avatarUrl: user.avatarUrl,
            isAdmin: user.isAdmin,
          },
        })
      }
    }

    console.log(`[GET /api/auth/sessions] Returning ${accounts.length} total sessions`)
    return NextResponse.json({ sessions: accounts })
  } catch (error: any) {
    console.error('Failed to get sessions:', error)
    return NextResponse.json(
      { error: 'Failed to get sessions' },
      { status: 500 }
    )
  }
}

// DELETE /api/auth/sessions - Delete a specific session (remove account from switcher)
export async function DELETE(request: NextRequest) {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { sessionToken } = body

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Session token is required' },
        { status: 400 }
      )
    }

    // Verify the session exists and belongs to a linked account (not current account)
    const targetSession = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
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

    // Don't allow deleting the current active session
    if (targetSession.userId === userId) {
      return NextResponse.json(
        { error: 'Cannot delete the currently active session. Please switch to another account first.' },
        { status: 400 }
      )
    }

    // Delete the session from database
    await prisma.session.delete({
      where: { token: sessionToken },
    })

    console.log('[DELETE /api/auth/sessions] Session deleted:', {
      sessionId: targetSession.id,
      userId: targetSession.userId,
      username: targetSession.user.username,
      deletedBy: userId,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete session:', error)
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}

