import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { verifyTotpToken } from '@/lib/auth/totp'

// POST /api/auth/2fa/verify - Verify 2FA token (during login)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, userId: loginUserId } = body

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // Get userId from session (if already logged in) or from login flow
    let userId = loginUserId

    if (!userId) {
      const session = await verifySession()
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = getUserIdFromSession(session)
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Get user and their TOTP secret
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        totpSecret: true,
        totpEnabled: true,
        totpBackupCodes: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.totpSecret) {
      return NextResponse.json({ error: '2FA is not set up for this account' }, { status: 400 })
    }

    // Check if using backup code
    let isValid = false
    let usedBackupCode = false

    if (user.totpBackupCodes) {
      const backupCodes = JSON.parse(user.totpBackupCodes) as string[]
      if (backupCodes.includes(token)) {
        // Remove used backup code
        const updatedCodes = backupCodes.filter(code => code !== token)
        await prisma.user.update({
          where: { id: userId },
          data: {
            totpBackupCodes: JSON.stringify(updatedCodes),
          },
        })
        isValid = true
        usedBackupCode = true
      }
    }

    // If not a backup code, verify TOTP token
    if (!isValid) {
      isValid = verifyTotpToken(user.totpSecret, token)
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 401 })
    }

    // If 2FA was not enabled yet (during setup), enable it now
    if (!user.totpEnabled && !usedBackupCode) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          totpEnabled: true,
        },
      })
    }

    // Mark session as 2FA verified
    const session = await prisma.session.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    if (session) {
      await prisma.session.update({
        where: { id: session.id },
        data: {
          twoFactorVerified: true,
        },
      })
    }

    return NextResponse.json({
      success: true,
      enabled: user.totpEnabled || !usedBackupCode,
    })
  } catch (error: any) {
    console.error('Failed to verify 2FA:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to verify 2FA' },
      { status: 500 }
    )
  }
}

