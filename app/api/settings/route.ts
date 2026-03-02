import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { verifyPassword, hashPassword } from '@/lib/auth/password'

// GET /api/settings - Get user settings
export async function GET() {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // For now, return default settings
    // In the future, you might want to store user preferences in the database
    return NextResponse.json({
      emailNotifications: true,
      debateNotifications: true,
    })
  } catch (error) {
    console.error('Failed to fetch settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

// PUT /api/settings - Update user settings
export async function PUT(request: NextRequest) {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { currentPassword, newPassword, emailNotifications, debateNotifications } = body

    // If changing password, verify current password
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required' },
          { status: 400 }
        )
      }

      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: 'New password must be at least 6 characters' },
          { status: 400 }
        )
      }

      // Get user to verify current password
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true, googleAuthEnabled: true },
      })

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      // Verify current password (skip if user has Google OAuth enabled)
      if (!user.googleAuthEnabled && user.passwordHash) {
        const isValid = await verifyPassword(currentPassword, user.passwordHash)
        if (!isValid) {
          return NextResponse.json(
            { error: 'Current password is incorrect' },
            { status: 401 }
          )
        }
      } else if (user.googleAuthEnabled) {
        return NextResponse.json(
          { error: 'Password cannot be changed for Google OAuth accounts' },
          { status: 400 }
        )
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword)

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      })
    }

    // Store notification preferences (for now, we'll just return success)
    // In the future, you might want to create a UserSettings model

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}

