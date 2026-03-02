import { Resend } from 'resend'
import { prisma } from '@/lib/db/prisma'

/**
 * Get the "from" email address for Resend emails
 * Uses custom domain if configured, otherwise falls back to Resend's default domain
 */
export async function getResendFromEmail(): Promise<string> {
  try {
    // Check if custom email domain is configured
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'RESEND_FROM_EMAIL' },
    })

    if (setting && setting.value && setting.value.trim()) {
      const fromEmail = setting.value.trim()
      console.log('[Resend] Using custom from email:', fromEmail)
      return fromEmail
    }
  } catch (error) {
    console.error('[Resend] Failed to fetch custom from email:', error)
  }

  // Fallback to verified domain (argufight.com is verified in Resend)
  const defaultFrom = 'Argu Fight <noreply@argufight.com>'
  console.log('[Resend] Using default from email (verified domain):', defaultFrom)
  return defaultFrom
}

/**
 * Get Resend API key from admin settings or environment
 */
export async function getResendKey(): Promise<string | null> {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'RESEND_API_KEY' },
    })

    if (setting && setting.value) {
      // Trim whitespace and log for debugging
      const trimmedKey = setting.value.trim()
      console.log('[Resend] Retrieved API key from DB, length:', trimmedKey.length, 'starts with:', trimmedKey.substring(0, 10) + '...')
      return trimmedKey
    } else {
      console.log('[Resend] No API key found in admin settings')
    }
  } catch (error) {
    console.error('[Resend] Failed to fetch Resend key from admin settings:', error)
  }

  // Fallback to env variable
  const envKey = process.env.RESEND_API_KEY
  if (envKey) {
    const trimmedKey = envKey.trim()
    console.log('[Resend] Using API key from environment, length:', trimmedKey.length, 'starts with:', trimmedKey.substring(0, 10) + '...')
    return trimmedKey
  }

  console.warn('[Resend] No API key found in admin settings or environment')
  return null
}

/**
 * Create Resend client
 */
export async function createResendClient(): Promise<Resend | null> {
  const apiKey = await getResendKey()
  
  if (!apiKey) {
    console.error('[Resend] Cannot create client: API key is missing')
    return null
  }

  // Validate API key format (Resend keys typically start with 're_')
  if (!apiKey.startsWith('re_')) {
    console.warn('[Resend] API key does not start with "re_" - may be invalid')
  }

  try {
    const client = new Resend(apiKey)
    console.log('[Resend] Client created successfully')
    return client
  } catch (error: any) {
    console.error('[Resend] Failed to create client:', error.message)
    return null
  }
}

