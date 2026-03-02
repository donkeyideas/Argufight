/**
 * Deepgram Real-time Speech-to-Text API
 * Creates a WebSocket connection for streaming transcription
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { getDeepgramKey } from '@/lib/ai/deepgram'

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get Deepgram API key
    const apiKey = await getDeepgramKey()
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Deepgram API key not configured' },
        { status: 500 }
      )
    }

    // Return the API key to the client (it will be used to create WebSocket connection)
    // Note: In production, you might want to create a temporary token instead
    // For now, we'll return it directly since the client needs it for WebSocket
    return NextResponse.json({
      apiKey,
      // Deepgram WebSocket URL
      wsUrl: 'wss://api.deepgram.com/v1/listen',
    })
  } catch (error: any) {
    console.error('Failed to get Deepgram credentials:', error)
    return NextResponse.json(
      { error: 'Failed to initialize speech transcription' },
      { status: 500 }
    )
  }
}

