import { NextRequest, NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db/prisma'
import { createSessionWithoutCookie } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    console.log('[Google OAuth Callback] Received:', { code: !!code, state, error })

    // Get base URL early for all redirects
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.argufight.com'

    // Handle OAuth errors
    if (error) {
      console.error('[Google OAuth Callback] OAuth error:', error)
      return NextResponse.redirect(new URL('/login?error=oauth_denied', baseUrl))
    }

    if (!code) {
      console.error('[Google OAuth Callback] No code received')
      return NextResponse.redirect(new URL('/login?error=oauth_failed', baseUrl))
    }

    // Parse state to get return URL and user type
    let returnTo = '/'
    let userType = 'user'
    let addAccount = false
    
    if (state) {
      try {
        // Decode URL-encoded state first
        let decodedState: string
        try {
          decodedState = decodeURIComponent(state)
        } catch (decodeError) {
          // If decode fails, state might already be decoded
          decodedState = state
        }
        
        const stateData = JSON.parse(decodedState)
        returnTo = stateData.returnTo || '/'
        userType = stateData.userType || 'user'
        addAccount = stateData.addAccount === true
        console.log('[Google OAuth Callback] Parsed state:', { returnTo, userType, addAccount })
      } catch (e: any) {
        console.error('[Google OAuth Callback] Failed to parse OAuth state:', {
          error: e?.message,
          stack: e?.stack,
          state: state?.substring(0, 100), // Log first 100 chars to avoid huge logs
        })
        // Use defaults - don't fail the entire flow
      }
    }

    // Check admin settings first, then environment variables
    let clientId = process.env.GOOGLE_CLIENT_ID
    let clientSecret = process.env.GOOGLE_CLIENT_SECRET
    
    if (!clientId || !clientSecret) {
      try {
        const [clientIdSetting, clientSecretSetting] = await Promise.all([
          prisma.adminSetting.findUnique({ where: { key: 'GOOGLE_CLIENT_ID' } }),
          prisma.adminSetting.findUnique({ where: { key: 'GOOGLE_CLIENT_SECRET' } }),
        ])
        
        if (clientIdSetting?.value) {
          clientId = clientIdSetting.value
        }
        if (clientSecretSetting?.value) {
          clientSecret = clientSecretSetting.value
        }
      } catch (error) {
        console.error('[Google OAuth Callback] Failed to fetch Google OAuth credentials from admin settings:', error)
      }
    }
    
    const redirectUri = `${baseUrl}/api/auth/google/callback`
    
    console.log('[Google OAuth Callback] Configuration:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      clientIdPrefix: clientId?.substring(0, 30) + '...',
      clientSecretPrefix: clientSecret ? clientSecret.substring(0, 10) + '...' : 'missing',
      clientSecretLength: clientSecret?.length || 0,
      baseUrl,
      redirectUri,
    })

    if (!clientId || !clientSecret) {
      console.error('[Google OAuth Callback] Google OAuth credentials not configured')
      return NextResponse.redirect(new URL('/login?error=oauth_not_configured', baseUrl))
    }

    // Exchange code for tokens
    const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri)
    let tokens
    try {
      const tokenResponse = await oauth2Client.getToken(code)
      tokens = tokenResponse.tokens
    } catch (error: any) {
      console.error('Failed to exchange code for tokens:', error)
      console.error('OAuth Error Details:', {
        message: error?.message,
        code: error?.code,
        status: error?.status,
        response: error?.response?.data,
        clientId: clientId?.substring(0, 20) + '...', // Log partial client ID for debugging
        redirectUri,
      })
      // Check if it's an invalid_client error
      if (error?.code === 401 || error?.message?.includes('invalid_client')) {
        return NextResponse.redirect(new URL('/login?error=oauth_invalid_credentials', baseUrl))
      }
      return NextResponse.redirect(new URL('/login?error=token_exchange_failed', baseUrl))
    }
    
    if (!tokens.id_token) {
      return NextResponse.redirect(new URL('/login?error=no_id_token', baseUrl))
    }

    // Verify and decode the ID token
    let payload
    try {
      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token,
        audience: clientId,
      })
      payload = ticket.getPayload()
    } catch (error: any) {
      console.error('Failed to verify ID token:', error)
      return NextResponse.redirect(new URL('/login?error=token_verification_failed', baseUrl))
    }

    if (!payload) {
      return NextResponse.redirect(new URL('/login?error=invalid_token', baseUrl))
    }

    const googleId = payload.sub
    const googleEmail = payload.email?.toLowerCase()
    const googlePicture = payload.picture
    const googleName = payload.name

    if (!googleEmail) {
      return NextResponse.redirect(new URL('/login?error=no_email', baseUrl))
    }

    // Verify user type restrictions (only for advertisers/employees)
    // Regular users can now use Google login without restrictions
    if (userType === 'advertiser') {
      // Check if user is an approved advertiser
      const advertiser = await prisma.advertiser.findUnique({
        where: { contactEmail: googleEmail },
      })
      if (!advertiser) {
        return NextResponse.redirect(new URL('/login?error=not_advertiser', baseUrl))
      }
      if (advertiser.status !== 'APPROVED') {
        return NextResponse.redirect(new URL('/login?error=advertiser_not_approved', baseUrl))
      }
    } else if (userType === 'employee') {
      // Check if user is an employee/admin by email
      const existingUser = await prisma.user.findUnique({
        where: { email: googleEmail },
      })
      if (!existingUser || !existingUser.isAdmin) {
        return NextResponse.redirect(new URL('/login?error=not_employee', baseUrl))
      }
    }
    // For regular users (userType === 'user' or no userType), no restrictions

    // Check if user exists with this Google ID
    let user = await prisma.user.findUnique({
      where: { googleId },
    })

    // If no user with Google ID, check by email
    if (!user) {
      user = await prisma.user.findUnique({
        where: { email: googleEmail },
      })
    }

    // If user doesn't exist, create new user (for all user types now)
    if (!user) {
      try {
        // Generate a unique username from email
        const baseUsername = googleEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') // Remove special chars
        let username = baseUsername || 'user'
        let counter = 1
        const maxAttempts = 100 // Prevent infinite loop
        while (counter < maxAttempts && await prisma.user.findUnique({ where: { username } })) {
          username = `${baseUsername}${counter}`
          counter++
        }
        
        if (counter >= maxAttempts) {
          // Fallback to timestamp-based username
          username = `user${Date.now()}`
        }

        // Generate a placeholder password hash for OAuth users (they won't use it)
        const crypto = require('crypto')
        const placeholderHash = crypto.randomBytes(32).toString('hex')

        console.log('[Google OAuth Callback] Creating new user:', { email: googleEmail, username })
        
        user = await prisma.user.create({
          data: {
            email: googleEmail,
            username,
            avatarUrl: googlePicture || null,
            googleId,
            googleEmail,
            googlePicture: googlePicture || null,
            googleAuthEnabled: true,
            passwordHash: placeholderHash, // Placeholder hash for OAuth users
            // Create FREE subscription for new user
            subscription: {
              create: {
                tier: 'FREE',
                status: 'ACTIVE',
              },
            },
            // Create appeal limit
            appealLimit: {
              create: {
                monthlyLimit: 4,
                currentCount: 0,
              },
            },
          },
        })
        
        console.log('[Google OAuth Callback] User created successfully:', user.id)
      } catch (createError: any) {
        console.error('[Google OAuth Callback] Failed to create user:', createError)
        console.error('[Google OAuth Callback] Create error details:', {
          message: createError?.message,
          code: createError?.code,
          meta: createError?.meta,
        })
        throw new Error(`Failed to create user account: ${createError?.message || 'Unknown error'}`)
      }
    } else {
      // Update existing user with Google OAuth info
      try {
        console.log('[Google OAuth Callback] Updating existing user:', user.id)
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            googleEmail,
            googlePicture: googlePicture || null,
            googleAuthEnabled: true,
            // Update avatar if not set
            ...(googlePicture && !user.avatarUrl ? { avatarUrl: googlePicture } : {}),
          },
        })
        console.log('[Google OAuth Callback] User updated successfully')
      } catch (updateError: any) {
        console.error('[Google OAuth Callback] Failed to update user:', updateError)
        console.error('[Google OAuth Callback] Update error details:', {
          message: updateError?.message,
          code: updateError?.code,
          meta: updateError?.meta,
        })
        throw new Error(`Failed to update user account: ${updateError?.message || 'Unknown error'}`)
      }
    }

    // Check if user wants to add account (not replace current session)
    // This is detected by checking if there's already a session cookie OR if addAccount is in state
    let existingSession = null
    let isAddingAccount = addAccount
    try {
      const cookieStore = await cookies()
      existingSession = cookieStore.get('session')
      isAddingAccount = !!existingSession || addAccount
      console.log('[Google OAuth Callback] Account addition check:', { 
        hasExistingSession: !!existingSession, 
        addAccountFromState: addAccount, 
        isAddingAccount 
      })
    } catch (cookieError: any) {
      console.error('[Google OAuth Callback] Failed to read cookies:', {
        message: cookieError?.message,
        stack: cookieError?.stack,
      })
      // Continue without checking for existing session
    }

    // Create session for the new account (without setting cookie - we'll set it in redirect)
    let sessionJWT: string | null = null
    let sessionExpiresAt: Date | null = null
    try {
      console.log('[Google OAuth Callback] Creating session for user:', user.id)
      
      // Create session without cookie - we'll set cookie in redirect response
      const sessionResult = await createSessionWithoutCookie(user.id)
      sessionJWT = sessionResult.sessionJWT
      sessionExpiresAt = sessionResult.expiresAt
      console.log(`[Google OAuth Callback] Google OAuth login successful for user: ${user.email}${isAddingAccount ? ' (adding account)' : ''}`)
    } catch (sessionError: any) {
      console.error('[Google OAuth Callback] Failed to create session:', {
        message: sessionError?.message,
        name: sessionError?.name,
        code: sessionError?.code,
        stack: sessionError?.stack,
        cause: sessionError?.cause,
      })
      // If session creation fails, redirect to login with error
      return NextResponse.redirect(new URL('/login?error=session_creation_failed', baseUrl))
    }
    
    // Ensure session was created before proceeding
    if (!sessionJWT || !sessionExpiresAt) {
      console.error('[Google OAuth Callback] Session was not created, aborting')
      return NextResponse.redirect(new URL('/login?error=session_creation_failed', baseUrl))
    }

    // If adding account, we need to switch back to the original account
    // The new account is now in localStorage via the session creation
    // We'll redirect to a special endpoint that handles the account addition
    if (isAddingAccount && existingSession) {
      // Parse the existing session to get the original user
      try {
        console.log('[Google OAuth Callback] Restoring original session for account addition')
        const { jwtVerify } = await import('jose')
        const secretKey = process.env.AUTH_SECRET || 'your-secret-key-change-in-production'
        const encodedKey = new TextEncoder().encode(secretKey)
        const { payload } = await jwtVerify(existingSession.value, encodedKey)
        const originalSessionToken = (payload as any).sessionToken
        
        // Get the original session
        const originalSession = await prisma.session.findUnique({
          where: { token: originalSessionToken },
          include: { user: { select: { id: true } } },
        })
        
        if (originalSession && originalSession.expiresAt > new Date()) {
          // Restore the original session
          const { SignJWT } = await import('jose')
          const restoredSessionJWT = await new SignJWT({ sessionToken: originalSession.token })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime(originalSession.expiresAt)
            .sign(encodedKey)
          
          const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
          
          console.log('[Google OAuth Callback] Original session restored, redirecting to dashboard')
          // Create redirect response with restored session cookie
          const response = NextResponse.redirect(new URL('/?accountAdded=true', baseUrl))
          response.cookies.set('session', restoredSessionJWT, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            expires: originalSession.expiresAt,
            path: '/',
          })
          
          return response
        } else {
          console.warn('[Google OAuth Callback] Original session not found or expired in database')
        }
      } catch (error: any) {
        console.error('[Google OAuth Callback] Failed to restore original session:', {
          message: error?.message,
          stack: error?.stack,
        })
        // Fall through to normal redirect
      }
    }

    // Redirect based on user type
    // IMPORTANT: Set the session cookie ONLY in the redirect response
    // This ensures the cookie is included when the browser follows the redirect
    try {
      const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
      
      // Determine redirect URL
      let redirectUrl: string
      if (user.isAdmin) {
        redirectUrl = '/admin'
      } else if (userType === 'advertiser') {
        redirectUrl = '/advertiser/dashboard'
      } else if (!user.hasCompletedOnboarding) {
        redirectUrl = '/onboarding'
      } else {
        redirectUrl = returnTo || '/'
      }
      
      // Create redirect response
      const response = NextResponse.redirect(new URL(redirectUrl, baseUrl))
      
      // Set the session cookie in the redirect response
      // This is the ONLY place we set the cookie for OAuth flow
      response.cookies.set('session', sessionJWT, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        expires: sessionExpiresAt,
        path: '/',
        // Don't set domain - let browser use current domain
      })
      console.log('[Google OAuth Callback] Session cookie set in redirect response', {
        hasJWT: !!sessionJWT,
        expiresAt: sessionExpiresAt.toISOString(),
        isProduction,
      })
      
      return response
    } catch (redirectError: any) {
      console.error('[Google OAuth Callback] Failed to redirect:', redirectError)
      // Fallback to simple redirect with absolute URL
      return NextResponse.redirect(new URL('/', baseUrl))
    }
  } catch (error: any) {
    console.error('[Google OAuth Callback] Unhandled error:', {
      message: error?.message,
      name: error?.name,
      code: error?.code,
      cause: error?.cause,
      stack: error?.stack,
    })
    
    // Try to redirect with error, but if that fails, return a proper error response
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.argufight.com'
      return NextResponse.redirect(new URL(`/login?error=oauth_error&details=${encodeURIComponent(error?.message || 'Unknown error')}`, baseUrl))
    } catch (redirectError) {
      // If redirect fails, return a JSON error response
      console.error('[Google OAuth Callback] Failed to redirect after error:', redirectError)
      return NextResponse.json(
        { 
          error: 'OAuth authentication failed',
          details: error?.message || 'Unknown error',
        },
        { status: 500 }
      )
    }
  }
}

