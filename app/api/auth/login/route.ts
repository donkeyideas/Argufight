import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifyPassword } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim()
    console.log(`[LOGIN] Attempting login for: ${normalizedEmail}`)
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        username: true,
        passwordHash: true,
        googleAuthEnabled: true,
        isAdmin: true,
        isBanned: true,
        bannedUntil: true,
        avatarUrl: true,
        bio: true,
        eloRating: true,
        debatesWon: true,
        debatesLost: true,
        debatesTied: true,
        totalDebates: true,
        totpEnabled: true,
      },
    })

    if (!user) {
      console.log(`[LOGIN] User not found for email: ${normalizedEmail}`)
      console.log(`[LOGIN] Original email input: ${email}`)
      // Don't reveal if user exists or not (security best practice)
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }
    
    console.log(`[LOGIN] User found: ${user.username} (${user.email})`)

    // Note: We allow suspended users to log in, they just can't debate
    // Only check isBanned (permanent ban), not bannedUntil (temporary suspension)

    // Check if user has Google OAuth enabled (no password)
    if (user.googleAuthEnabled && !user.passwordHash) {
      return NextResponse.json(
        { error: 'This account uses Google authentication. Please sign in with Google.' },
        { status: 401 }
      )
    }

    // Verify password
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    let isValid = false
    try {
      isValid = await verifyPassword(password, user.passwordHash)
    } catch (error) {
      console.error('[LOGIN] Password verification error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }

    if (!isValid) {
      console.log(`[LOGIN] Invalid password for user: ${user.email}`)
      console.log(`[LOGIN] Password provided: ${password ? 'Yes' : 'No'}`)
      console.log(`[LOGIN] User has password hash: ${user.passwordHash ? 'Yes' : 'No'}`)
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Check if user is employee or advertiser (requires 2FA) OR if regular user has 2FA enabled (optional)
    const isEmployee = user.isAdmin
    let isAdvertiser = false
    let requires2FA = false

    if (isEmployee) {
      requires2FA = true
    } else {
      const advertiser = await prisma.advertiser.findUnique({
        where: { contactEmail: user.email },
        select: { status: true },
      })
      isAdvertiser = advertiser?.status === 'APPROVED'
      if (isAdvertiser) {
        // For approved advertisers, only require 2FA if it's already enabled
        // This allows testing without 2FA setup
        requires2FA = user.totpEnabled // Only require if already set up
      }
    }

    // If 2FA is required (employee) but not set up, create a temporary session for setup
    if (requires2FA && !user.totpEnabled && isEmployee) {
      // Create temporary session for 2FA setup (only for employees)
      const tempSessionJWT = await createSession(user.id)
      return NextResponse.json({
        requires2FASetup: true,
        token: tempSessionJWT,
        userId: user.id,
      })
    }

    // If 2FA is enabled (required for employees/advertisers, optional for regular users), require verification
    if (user.totpEnabled) {
      // Create temporary session that will be upgraded after 2FA verification
      const tempSessionJWT = await createSession(user.id)
      return NextResponse.json({
        requires2FA: true,
        token: tempSessionJWT,
        userId: user.id,
      })
    }

    // Check if user wants to add account (not replace current session)
    const addAccount = request.headers.get('x-add-account') === 'true'
    
    // If adding account, we need to preserve the current session
    // Get the current session before creating a new one
    let originalSession = null
    if (addAccount) {
      try {
        const { verifySession } = await import('@/lib/auth/session')
        const currentSession = await verifySession()
        if (currentSession) {
          const { getUserIdFromSession } = await import('@/lib/auth/session-utils')
          const currentUserId = getUserIdFromSession(currentSession)
          if (currentUserId && currentUserId !== user.id) {
            // Get the current session token
            const { cookies } = await import('next/headers')
            const { jwtVerify } = await import('jose')
            const cookieStore = await cookies()
            const sessionCookie = cookieStore.get('session')
            if (sessionCookie) {
              const secretKey = process.env.AUTH_SECRET || 'your-secret-key-change-in-production'
              const encodedKey = new TextEncoder().encode(secretKey)
              const { payload } = await jwtVerify(sessionCookie.value, encodedKey)
              const sessionToken = (payload as any).sessionToken
              
              // Get the original session from database
              const { prisma } = await import('@/lib/db/prisma')
              originalSession = await prisma.session.findUnique({
                where: { token: sessionToken },
              })
            }
          }
        }
      } catch (error) {
        console.error('Failed to get original session:', error)
      }
    }
    
    // Check if user is an approved advertiser (for redirect logic)
    let isApprovedAdvertiser = false
    if (!isEmployee) {
      const advertiserCheck = await prisma.advertiser.findUnique({
        where: { contactEmail: user.email },
        select: { status: true },
      })
      isApprovedAdvertiser = advertiserCheck?.status === 'APPROVED'
    }

    // Return user (without password) with token for mobile apps
    const { passwordHash, ...userWithoutPassword } = user

    // Transform user object to snake_case for mobile compatibility
    const mobileUser = {
      id: userWithoutPassword.id,
      email: userWithoutPassword.email,
      username: userWithoutPassword.username,
      avatar_url: userWithoutPassword.avatarUrl || undefined,
      bio: userWithoutPassword.bio || undefined,
      elo_rating: userWithoutPassword.eloRating,
      debates_won: userWithoutPassword.debatesWon,
      debates_lost: userWithoutPassword.debatesLost,
      debates_tied: userWithoutPassword.debatesTied,
      total_debates: userWithoutPassword.totalDebates,
      isAdmin: userWithoutPassword.isAdmin, // Include isAdmin for web app
      isAdvertiser: isApprovedAdvertiser, // Include isAdvertiser for redirect logic
    }

    // No 2FA required, create full session
    // CRITICAL: If adding account, don't replace the current session - just create a new one
    // The account switcher will handle switching between sessions
    if (addAccount) {
      // When adding account, create session but don't set it as active cookie
      // The user will switch to it via account switcher
      const { createSessionWithoutCookie } = await import('@/lib/auth/session')
      const { sessionJWT: newSessionJWT } = await createSessionWithoutCookie(user.id)
      console.log(`[LOGIN] Account added (not switched): ${user.email} (${user.id})`)
      
      // Return the session token so frontend can add it to account switcher
      return NextResponse.json({
        accountAdded: true,
        token: newSessionJWT,
        user: mobileUser,
      })
    }
    
    // Normal login - create and set session cookie
    const sessionJWT = await createSession(user.id)
    console.log(`[LOGIN] Login successful for user: ${user.email} (${user.id})`)

    return NextResponse.json({
      token: sessionJWT, // Return JWT token for mobile apps
      user: mobileUser,
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

