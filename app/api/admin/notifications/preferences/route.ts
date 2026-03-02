import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { clearNotificationPreferencesCache } from '@/lib/notifications/notification-preferences'

export const dynamic = 'force-dynamic'

// GET /api/admin/notifications/preferences - Get notification preferences
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get preferences from admin settings
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'NOTIFICATION_PREFERENCES' },
    })

    let preferences: Record<string, boolean> = {}
    if (setting?.value) {
      try {
        preferences = JSON.parse(setting.value)
      } catch (error) {
        console.error('Failed to parse notification preferences:', error)
      }
    }

    return NextResponse.json({ preferences })
  } catch (error: any) {
    console.error('Failed to fetch notification preferences:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notification preferences' },
      { status: 500 }
    )
  }
}

// POST /api/admin/notifications/preferences - Save notification preferences
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { preferences } = body

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json(
        { error: 'Invalid preferences object' },
        { status: 400 }
      )
    }

    // Save preferences to admin settings
    await prisma.adminSetting.upsert({
      where: { key: 'NOTIFICATION_PREFERENCES' },
      update: {
        value: JSON.stringify(preferences),
        updatedAt: new Date(),
      },
      create: {
        key: 'NOTIFICATION_PREFERENCES',
        value: JSON.stringify(preferences),
      },
    })

    // Clear cache so new preferences take effect immediately
    clearNotificationPreferencesCache()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to save notification preferences:', error)
    return NextResponse.json(
      { error: 'Failed to save notification preferences' },
      { status: 500 }
    )
  }
}

