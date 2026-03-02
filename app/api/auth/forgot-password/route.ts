import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { hashPassword } from '@/lib/auth/password'
import { generateResetToken, getTokenData, deleteToken } from '@/lib/auth/password-reset-tokens'
import { sendPasswordResetEmail } from '@/lib/email/password-reset'
import crypto from 'crypto'

// POST /api/auth/forgot-password - Request password reset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim()

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    // Don't reveal if user exists (security best practice)
    // Always return success message
    if (user) {
      // Generate reset token (1 hour expiry)
      const token = await generateResetToken(normalizedEmail, 1)

      console.log(`[FORGOT-PASSWORD] Reset token generated for ${normalizedEmail}`)
      
      // Send email with reset link
      try {
        const emailSent = await sendPasswordResetEmail(user.email, token)
        if (emailSent) {
          console.log(`[FORGOT-PASSWORD] ✅ Password reset email sent successfully to ${normalizedEmail}`)
        } else {
          console.warn(`[FORGOT-PASSWORD] ⚠️  Failed to send password reset email to ${normalizedEmail}`)
          // Still return success to not reveal if user exists
        }
      } catch (emailError: any) {
        console.error('[FORGOT-PASSWORD] Error sending email:', emailError)
        // Still return success to not reveal if user exists
      }
      
      // Also log to console for development/debugging
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
                     (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://www.argufight.com')
      console.log(`[FORGOT-PASSWORD] Reset link: ${appUrl}/reset-password?token=${token}`)
    }

    // Always return success (don't reveal if user exists)
    return NextResponse.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    })
  } catch (error) {
    console.error('[FORGOT-PASSWORD] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/auth/reset-password - Reset password with token
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
    deleteToken(token)

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
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Check token
    const tokenData = await getTokenData(token)
    if (!tokenData) {
      return NextResponse.json(
        { valid: false, error: 'Invalid or expired token' },
        { status: 200 }
      )
    }

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










