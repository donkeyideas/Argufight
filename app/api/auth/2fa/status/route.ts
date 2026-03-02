import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'

// GET /api/auth/2fa/status - Get 2FA status for current user
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

    // Get user 2FA status
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        totpEnabled: true,
        totpSecret: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      enabled: user.totpEnabled || false,
      hasSecret: !!user.totpSecret,
    })
  } catch (error: any) {
    console.error('Failed to get 2FA status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get 2FA status' },
      { status: 500 }
    )
  }
}

