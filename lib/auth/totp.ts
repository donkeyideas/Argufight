import * as speakeasy from 'speakeasy'
import * as QRCode from 'qrcode'

/**
 * Generate a TOTP secret for a user
 */
export function generateTotpSecret(userEmail: string, serviceName: string = 'Argu Fight'): string {
  return speakeasy.generateSecret({
    name: `${serviceName} (${userEmail})`,
    issuer: serviceName,
    length: 32,
  }).base32
}

/**
 * Generate QR code data URL for Google Authenticator
 */
export async function generateQRCode(secret: string, userEmail: string, serviceName: string = 'Argu Fight'): Promise<string> {
  const otpauthUrl = speakeasy.otpauthURL({
    secret,
    label: userEmail,
    issuer: serviceName,
    encoding: 'base32',
  })

  return await QRCode.toDataURL(otpauthUrl)
}

/**
 * Verify a TOTP token
 */
export function verifyTotpToken(secret: string, token: string, window: number = 2): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window, // Allow tokens from 2 time steps before/after (60 seconds each)
  })
}

/**
 * Generate backup codes for 2FA
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    // Generate 8-digit backup code
    const code = Math.floor(10000000 + Math.random() * 90000000).toString()
    codes.push(code)
  }
  return codes
}

