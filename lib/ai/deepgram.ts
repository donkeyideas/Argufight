/**
 * Deepgram Speech-to-Text Integration
 * Provides real-time streaming transcription without timeout issues
 */

import { prisma } from '@/lib/db/prisma'

/**
 * Get Deepgram API key from admin settings
 */
export async function getDeepgramKey(): Promise<string | null> {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'DEEPGRAM_API_KEY' },
    })

    if (setting && setting.value) {
      return setting.value
    }

    // Fallback to env variable
    const envKey = process.env.DEEPGRAM_API_KEY
    if (envKey) {
      return envKey
    }

    return null
  } catch (error) {
    console.error('Failed to get Deepgram API key:', error)
    return null
  }
}

/**
 * Check if Deepgram is configured
 */
export async function isDeepgramConfigured(): Promise<boolean> {
  const key = await getDeepgramKey()
  return key !== null && key.length > 0
}

