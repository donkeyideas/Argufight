import { verifySession } from './session'
import { getUserIdFromSession } from './session-utils'
import { prisma } from '@/lib/db/prisma'
import { NextResponse } from 'next/server'

interface AdminUser {
  id: string
  email: string
  isAdmin: boolean
  employeeRole: string | null
  accessLevel: string | null
}

/**
 * Verify that the current user is an admin and return their full admin info.
 * Returns null if not admin.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  try {
    const session = await verifySession()
    if (!session) return null

    const userId = getUserIdFromSession(session)
    if (!userId) return null

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isAdmin: true,
        employeeRole: true,
        accessLevel: true,
      },
    })

    if (!user?.isAdmin) return null

    return user
  } catch {
    return null
  }
}

/**
 * Check if a user is a super admin.
 * Uses employeeRole field — 'SUPER_ADMIN' role grants super admin privileges.
 * Falls back to the original admin@argufight.com email for backwards compatibility.
 */
export function isSuperAdmin(user: AdminUser): boolean {
  return (
    user.employeeRole === 'SUPER_ADMIN' ||
    user.email === 'admin@argufight.com'
  )
}

/**
 * Require admin access for an API route.
 * Returns the admin user or a 401/403 response.
 */
export async function requireAdmin(): Promise<
  | { admin: AdminUser; error?: never }
  | { admin?: never; error: NextResponse }
> {
  const admin = await getAdminUser()

  if (!admin) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      ),
    }
  }

  return { admin }
}

/**
 * Require super admin access for destructive operations.
 * Returns the admin user or a 401/403 response.
 */
export async function requireSuperAdmin(): Promise<
  | { admin: AdminUser; error?: never }
  | { admin?: never; error: NextResponse }
> {
  const admin = await getAdminUser()

  if (!admin) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      ),
    }
  }

  if (!isSuperAdmin(admin)) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized: Super admin access required' },
        { status: 403 }
      ),
    }
  }

  return { admin }
}
