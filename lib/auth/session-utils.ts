/**
 * Utility functions for session management
 * Helps extract userId from session object (handles both old and new session formats)
 */

import { verifySession } from './session'
import { prisma } from '@/lib/db/prisma'

export function getUserIdFromSession(session: any): string | null {
  if (!session) return null
  
  // New format: session has userId directly or user object
  if (session.userId) {
    return session.userId
  }
  
  // New format: session has user object
  if (session.user?.id) {
    return session.user.id
  }
  
  return null
}

/**
 * Verify that the current user is an admin
 * Returns the userId if admin, null otherwise
 */
export async function verifyAdmin(): Promise<string | null> {
  try {
    const session = await verifySession()
    if (!session) {
      return null
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return null
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return null
    }

    return userId
  } catch (error) {
    console.error('Failed to verify admin:', error)
    return null
  }
}

