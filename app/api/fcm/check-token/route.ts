import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

// GET /api/fcm/check-token - Check if user has FCM token registered
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get FCM tokens for user
    const tokens = await prisma.fCMToken.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        device: true,
      },
    })

    return NextResponse.json({
      hasToken: tokens.length > 0,
      count: tokens.length,
      tokens: tokens.map(t => ({
        id: t.id,
        device: t.device,
      })),
    })
  } catch (error: any) {
    console.error('Failed to check FCM token:', error)
    return NextResponse.json(
      { error: 'Failed to check FCM token' },
      { status: 500 }
    )
  }
}
