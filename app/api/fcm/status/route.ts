import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

// GET /api/fcm/status - Check if user has FCM token registered
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has any FCM tokens
    const tokens = await prisma.fCMToken.findMany({
      where: { userId },
      select: { id: true },
    })

    return NextResponse.json({
      hasToken: tokens.length > 0,
      tokenCount: tokens.length,
    })
  } catch (error: any) {
    console.error('Failed to check FCM status:', error)
    return NextResponse.json(
      { error: 'Failed to check FCM status' },
      { status: 500 }
    )
  }
}

