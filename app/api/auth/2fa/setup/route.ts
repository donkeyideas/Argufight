import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getUserIdFromSession } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { generateTotpSecret, generateQRCode, generateBackupCodes } from '@/lib/auth/totp'

// GET /api/auth/2fa/setup - Generate 2FA setup (QR code)
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

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 2FA is now available for all users (optional)

    // Generate new secret
    const secret = generateTotpSecret(user.email)
    const qrCode = await generateQRCode(secret, user.email)
    const backupCodes = generateBackupCodes()

    // Store secret temporarily (user needs to verify before enabling)
    // We'll store it in the user record but mark totpEnabled as false
    await prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: secret,
        totpBackupCodes: JSON.stringify(backupCodes),
        totpEnabled: false, // Not enabled until verified
      },
    })

    return NextResponse.json({
      secret,
      qrCode,
      backupCodes,
    })
  } catch (error: any) {
    console.error('Failed to setup 2FA:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to setup 2FA' },
      { status: 500 }
    )
  }
}

