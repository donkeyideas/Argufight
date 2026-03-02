import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { canUserAppeal } from '@/lib/utils/appeal-limits'

// GET /api/debates/appeal-limit - Get current user's appeal limit
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const appealInfo = await canUserAppeal(userId)

    return NextResponse.json({
      remaining: appealInfo.remaining,
      limit: appealInfo.limit,
      canAppeal: appealInfo.canAppeal,
    })
  } catch (error) {
    console.error('Failed to fetch appeal limit:', error)
    return NextResponse.json(
      { error: 'Failed to fetch appeal limit' },
      { status: 500 }
    )
  }
}

