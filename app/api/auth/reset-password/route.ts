import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { hashPassword } from '@/lib/auth/password'
import { getTokenData, deleteToken } from '@/lib/auth/password-reset-tokens'

// PUT /api/auth/reset-password - Reset password with token
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, newPassword } = body

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: 'Token and new password are required' },
        { status: 400 }
      )
    }

    // Validate password
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Check token
    const tokenData = await getTokenData(token)
    if (!tokenData) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      )
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: tokenData.email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword)

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    })

    // Delete used token
    await deleteToken(token)

    console.log(`[RESET-PASSWORD] Password reset successful for: ${user.email}`)

    return NextResponse.json({
      message: 'Password has been reset successfully',
    })
  } catch (error) {
    console.error('[RESET-PASSWORD] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/auth/reset-password?token=xxx - Verify token
export async function GET(request: NextRequest) {
  try {
    console.log('[RESET-PASSWORD GET] Route called')
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    console.log('[RESET-PASSWORD GET] Token received:', token ? `${token.substring(0, 10)}...${token.substring(token.length - 10)}` : 'missing')
    console.log('[RESET-PASSWORD GET] Full token length:', token?.length || 0)

    if (!token) {
      console.log('[RESET-PASSWORD GET] No token provided')
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Check token
    const tokenData = await getTokenData(token)
    if (!tokenData) {
      console.log('[RESET-PASSWORD GET] Token not found in storage or expired')
      return NextResponse.json(
        { valid: false, error: 'Invalid or expired token' },
        { status: 200 }
      )
    }

    console.log('[RESET-PASSWORD GET] Token valid for:', tokenData.email)
    console.log('[RESET-PASSWORD GET] Token expires at:', new Date(tokenData.expiresAt).toISOString())
    console.log('[RESET-PASSWORD GET] Current time:', new Date().toISOString())
    return NextResponse.json({
      valid: true,
      email: tokenData.email,
    })
  } catch (error) {
    console.error('[VERIFY-TOKEN] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
