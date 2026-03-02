import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getSession } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

export async function GET(request: NextRequest) {
  try {
    // Check for session override in query params (for multi-session support)
    const { searchParams } = new URL(request.url)
    const sessionOverride = searchParams.get('session')

    // Check for Bearer token from mobile apps
    const authHeader = request.headers.get('authorization')
    let bearerToken: string | null = null
    if (authHeader && authHeader.startsWith('Bearer ')) {
      bearerToken = authHeader.substring(7)
    }

    let session = await verifySession()
    let userId: string | null = null
    
    // If no cookie session but we have a Bearer token, verify it
    if (!session && bearerToken) {
      const tokenSession = await getSession(bearerToken)
      if (tokenSession) {
        userId = tokenSession.userId
      }
    }

    // If session override is provided, try to use that session
    if (sessionOverride && !session && !userId) {
      try {
        const overrideSession = await prisma.session.findUnique({
          where: { token: sessionOverride },
          include: {
            user: {
              select: {
                id: true,
                email: true,
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
                isAdmin: true,
                isBanned: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        })

        if (overrideSession && overrideSession.expiresAt > new Date()) {
          return NextResponse.json({ user: overrideSession.user })
        }
      } catch (error) {
        // Invalid override, fall through to normal session check
      }
    }

    // Get userId from session if we don't have it from Bearer token
    if (!userId && session) {
      userId = getUserIdFromSession(session)
    }
    
    if (!userId) {
      // Only log in development to reduce console noise
      if (process.env.NODE_ENV === 'development') {
        console.log('[API /auth/me] No userId found, returning 401')
      }
      return NextResponse.json(
        { user: null },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
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
        isAdmin: true,
        isBanned: true,
        isCreator: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { user: null },
        { status: 401 }
      )
    }

    // Return user with both camelCase and snake_case for compatibility
    return NextResponse.json({
      user: {
        // camelCase (for web)
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        eloRating: user.eloRating,
        debatesWon: user.debatesWon,
        debatesLost: user.debatesLost,
        debatesTied: user.debatesTied,
        totalDebates: user.totalDebates,
        totalScore: user.totalScore,
        totalMaxScore: user.totalMaxScore,
        isAdmin: user.isAdmin,
        isBanned: user.isBanned,
        isCreator: user.isCreator,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        // snake_case (for mobile compatibility)
        avatar_url: user.avatarUrl || undefined,
        elo_rating: user.eloRating,
        debates_won: user.debatesWon,
        debates_lost: user.debatesLost,
        debates_tied: user.debatesTied,
        total_debates: user.totalDebates,
        total_score: user.totalScore,
        total_max_score: user.totalMaxScore,
        is_creator: user.isCreator,
      }
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    console.error('[API /auth/me] Get user error:', error)
    return NextResponse.json(
      { user: null },
      { status: 500 }
    )
  }
}
