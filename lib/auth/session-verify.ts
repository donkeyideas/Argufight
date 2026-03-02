import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'

if (!process.env.AUTH_SECRET) {
  throw new Error('AUTH_SECRET environment variable is required')
}
const secretKey = process.env.AUTH_SECRET
const encodedKey = new TextEncoder().encode(secretKey)

/**
 * Verify session by checking JWT only (lightweight for Edge runtime)
 * For full session verification with database lookup, use verifySessionWithDb()
 * This function is safe for Edge runtime (no database access)
 */
export async function verifySession() {
  const cookieStore = await cookies()
  const sessionJWT = cookieStore.get('session')?.value

  if (!sessionJWT) {
    return null
  }

  try {
    // Verify JWT only (no database lookup for Edge runtime)
    const { payload } = await jwtVerify(sessionJWT, encodedKey)
    const { sessionToken } = payload as { sessionToken: string }

    // Return basic session info without database lookup
    // Full verification with database will be done in API routes/layouts
    return {
      sessionToken,
      // userId will be extracted from database in Node.js runtime contexts
    }
  } catch (error) {
    return null
  }
}

/**
 * Verify session with full database lookup (Node.js runtime only)
 * Use this in API routes and server components
 */
export async function verifySessionWithDb() {
  const cookieStore = await cookies()
  const sessionJWT = cookieStore.get('session')?.value

  if (!sessionJWT) {
    // Only log in development to reduce console noise
    if (process.env.NODE_ENV === 'development') {
      console.log('[verifySessionWithDb] No session JWT cookie found')
    }
    return null
  }

  try {
    // Verify JWT
    const { payload } = await jwtVerify(sessionJWT, encodedKey)
    const { sessionToken } = payload as { sessionToken: string }

    if (process.env.NODE_ENV === 'development') {
      console.log('[verifySessionWithDb] Decoded sessionToken:', sessionToken.substring(0, 20) + '...')
    }

    // Dynamic import Prisma to avoid Edge runtime issues
    const { prisma } = await import('@/lib/db/prisma')

    // Look up session in database - MUST use findUnique to ensure we get the exact session
    // CRITICAL: Use findUnique with token to get EXACT session, not findFirst
    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            isAdmin: true,
          },
        },
      },
    })

    if (!session) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[verifySessionWithDb] Session not found in database for token:', sessionToken.substring(0, 20) + '...')
      }
      return null
    }

    if (session.expiresAt < new Date()) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[verifySessionWithDb] Session expired, deleting:', session.id)
      }
      // Clean up expired session
      await prisma.session.delete({ where: { id: session.id } })
      return null
    }

    // CRITICAL VALIDATION: Ensure session.userId matches session.user.id
    // This prevents returning wrong user if there's a data corruption issue
    if (session.userId !== session.user.id) {
      console.error('[verifySessionWithDb] CRITICAL: Session userId mismatch!', {
        sessionId: session.id,
        sessionUserId: session.userId,
        userObjectId: session.user.id,
        sessionToken: sessionToken.substring(0, 20) + '...',
      })
      // Delete corrupted session
      await prisma.session.delete({ where: { id: session.id } })
      return null
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[verifySessionWithDb] Session verified:', {
        sessionId: session.id,
        userId: session.userId,
        userEmail: session.user.email,
        username: session.user.username,
        isAdmin: session.user.isAdmin,
        tokenMatch: session.token === sessionToken,
      })
    }

    return {
      userId: session.userId,
      sessionId: session.id,
      user: session.user,
    }
  } catch (error) {
    console.error('[verifySessionWithDb] Error:', error)
    return null
  }
}

/**
 * Delete session from database and cookie (Node.js runtime only)
 */
export async function deleteSession() {
  const cookieStore = await cookies()
  const sessionJWT = cookieStore.get('session')?.value

  if (sessionJWT) {
    try {
      const { payload } = await jwtVerify(sessionJWT, encodedKey)
      const { sessionToken } = payload as { sessionToken: string }
      
      // Dynamic import Prisma to avoid Edge runtime issues
      const { prisma } = await import('@/lib/db/prisma')
      
      // Delete from database
      await prisma.session.deleteMany({
        where: { token: sessionToken },
      })
    } catch (error) {
      // JWT invalid, just delete cookie
    }
  }

  cookieStore.delete('session')
}

/**
 * Get session from a token (for API routes that receive Bearer tokens)
 * This is used by mobile apps and API clients that send tokens in Authorization header
 */
export async function getSession(token: string) {
  if (!token) {
    return null
  }

  try {
    // Dynamic import Prisma to avoid Edge runtime issues
    const { prisma } = await import('@/lib/db/prisma')
    const { jwtVerify } = await import('jose')
    
    if (!process.env.AUTH_SECRET) {
      throw new Error('AUTH_SECRET environment variable is required')
    }
    const secretKey = process.env.AUTH_SECRET
    const encodedKey = new TextEncoder().encode(secretKey)

    // Verify JWT
    const { payload } = await jwtVerify(token, encodedKey)
    const { sessionToken } = payload as { sessionToken: string }

    // Look up session in database
    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            isAdmin: true,
          },
        },
      },
    })

    if (!session || session.expiresAt < new Date()) {
      // Session expired or not found
      if (session) {
        // Clean up expired session
        await prisma.session.delete({ where: { id: session.id } })
      }
      return null
    }

    return {
      userId: session.userId,
      sessionId: session.id,
      user: session.user,
    }
  } catch (error) {
    return null
  }
}
