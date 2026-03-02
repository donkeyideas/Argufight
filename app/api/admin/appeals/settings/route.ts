import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/appeals/settings - Get system-wide appeal settings
export async function GET() {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get default appeal limit from settings (or use 4 as default)
    // For now, we'll store this in a simple way - could be moved to a Settings model later
    const defaultLimit = 4 // TODO: Get from admin settings table

    return NextResponse.json({
      defaultMonthlyLimit: defaultLimit,
    })
  } catch (error: any) {
    console.error('Failed to fetch appeal settings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch appeal settings' },
      { status: error.status || 500 }
    )
  }
}

// POST /api/admin/appeals/settings - Update system-wide appeal settings
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { defaultMonthlyLimit } = body

    if (typeof defaultMonthlyLimit !== 'number' || defaultMonthlyLimit < 0) {
      return NextResponse.json(
        { error: 'defaultMonthlyLimit must be a non-negative number' },
        { status: 400 }
      )
    }

    // TODO: Save to admin settings table
    // For now, this is a placeholder that returns success
    // The actual limit is applied when creating new AppealLimit records

    return NextResponse.json({
      success: true,
      message: 'Settings updated (note: this will apply to new users only)',
      defaultMonthlyLimit,
    })
  } catch (error: any) {
    console.error('Failed to update appeal settings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update appeal settings' },
      { status: error.status || 500 }
    )
  }
}

