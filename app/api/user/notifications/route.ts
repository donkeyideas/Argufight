import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getUserIdFromSession } from '@/lib/auth/session-utils'

const DEFAULT_PREFS = {
  emailOnChallenge: true,
  emailOnVerdict:   true,
  emailOnMessage:   true,
  emailOnFollow:    true,
}

function prefKey(userId: string) {
  return `user_notif_prefs_${userId}`
}

// GET /api/user/notifications — return current notification preferences
export async function GET() {
  try {
    const session = await verifySession()
    const userId  = getUserIdFromSession(session)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const setting = await prisma.adminSetting.findUnique({
      where: { key: prefKey(userId) },
    })

    const prefs = setting?.value ? { ...DEFAULT_PREFS, ...JSON.parse(setting.value) } : DEFAULT_PREFS
    return NextResponse.json({ prefs })
  } catch (error) {
    console.error('[user/notifications] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
  }
}

// PATCH /api/user/notifications — save notification preferences
export async function PATCH(request: NextRequest) {
  try {
    const session = await verifySession()
    const userId  = getUserIdFromSession(session)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body  = await request.json()
    const prefs = { ...DEFAULT_PREFS }

    // Only accept the known keys
    for (const key of Object.keys(DEFAULT_PREFS) as Array<keyof typeof DEFAULT_PREFS>) {
      if (typeof body[key] === 'boolean') prefs[key] = body[key]
    }

    await prisma.adminSetting.upsert({
      where:  { key: prefKey(userId) },
      update: { value: JSON.stringify(prefs) },
      create: { key: prefKey(userId), value: JSON.stringify(prefs) },
    })

    return NextResponse.json({ prefs })
  } catch (error) {
    console.error('[user/notifications] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }
}
