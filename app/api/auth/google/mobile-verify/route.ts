import { NextRequest, NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'
import { SignJWT } from 'jose'
import { prisma } from '@/lib/db/prisma'
import crypto from 'crypto'

/**
 * Mobile Google OAuth — verify ID token directly
 * The mobile app gets the ID token from Google via expo-auth-session,
 * then sends it here. No redirects needed.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { idToken } = body

    if (!idToken) {
      return NextResponse.json(
        { error: 'Missing idToken' },
        { status: 400 }
      )
    }

    // Get Google OAuth credentials
    let clientId = process.env.GOOGLE_CLIENT_ID

    if (!clientId) {
      try {
        const setting = await prisma.adminSetting.findUnique({
          where: { key: 'GOOGLE_CLIENT_ID' },
        })
        if (setting?.value) clientId = setting.value
      } catch (error) {
        console.error('[Mobile Google Verify] Failed to fetch credentials:', error)
      }
    }

    if (!clientId) {
      return NextResponse.json(
        { error: 'Google OAuth not configured' },
        { status: 500 }
      )
    }

    // Verify the ID token with Google
    const oauth2Client = new OAuth2Client(clientId)
    const ticket = await oauth2Client.verifyIdToken({
      idToken,
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

    // Create session and JWT token
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

    // Return token and user info directly — no redirects
    return NextResponse.json({
      token: sessionJWT,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
        eloRating: (user as any).eloRating ?? 1000,
        isAdmin: (user as any).isAdmin ?? false,
        isBanned: (user as any).isBanned ?? false,
        coins: (user as any).coins ?? 0,
        hasCompletedOnboarding: (user as any).hasCompletedOnboarding ?? false,
      },
    })
  } catch (error: any) {
    console.error('[Mobile Google Verify] Error:', error)
    return NextResponse.json(
      { error: 'Authentication failed', details: error.message },
      { status: 500 }
    )
  }
}
