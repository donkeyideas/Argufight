import { NextRequest, NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'
import { SignJWT } from 'jose'
import { prisma } from '@/lib/db/prisma'
import crypto from 'crypto'

/**
 * Mobile-specific Google OAuth callback
 * Returns a JWT token instead of setting a cookie
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    console.log('[Mobile Google OAuth Callback] Received:', { code: !!code, state, error })

    // Handle OAuth errors
    if (error) {
      console.error('[Mobile Google OAuth Callback] OAuth error:', error)
      return NextResponse.json(
        { error: 'OAuth authentication failed', details: error },
        { status: 400 }
      )
    }

    if (!code) {
      console.error('[Mobile Google OAuth Callback] No code received')
      return NextResponse.json(
        { error: 'No authorization code received' },
        { status: 400 }
      )
    }

    // Get Google OAuth credentials
    let clientId = process.env.GOOGLE_CLIENT_ID
    let clientSecret = process.env.GOOGLE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      try {
        const [idSetting, secretSetting] = await Promise.all([
          prisma.adminSetting.findUnique({ where: { key: 'GOOGLE_CLIENT_ID' } }),
          prisma.adminSetting.findUnique({ where: { key: 'GOOGLE_CLIENT_SECRET' } }),
        ])
        if (idSetting?.value) clientId = idSetting.value
        if (secretSetting?.value) clientSecret = secretSetting.value
      } catch (error) {
        console.error('[Mobile Google OAuth Callback] Failed to fetch credentials:', error)
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.argufight.com'
    const redirectUri = `${baseUrl}/api/auth/google/mobile-callback`

    if (!clientId || !clientSecret) {
      console.error('[Mobile Google OAuth Callback] Google OAuth credentials not configured')
      return NextResponse.json(
        { error: 'Google OAuth not configured' },
        { status: 500 }
      )
    }

    const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri)

    // Exchange code for tokens
    try {
      const tokenResponse = await oauth2Client.getToken(code)
      oauth2Client.setCredentials(tokenResponse.tokens)

      // Get user info from Google
      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokenResponse.tokens.id_token!,
        audience: clientId,
      })

      const payload = ticket.getPayload()
      if (!payload) {
        return NextResponse.json(
          { error: 'Failed to verify Google token' },
          { status: 400 }
        )
      }

      const googleId = payload.sub
      const googleEmail = payload.email?.toLowerCase()
      const googlePicture = payload.picture
      const googleName = payload.name

      if (!googleEmail) {
        return NextResponse.json(
          { error: 'No email provided by Google' },
          { status: 400 }
        )
      }

      // Find or create user
      let user = await prisma.user.findFirst({
        where: { googleId },
      })

      if (!user) {
        user = await prisma.user.findUnique({
          where: { email: googleEmail },
        })
      }

      if (!user) {
        // Create new user
        const baseUsername = googleEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '')
        let username = baseUsername
        let counter = 1

        while (await prisma.user.findUnique({ where: { username } })) {
          username = `${baseUsername}${counter}`
          counter++
        }

        const placeholderHash = crypto.randomBytes(32).toString('hex')

        user = await prisma.user.create({
          data: {
            email: googleEmail,
            username,
            avatarUrl: googlePicture || null,
            googleId,
            googleEmail,
            googlePicture: googlePicture || null,
            googleAuthEnabled: true,
            passwordHash: placeholderHash,
          },
        })
      } else {
        // Update existing user with Google OAuth info
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            googleEmail,
            googlePicture: googlePicture || null,
            googleAuthEnabled: true,
            ...(googlePicture && !user.avatarUrl ? { avatarUrl: googlePicture } : {}),
          },
        })
      }

      // Create session and get JWT token
      // For mobile, we need to create a session without setting a cookie
      // and return the JWT token directly
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      const sessionToken = crypto.randomBytes(32).toString('hex')
      
      const secretKey = process.env.AUTH_SECRET || 'your-secret-key-change-in-production'
      const encodedKey = new TextEncoder().encode(secretKey)
      
      const sessionJWT = await new SignJWT({ sessionToken })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiresAt)
        .sign(encodedKey)
      
      // Store session in database
      await prisma.session.create({
        data: {
          userId: user.id,
          token: sessionToken,
          expiresAt,
        },
      })

      // This is the mobile-callback endpoint
      // Instead of redirecting to deep link, append token to the callback URL itself
      // This way WebBrowser.openAuthSessionAsync can capture it directly
      const callbackUrl = new URL(request.url)
      callbackUrl.searchParams.set('token', sessionJWT)
      callbackUrl.searchParams.set('success', 'true')
      callbackUrl.searchParams.set('userId', user.id)
      
      // Return HTML that redirects to the callback URL with token (not deep link)
      // WebBrowser will capture this URL and return it to the app
      return new NextResponse(
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authentication Successful</title>
  <script>
    // Close the browser window - WebBrowser should have captured the URL
    window.close();
  </script>
</head>
<body>
  <p style="text-align: center; padding: 20px; font-family: sans-serif;">
    Authentication successful. You can close this window.
  </p>
</body>
</html>`,
        {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          },
        }
      )
    } catch (error: any) {
      console.error('[Mobile Google OAuth Callback] Error:', error)
      return NextResponse.json(
        { error: 'OAuth authentication failed', details: error.message },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('[Mobile Google OAuth Callback] Unhandled error:', error)
    return NextResponse.json(
      { error: 'OAuth authentication failed', details: error.message },
      { status: 500 }
    )
  }
}

