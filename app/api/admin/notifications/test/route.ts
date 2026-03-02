import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// POST /api/admin/notifications/test - Create a test notification for the current admin
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create a test notification
    const notification = await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        type: 'NEW_MESSAGE',
        title: 'Test Notification',
        message: 'This is a test notification to verify the notification system is working correctly.',
        read: false,
      },
    })

    console.log(`[Test Notification] Created notification for admin: ${userId}`)

    return NextResponse.json({
      success: true,
      notification: {
        id: notification.id,
        title: notification.title,
        message: notification.message,
      },
    })
  } catch (error: any) {
    console.error('[Test Notification] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create test notification' },
      { status: 500 }
    )
  }
}
