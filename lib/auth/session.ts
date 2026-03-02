import { SignJWT } from 'jose'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db/prisma'

if (!process.env.AUTH_SECRET) {
  throw new Error('AUTH_SECRET environment variable is required')
}
const secretKey = process.env.AUTH_SECRET
const encodedKey = new TextEncoder().encode(secretKey)

/**
 * Create a new session and store it in the database
 * Uses a session token in the cookie that references the database session
 * NOTE: This must be called from Node.js runtime (API routes), not Edge runtime
 * This function uses Node.js crypto which is not available in Edge runtime
 */
export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  
  // Generate a unique session token using crypto (Node.js only)
  // This function is only called from API routes which run in Node.js runtime
  // We use require() here instead of import to avoid Edge runtime evaluation
  const crypto = require('crypto')
  const sessionToken = crypto.randomBytes(32).toString('hex')
  
  // Create JWT with session token (not userId directly)
  const sessionJWT = await new SignJWT({ sessionToken })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(encodedKey)

  // Store session in database
  await prisma.session.create({
    data: {
      userId,
      token: sessionToken,
      expiresAt,
    },
  })

  const cookieStore = await cookies()
  // In production (Vercel), always use secure cookies for HTTPS
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
  cookieStore.set('session', sessionJWT, {
    httpOnly: true,
    secure: isProduction, // Use secure cookies in production (HTTPS required)
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
    // Don't set domain - let browser use current domain
  })

  return sessionJWT
}

/**
 * Create a session without setting the cookie
 * Use this when you need to set the cookie manually in a redirect response
 * (e.g., in OAuth callbacks where redirect happens immediately)
 */
export async function createSessionWithoutCookie(userId: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  
  // Generate a unique session token using crypto (Node.js only)
  const crypto = require('crypto')
  const sessionToken = crypto.randomBytes(32).toString('hex')
  
  // Create JWT with session token (not userId directly)
  const sessionJWT = await new SignJWT({ sessionToken })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(encodedKey)

  // Store session in database
  await prisma.session.create({
    data: {
      userId,
      token: sessionToken,
      expiresAt,
    },
  })

  return { sessionJWT, expiresAt }
}

// Re-export verifySessionWithDb as verifySession for API routes (Node.js runtime)
// This allows API routes to import from one place
export { verifySessionWithDb as verifySession, deleteSession, getSession } from './session-verify'

/**
 * Get all active sessions for a user (for multi-session support)
 */
export async function getUserSessions(userId: string) {
  return prisma.session.findMany({
    where: {
      userId,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

