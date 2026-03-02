/**
 * Password reset token storage using database
 */

import crypto from 'crypto'
import { prisma } from '@/lib/db/prisma'

export interface ResetTokenData {
  email: string
  expiresAt: number
}

/**
 * Generate a new password reset token and store in database
 */
export async function generateResetToken(email: string, expiresInHours: number = 24): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
  const normalizedEmail = email.toLowerCase().trim()
  
  // Store in database
  await prisma.passwordResetToken.create({
    data: {
      email: normalizedEmail,
      token,
      expiresAt,
    },
  })
  
  console.log('[generateResetToken] Token created in database for:', normalizedEmail)
  console.log('[generateResetToken] Token expires at:', expiresAt.toISOString())
  
  return token
}

/**
 * Get token data if valid from database
 */
export async function getTokenData(token: string): Promise<ResetTokenData | null> {
  console.log('[getTokenData] Looking for token in database:', token ? `${token.substring(0, 10)}...${token.substring(token.length - 10)}` : 'missing')
  
  const tokenRecord = await prisma.passwordResetToken.findUnique({
    where: { token },
  })
  
  if (!tokenRecord) {
    console.log('[getTokenData] Token not found in database')
    return null
  }
  
  console.log('[getTokenData] Token found, expires at:', tokenRecord.expiresAt.toISOString())
  console.log('[getTokenData] Current time:', new Date().toISOString())
  console.log('[getTokenData] Used at:', tokenRecord.usedAt?.toISOString() || 'not used')
  
  // Check if already used
  if (tokenRecord.usedAt) {
    console.log('[getTokenData] Token already used')
    return null
  }
  
  // Check if expired
  if (tokenRecord.expiresAt < new Date()) {
    console.log('[getTokenData] Token expired, deleting')
    await prisma.passwordResetToken.delete({
      where: { token },
    })
    return null
  }
  
  console.log('[getTokenData] Token is valid')
  return {
    email: tokenRecord.email,
    expiresAt: tokenRecord.expiresAt.getTime(),
  }
}

/**
 * Delete a token (after use)
 */
export async function deleteToken(token: string): Promise<void> {
  // Mark as used instead of deleting (for audit trail)
  await prisma.passwordResetToken.update({
    where: { token },
    data: { usedAt: new Date() },
  }).catch(() => {
    // If update fails, try to delete
    prisma.passwordResetToken.delete({
      where: { token },
    }).catch(() => {
      // Ignore errors
    })
  })
}

/**
 * Clean up expired tokens (run periodically)
 */
export async function cleanupExpiredTokens(): Promise<void> {
  const now = new Date()
  const result = await prisma.passwordResetToken.deleteMany({
    where: {
      expiresAt: {
        lt: now,
      },
    },
  })
  console.log(`[cleanupExpiredTokens] Deleted ${result.count} expired tokens`)
}
